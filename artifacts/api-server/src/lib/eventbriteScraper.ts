import { db, eventsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const EVENTBRITE_API_BASE = "https://www.eventbriteapi.com/v3";

const CAR_KEYWORDS = ["car meet", "cars and coffee", "car show", "track day", "car cruise", "auto show", "cars & coffee"];

type EventbriteEvent = {
  id: string;
  name: { text: string };
  description: { text: string | null };
  start: { utc: string };
  url: string;
  venue?: {
    name: string | null;
    address: {
      city: string | null;
      region: string | null;
      country: string | null;
      localized_address_display: string | null;
    };
  };
};

type EventbriteResponse = {
  events?: EventbriteEvent[];
  pagination?: { has_more_items: boolean; continuation: string };
};

function mapEventType(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes("track") || text.includes("circuit") || text.includes("race")) return "track_day";
  if (text.includes("cruise") || text.includes("cruisin")) return "cruise";
  if (text.includes("show")) return "show";
  if (text.includes("meet") || text.includes("coffee")) return "meet";
  return "other";
}

async function fetchEventbriteEvents(city?: string): Promise<EventbriteEvent[]> {
  const apiKey = process.env["EVENTBRITE_API_KEY"];
  if (!apiKey) {
    console.warn("[eventbrite] EVENTBRITE_API_KEY not set — skipping Eventbrite scrape");
    return [];
  }

  const all: EventbriteEvent[] = [];

  for (const keyword of CAR_KEYWORDS) {
    try {
      const url = new URL(`${EVENTBRITE_API_BASE}/events/search/`);
      url.searchParams.set("q", keyword);
      url.searchParams.set("expand", "venue");
      url.searchParams.set("start_date.keyword", "this_month");
      url.searchParams.set("sort_by", "date");
      url.searchParams.set("page_size", "20");
      if (city && city.trim()) {
        url.searchParams.set("location.address", city.trim());
        url.searchParams.set("location.within", "50mi");
      }

      const r = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!r.ok) {
        console.warn(`[eventbrite] keyword "${keyword}" returned ${r.status}`);
        continue;
      }

      const json = (await r.json()) as EventbriteResponse;
      for (const ev of json.events ?? []) {
        all.push(ev);
      }
    } catch (err) {
      console.error(`[eventbrite] keyword "${keyword}" failed`, err);
    }
  }

  return all;
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

export type EventbriteScrapeReport = {
  fetched: number;
  inserted: number;
  skippedDuplicates: number;
  skippedPast: number;
  skippedNoLocation: number;
  errors: number;
};

export async function scrapeEventbriteEvents(city?: string): Promise<EventbriteScrapeReport> {
  const report: EventbriteScrapeReport = {
    fetched: 0, inserted: 0, skippedDuplicates: 0, skippedPast: 0, skippedNoLocation: 0, errors: 0,
  };

  const bot = await getOrCreateBotUser();
  const events = await fetchEventbriteEvents(city);

  // Dedupe by Eventbrite ID upfront
  const seen = new Set<string>();
  const unique = events.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  report.fetched = unique.length;

  // Pre-filter existing sourceUrls
  const existingUrls = await db.select({ url: eventsTable.sourceUrl })
    .from(eventsTable)
    .where(sql`${eventsTable.sourceUrl} IS NOT NULL`);
  const existingSet = new Set(existingUrls.map(r => r.url));

  for (const ev of unique) {
    if (existingSet.has(ev.url)) {
      report.skippedDuplicates++;
      continue;
    }

    const startDate = new Date(ev.start.utc);
    if (isNaN(startDate.getTime()) || startDate.getTime() < Date.now()) {
      report.skippedPast++;
      continue;
    }

    const venue = ev.venue;
    if (!venue?.address?.city) {
      report.skippedNoLocation++;
      continue;
    }

    const cityName = [venue.address.city, venue.address.region].filter(Boolean).join(", ");
    const locationText = venue.address.localized_address_display || venue.name || cityName;
    const title = (ev.name.text || "Car Event").slice(0, 200);
    const description = (ev.description?.text || "").slice(0, 1000);
    const eventType = mapEventType(title, description);

    try {
      const inserted = await db.insert(eventsTable).values({
        userId: bot.id,
        title,
        description,
        type: eventType,
        date: startDate,
        location: locationText.slice(0, 200),
        city: cityName.slice(0, 100),
        source: "eventbrite",
        sourceUrl: ev.url,
      }).onConflictDoNothing({ target: eventsTable.sourceUrl }).returning({ id: eventsTable.id });

      if (inserted.length > 0) {
        report.inserted++;
      } else {
        report.skippedDuplicates++;
      }
    } catch (err) {
      report.errors++;
      console.error("[eventbrite] insert failed", err);
    }
  }

  return report;
}
