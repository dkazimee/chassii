import { db, eventsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { geocodeCity } from "../geocode";

const SERPAPI_KEY = process.env.SERPAPI_KEY;

const CAR_QUERIES = [
  "cars and coffee",
  "car show",
  "car meet",
  "classic car show",
  "auto show",
  "car cruise",
];

const RADIUS_MILES = 100;
const DAYS_AHEAD = 90;

type SerpEventDate = {
  start_date?: string;
  when?: string;
};

type SerpEvent = {
  title?: string;
  date?: SerpEventDate;
  address?: string[];
  link?: string;
  description?: string;
  thumbnail?: string;
  venue?: { name?: string };
};

type SerpApiResponse = {
  events_results?: SerpEvent[];
  error?: string;
};

function parseSerpDate(dateObj: SerpEventDate): Date | null {
  const raw = dateObj.start_date || dateObj.when || "";
  if (!raw) return null;

  const now = new Date();
  const year = now.getFullYear();

  // Remove day-of-week prefix (e.g. "Saturday, " or "Sat, ")
  let cleaned = raw.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, "");
  // Remove time portion (e.g. ", 8–11AM" or ", 9AM–3PM")
  cleaned = cleaned.replace(/,?\s*\d{1,2}(:\d{2})?\s*(AM|PM|am|pm).*$/i, "");
  // Take only start of date range (before –, —, or -)
  cleaned = cleaned.split(/\s*[–—]\s*/)[0].trim();
  // Remove trailing comma
  cleaned = cleaned.replace(/,$/, "").trim();

  for (const y of [year, year + 1]) {
    const d = new Date(`${cleaned} ${y}`);
    if (!isNaN(d.getTime())) {
      if (y === year && d.getTime() < now.getTime() - 86_400_000) continue;
      return d;
    }
  }
  return null;
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3_959;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchGoogleEvents(query: string, location: string): Promise<SerpEvent[]> {
  if (!SERPAPI_KEY) return [];
  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_events");
    url.searchParams.set("q", query);
    url.searchParams.set("location", location);
    url.searchParams.set("hl", "en");
    url.searchParams.set("gl", "us");
    url.searchParams.set("api_key", SERPAPI_KEY);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.error(`[serpapi] HTTP ${res.status} for query "${query}"`);
      return [];
    }
    const data = (await res.json()) as SerpApiResponse;
    if (data.error) {
      console.error(`[serpapi] API error: ${data.error}`);
      return [];
    }
    return data.events_results ?? [];
  } catch (err) {
    console.error(`[serpapi] fetch failed for query "${query}":`, err);
    return [];
  }
}

async function getOrCreateBotUser(): Promise<typeof usersTable.$inferSelect> {
  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, "system:chassii-bot"),
  });
  if (existing) return existing;
  const inserted = await db.insert(usersTable).values({
    clerkId: "system:chassii-bot",
    username: "chassii_bot",
    displayName: "CHASSII Events Bot",
    bio: "Auto-discovers car events from across the web so you don't have to.",
  }).onConflictDoNothing({ target: usersTable.clerkId }).returning();
  if (inserted[0]) return inserted[0];
  const found = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, "system:chassii-bot"),
  });
  if (!found) throw new Error("Failed to get or create bot user");
  return found;
}

export type SerpScrapeReport = {
  fetched: number;
  inserted: number;
  skippedDuplicates: number;
  skippedNoDate: number;
  skippedOutOfRange: number;
  skippedPast: number;
  errors: number;
  insertedEvents: Array<{ id: number; city: string; title: string }>;
};

