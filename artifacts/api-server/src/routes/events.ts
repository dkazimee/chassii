import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable, eventsTable, eventRsvpsTable, eventAlertPreferencesTable, activityTable } from "@workspace/db";
import { eq, and, sql, asc, ilike, isNotNull } from "drizzle-orm";
import { getOrCreateUser, formatUser } from "./users";
import { geocodeCity } from "../geocode";
import { scrapeSerpApiEvents } from "../lib/serpApiScraper";

// Simple in-memory rate limit: one Google scrape per city per hour
const serpScrapeLastRun = new Map<string, number>();
const SERP_COOLDOWN_MS = 60 * 60 * 1000;

const router = Router();

router.param("eventId", (req, res, next, value) => {
  const id = parseInt(value, 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid event id" });
  next();
});

async function getRsvpCount(eventId: number) {
  const [r] = await db.select({ count: sql<number>`count(*)::int` })
    .from(eventRsvpsTable).where(eq(eventRsvpsTable.eventId, eventId));
  return r?.count ?? 0;
}

function formatEvent(e: typeof eventsTable.$inferSelect, organizer: typeof usersTable.$inferSelect, rsvpCount = 0, hasRsvpd = false) {
  return {
    id: e.id, userId: e.userId,
    title: e.title, description: e.description ?? null,
    type: e.type, date: e.date, location: e.location,
    city: e.city ?? null,
    lat: e.lat ?? null,
    lng: e.lng ?? null,
    imageUrl: e.imageUrl ?? null,
    source: e.source ?? null,
    sourceUrl: e.sourceUrl ?? null,
    rsvpCount, hasRsvpd,
    organizer: formatUser(organizer),
    createdAt: e.createdAt,
  };
}

async function geocodeAndCacheEvent(e: typeof eventsTable.$inferSelect): Promise<typeof eventsTable.$inferSelect> {
  if (e.lat != null && e.lng != null) return e;
  const query = e.city || e.location;
  if (!query) return e;
  const coords = await geocodeCity(query);
  if (!coords) return e;
  try {
    await db.update(eventsTable)
      .set({ lat: coords.lat, lng: coords.lng })
      .where(eq(eventsTable.id, e.id));
  } catch {}
  return { ...e, lat: coords.lat, lng: coords.lng };
}

// GET /api/events/cities — distinct cities with event counts (for filter dropdown)
router.get("/events/cities", async (req, res) => {
  try {
    const rows = await db.select({
      city: eventsTable.city,
      count: sql<number>`count(*)::int`,
    })
      .from(eventsTable)
      .where(and(isNotNull(eventsTable.city), sql`${eventsTable.date} >= now()`))
      .groupBy(eventsTable.city)
      .orderBy(sql`count(*) desc`);
    return res.json(rows.filter(r => r.city));
  } catch (err) {
    (req as any).log?.error?.({ err }, "Error listing event cities");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Weather cache: key = "lat|lng|date"
interface WeatherResult { weathercode: number; tempMax: number; tempMin: number; precipProb: number; }
const weatherCache = new Map<string, { data: WeatherResult; expires: number }>();

// GET /api/weather?lat=...&lng=...&date=YYYY-MM-DD
router.get("/weather", async (req, res) => {
  const { lat, lng, date } = req.query as Record<string, string>;
  if (!lat || !lng || !date) return res.status(400).json({ error: "lat, lng, date required" });
  const latN = parseFloat(lat), lngN = parseFloat(lng);
  if (isNaN(latN) || isNaN(lngN)) return res.status(400).json({ error: "Invalid lat/lng" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });

  const key = `${latN.toFixed(3)}|${lngN.toFixed(3)}|${date}`;
  const cached = weatherCache.get(key);
  if (cached && cached.expires > Date.now()) return res.json(cached.data);

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latN));
    url.searchParams.set("longitude", String(lngN));
    url.searchParams.set("daily", "weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("start_date", date);
    url.searchParams.set("end_date", date);

    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.status(502).json({ error: "Weather service unavailable" });

    const json = await r.json() as any;
    const daily = json.daily;
    if (!daily?.weathercode?.length || daily.weathercode[0] === null || daily.weathercode[0] === undefined) {
      return res.status(404).json({ error: "No forecast available for this date" });
    }

    const data: WeatherResult = {
      weathercode: daily.weathercode[0],
      tempMax: Math.round(daily.temperature_2m_max[0]),
      tempMin: Math.round(daily.temperature_2m_min[0]),
      precipProb: Math.round(daily.precipitation_probability_max[0] ?? 0),
    };
    weatherCache.set(key, { data, expires: Date.now() + 3 * 60 * 60 * 1000 });
    return res.json(data);
  } catch {
    return res.status(502).json({ error: "Failed to fetch weather" });
  }
});

// GET /api/geocode?q=city — resolve city name to lat/lng
router.get("/geocode", async (req, res) => {
  const { q } = req.query as Record<string, string>;
  if (!q?.trim()) return res.status(400).json({ error: "q is required" });
  const coords = await geocodeCity(q.trim());
  if (!coords) return res.status(404).json({ error: "Location not found" });
  return res.json(coords);
});

// GET /api/events
router.get("/events", async (req, res) => {
  try {
    const { city, type, limit = "60", includePast, nearLat, nearLng, radiusMiles = "100" } = req.query as Record<string, string>;
    const { userId: clerkId } = getAuth(req);

    const filters = [] as any[];

    // Radius filter (Haversine SQL) — takes priority over city text filter
    const lat = parseFloat(nearLat);
    const lng = parseFloat(nearLng);
    const radius = parseFloat(radiusMiles);
    if (!isNaN(lat) && !isNaN(lng) && !isNaN(radius)) {
      filters.push(sql`
        ${eventsTable.lat} IS NOT NULL AND ${eventsTable.lng} IS NOT NULL AND
        2 * 3959 * asin(sqrt(
          power(sin((radians(${eventsTable.lat}) - radians(${lat})) / 2), 2) +
          cos(radians(${lat})) * cos(radians(${eventsTable.lat})) *
          power(sin((radians(${eventsTable.lng}) - radians(${lng})) / 2), 2)
        )) <= ${radius}
      `);
    } else if (city && city.trim()) {
      filters.push(ilike(eventsTable.city, `%${city.trim()}%`));
    }

    if (type && type.trim()) {
      filters.push(eq(eventsTable.type, type.trim()));
    }
    const showPast = includePast === "true" || includePast === "1";
    if (!showPast) {
      filters.push(sql`${eventsTable.date} >= now() - interval '1 day'`);
    }

    const events = await db.select({ event: eventsTable, organizer: usersTable })
      .from(eventsTable)
      .innerJoin(usersTable, eq(usersTable.id, eventsTable.userId))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(asc(eventsTable.date))
      .limit(parseInt(limit));

    let meUser: typeof usersTable.$inferSelect | undefined;
    if (clerkId) {
      meUser = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) }) || undefined;
    }

    const results = await Promise.all(events.map(async r => {
      const geocoded = await geocodeAndCacheEvent(r.event);
      const rsvpCount = await getRsvpCount(geocoded.id);
      let hasRsvpd = false;
      if (meUser) {
        const rsvp = await db.query.eventRsvpsTable.findFirst({
          where: and(eq(eventRsvpsTable.eventId, geocoded.id), eq(eventRsvpsTable.userId, meUser.id)),
        });
        hasRsvpd = !!rsvp;
      }
      return formatEvent(geocoded, r.organizer, rsvpCount, hasRsvpd);
    }));

    return res.json(results);
  } catch (err) {
    req.log.error({ err }, "Error listing events");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/events
router.post("/events", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);

    const { title, description, type, date, location, city, imageUrl } = req.body;

    let lat: number | null = null;
    let lng: number | null = null;
    const geoQuery = city || location;
    if (geoQuery) {
      const coords = await geocodeCity(geoQuery);
      if (coords) { lat = coords.lat; lng = coords.lng; }
    }

    const [event] = await db.insert(eventsTable).values({
      userId: me.id, title, description, type: type || "other",
      date: new Date(date), location, city: city || null,
      lat: lat ?? undefined, lng: lng ?? undefined, imageUrl,
    }).returning();

    return res.status(201).json(formatEvent(event, me));
  } catch (err) {
    req.log.error({ err }, "Error creating event");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/me/alert-preferences
router.get("/users/me/alert-preferences", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);

    const pref = await db.query.eventAlertPreferencesTable.findFirst({
      where: eq(eventAlertPreferencesTable.userId, me.id),
    });

    return res.json(pref ? { city: pref.city, enabled: pref.enabled } : null);
  } catch (err) {
    req.log.error({ err }, "Error getting alert preferences");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/users/me/alert-preferences
router.put("/users/me/alert-preferences", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);

    const { city, enabled } = req.body as { city?: string; enabled?: boolean };
    if (!city || !city.trim()) {
      return res.status(400).json({ error: "city is required" });
    }

    const existing = await db.query.eventAlertPreferencesTable.findFirst({
      where: eq(eventAlertPreferencesTable.userId, me.id),
    });

    let pref;
    if (existing) {
      [pref] = await db.update(eventAlertPreferencesTable)
        .set({ city: city.trim(), enabled: enabled !== false })
        .where(eq(eventAlertPreferencesTable.userId, me.id))
        .returning();
    } else {
      [pref] = await db.insert(eventAlertPreferencesTable)
        .values({ userId: me.id, city: city.trim(), enabled: enabled !== false })
        .returning();
    }

    return res.json({ city: pref.city, enabled: pref.enabled });
  } catch (err) {
    req.log.error({ err }, "Error saving alert preferences");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/users/me/alert-preferences
router.delete("/users/me/alert-preferences", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);

    await db.delete(eventAlertPreferencesTable)
      .where(eq(eventAlertPreferencesTable.userId, me.id));

    return res.json({ deleted: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting alert preferences");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/events/refresh — authenticated users trigger a Google Events scrape for their city
router.post("/events/refresh", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

    const { city } = req.body as { city?: string };
    if (!city || !city.trim()) {
      return res.status(400).json({ error: "city is required" });
    }

    const normalizedCity = city.trim().toLowerCase();
    const lastRun = serpScrapeLastRun.get(normalizedCity) ?? 0;
    const now = Date.now();
    if (now - lastRun < SERP_COOLDOWN_MS) {
      return res.json({ inserted: 0, skipped: true, reason: "recently_scraped" });
    }
    serpScrapeLastRun.set(normalizedCity, now);

    // Run in background — don't await so the response returns immediately
    scrapeSerpApiEvents(city.trim()).then(report => {
      console.log(`[events/refresh] Google scrape for "${city}" done — ${report.inserted} inserted`);
    }).catch(err => {
      console.error(`[events/refresh] Google scrape failed for "${city}"`, err);
    });

    return res.json({ inserted: 0, started: true });
  } catch (err) {
    req.log.error({ err }, "Error triggering events refresh");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/events/:eventId/rsvp
router.post("/events/:eventId/rsvp", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const eventId = parseInt(req.params.eventId);

    const existing = await db.query.eventRsvpsTable.findFirst({
      where: and(eq(eventRsvpsTable.eventId, eventId), eq(eventRsvpsTable.userId, me.id)),
    });
    if (!existing) {
      await db.transaction(async (tx) => {
        await tx.insert(eventRsvpsTable).values({ eventId, userId: me.id });
        await tx.insert(activityTable).values({ actorId: me.id, type: "rsvp", eventId });
      });
    }
    return res.json({ rsvpd: true });
  } catch (err) {
    req.log.error({ err }, "Error RSVPing to event");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
