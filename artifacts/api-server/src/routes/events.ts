import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable, eventsTable, eventRsvpsTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { getOrCreateUser, formatUser } from "./users";

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
    imageUrl: e.imageUrl ?? null,
    rsvpCount, hasRsvpd,
    organizer: formatUser(organizer),
    createdAt: e.createdAt,
  };
}

// GET /api/events
router.get("/events", async (req, res) => {
  try {
    const { location, type, limit = "20" } = req.query as Record<string, string>;
    const { userId: clerkId } = getAuth(req);

    const events = await db.select({ event: eventsTable, organizer: usersTable })
      .from(eventsTable)
      .innerJoin(usersTable, eq(usersTable.id, eventsTable.userId))
      .orderBy(desc(eventsTable.date))
      .limit(parseInt(limit));

    let meUser: typeof usersTable.$inferSelect | undefined;
    if (clerkId) {
      meUser = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) }) || undefined;
    }

    return res.json(await Promise.all(events.map(async r => {
      const rsvpCount = await getRsvpCount(r.event.id);
      let hasRsvpd = false;
      if (meUser) {
        const rsvp = await db.query.eventRsvpsTable.findFirst({
          where: and(eq(eventRsvpsTable.eventId, r.event.id), eq(eventRsvpsTable.userId, meUser.id)),
        });
        hasRsvpd = !!rsvp;
      }
      return formatEvent(r.event, r.organizer, rsvpCount, hasRsvpd);
    })));
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

    const { title, description, type, date, location, imageUrl } = req.body;
    const [event] = await db.insert(eventsTable).values({
      userId: me.id, title, description, type: type || "other",
      date: new Date(date), location, imageUrl,
    }).returning();

    return res.status(201).json(formatEvent(event, me));
  } catch (err) {
    req.log.error({ err }, "Error creating event");
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
