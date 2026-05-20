import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  usersTable,
  postsTable,
  eventsTable,
  activityTable,
  userFollowsTable,
} from "@workspace/db";
import { eq, desc, inArray, or, sql } from "drizzle-orm";
import { getOrCreateUser, formatUser } from "./users";

const router = Router();

// GET /api/feed?scope=following
// scope=following → only show items from followed users + self
// scope=all (default) → show all items
router.get("/feed", async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    const limit = Math.min(parseInt((req.query.limit as string) || "40"), 100);
    const offset = parseInt((req.query.offset as string) || "0");
    const scope = (req.query.scope as string) || "all";

    let me: typeof usersTable.$inferSelect | undefined;
    let followingIds: number[] = [];

    if (clerkId) {
      me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) }) || undefined;
      if (me) {
        const follows = await db.select({ followingId: userFollowsTable.followingId })
          .from(userFollowsTable)
          .where(eq(userFollowsTable.followerId, me.id));
        followingIds = follows.map(f => f.followingId);
      }
    }

    // IDs visible in "following" scope: self + followees
    const scopeIds = me ? [me.id, ...followingIds] : [];

    // --- Posts ---
    const postRows = await db.select({ post: postsTable, author: usersTable })
      .from(postsTable)
      .innerJoin(usersTable, eq(usersTable.id, postsTable.userId))
      .where(
        scope === "following" && scopeIds.length > 0
          ? inArray(postsTable.userId, scopeIds)
          : undefined
      )
      .orderBy(desc(postsTable.createdAt))
      .limit(limit + offset);

    const postItems = postRows.map(r => ({
      id: r.post.id,
      type: "post" as const,
      post: {
        id: r.post.id, userId: r.post.userId, carId: r.post.carId ?? null,
        title: r.post.title, body: r.post.body, category: r.post.category,
        make: r.post.make ?? null, model: r.post.model ?? null, year: r.post.year ?? null,
        generation: r.post.generation ?? null, location: r.post.location ?? null,
        tags: r.post.tags ?? [], imageUrls: r.post.imageUrls ?? [],
        likeCount: 0, commentCount: 0, isLiked: false, isSaved: false,
        author: formatUser(r.author), createdAt: r.post.createdAt,
      },
      actor: formatUser(r.author),
      createdAt: r.post.createdAt,
    }));

    // --- RSVP activity ---
    const actorAlias = usersTable;
    const rsvpRows = await db.select({
      activity: activityTable,
      actor: usersTable,
      event: eventsTable,
    })
      .from(activityTable)
      .innerJoin(usersTable, eq(usersTable.id, activityTable.actorId))
      .leftJoin(eventsTable, eq(eventsTable.id, activityTable.eventId))
      .where(
        scope === "following" && scopeIds.length > 0
          ? inArray(activityTable.actorId, scopeIds)
          : undefined
      )
      .orderBy(desc(activityTable.createdAt))
      .limit(limit + offset);

    const rsvpItems = rsvpRows.map(r => ({
      id: r.activity.id + 1_000_000, // namespace to avoid collisions with post ids
      type: "rsvp" as const,
      actor: formatUser(r.actor),
      event: r.event ? {
        id: r.event.id,
        title: r.event.title,
        date: r.event.date,
        location: r.event.location,
        city: r.event.city ?? null,
        type: r.event.type,
        sourceUrl: r.event.sourceUrl ?? null,
        imageUrl: r.event.imageUrl ?? null,
      } : null,
      createdAt: r.activity.createdAt,
    }));

    // Merge + sort by createdAt desc, then paginate
    const all = [...postItems, ...rsvpItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return res.json(all.slice(offset, offset + limit));
  } catch (err) {
    req.log.error({ err }, "Error getting feed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