export async function scrapeSerpApiEvents(city: string): Promise<SerpScrapeReport> {
  const report: SerpScrapeReport = {
    fetched: 0, inserted: 0, skippedDuplicates: 0,
    skippedNoDate: 0, skippedOutOfRange: 0, skippedPast: 0, errors: 0,
    insertedEvents: [],
  };

  if (!SERPAPI_KEY) {
    console.warn("[serpapi] SERPAPI_KEY not set — skipping Google Events scrape");
    return report;
  }

  // Geocode the search center
  const center = await geocodeCity(city);
  if (!center) {
    console.warn(`[serpapi] Could not geocode city: ${city}`);
    return report;
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() + DAYS_AHEAD * 86_400_000);
  const bot = await getOrCreateBotUser();

  // Pre-load existing sourceUrls to avoid duplicate AI/DB work
  const existingUrls = await db.select({ url: eventsTable.sourceUrl })
    .from(eventsTable)
    .where(sql`${eventsTable.sourceUrl} IS NOT NULL`);
  const existingSet = new Set(existingUrls.map(r => r.url));

  // Collect all events across queries, dedup by link
  const seen = new Set<string>();
  const allEvents: SerpEvent[] = [];

  for (const query of CAR_QUERIES) {
    const results = await fetchGoogleEvents(query, city);
    report.fetched += results.length;
    for (const ev of results) {
      const key = ev.link || `${ev.title}|${ev.date?.when}`;
      if (!seen.has(key)) {
        seen.add(key);
        allEvents.push(ev);
      }
    }
    // Small delay between API calls
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`[serpapi] Fetched ${allEvents.length} unique events for "${city}"`);

  for (const ev of allEvents) {
    if (!ev.title || !ev.date) { report.skippedNoDate++; continue; }

    const sourceUrl = ev.link || null;
    if (sourceUrl && existingSet.has(sourceUrl)) { report.skippedDuplicates++; continue; }

    // Parse date
    const eventDate = parseSerpDate(ev.date);
    if (!eventDate) { report.skippedNoDate++; continue; }
    if (eventDate.getTime() < now.getTime() - 86_400_000) { report.skippedPast++; continue; }
    if (eventDate.getTime() > cutoff.getTime()) { report.skippedPast++; continue; }

    // Build location string from address array
    const addressParts = ev.address ?? [];
    const location = addressParts.join(", ") || ev.venue?.name || city;
    const eventCity = addressParts.length > 1
      ? addressParts[addressParts.length - 1]   // last part is usually "City, ST ZIP"
      : city;

    // Geocode event address for distance filtering
    let lat: number | null = null;
    let lng: number | null = null;

    const geoQuery = addressParts.length > 0 ? addressParts.join(", ") : city;
    const coords = await geocodeCity(geoQuery);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
      const dist = haversineMiles(center.lat, center.lng, lat, lng);
      if (dist > RADIUS_MILES) {
        report.skippedOutOfRange++;
        continue;
      }
    }

    // Determine event type from title/description
    const text = `${ev.title} ${ev.description ?? ""}`.toLowerCase();
    let type = "other";
    if (text.includes("coffee") || text.includes("meet")) type = "meet";
    else if (text.includes("show") || text.includes("expo") || text.includes("display")) type = "show";
    else if (text.includes("cruise") || text.includes("rally")) type = "cruise";
    else if (text.includes("track") || text.includes("race") || text.includes("lap")) type = "track_day";

    try {
      const inserted = await db.insert(eventsTable).values({
        userId: bot.id,
        title: (ev.title ?? "").slice(0, 200),
        description: (ev.description ?? "").slice(0, 1000),
        type,
        date: eventDate,
        location: location.slice(0, 200),
        city: eventCity.slice(0, 100),
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        imageUrl: ev.thumbnail ?? undefined,
        source: "google",
        sourceUrl: sourceUrl ?? undefined,
      }).onConflictDoNothing({ target: eventsTable.sourceUrl }).returning({ id: eventsTable.id });

      if (inserted.length > 0) {
        report.inserted++;
        report.insertedEvents.push({ id: inserted[0].id, city: eventCity.slice(0, 100), title: (ev.title ?? "").slice(0, 200) });
        if (sourceUrl) existingSet.add(sourceUrl);
      } else {
        report.skippedDuplicates++;
      }
    } catch (err) {
      report.errors++;
      console.error("[serpapi] insert failed", err);
    }
  }

  console.log(`[serpapi] Done for "${city}" — ${report.inserted} inserted, ${report.skippedOutOfRange} out of range, ${report.skippedNoDate} no date`);
  return report;
}
