import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable, eventsTable, eventRsvpsTable, eventAlertPreferencesTable } from "@workspace/db";
import { eq, and, sql, asc, ilike, isNotNull } from "drizzle-orm";
import { getOrCreateUser, formatUser } from "./users";
import { geocodeCity } from "../geocode";

const router = Router();

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

// GET /api/events
router.get("/events", async (req, res) => {
  try {
    const { city, type, limit = "30", includePast } = req.query as Record<string, string>;
    const { userId: clerkId } = getAuth(req);

    const filters = [] as any[];
    if (city && city.trim()) {
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
      await db.insert(eventRsvpsTable).values({ eventId, userId: me.id });
    }
    return res.json({ rsvpd: true });
  } catch (err) {
    req.log.error({ err }, "Error RSVPing to event");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
