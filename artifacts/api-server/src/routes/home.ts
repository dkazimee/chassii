import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  usersTable,
  userFollowsTable,
  carsTable,
  postsTable,
  likesTable,
  commentsTable,
  eventsTable,
} from "@workspace/db";
import { eq, and, sql, desc, ne, inArray, gt, notInArray } from "drizzle-orm";

const router = Router();

router.get("/home/sidebar", async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) {
      return res.json({ suggestions: [], trending: [], events: [], myCars: [] });
    }

    const me = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, clerkId),
    });
    if (!me) {
      return res.json({ suggestions: [], trending: [], events: [], myCars: [] });
    }

    const myCarsRows = await db.select()
      .from(carsTable)
      .where(eq(carsTable.userId, me.id))
      .orderBy(desc(carsTable.updatedAt))
      .limit(10);

    const myMakes = Array.from(new Set(myCarsRows.map(c => c.make).filter(Boolean)));
    const myModels = Array.from(new Set(myCarsRows.map(c => c.model).filter(Boolean)));

    const followedRows = await db.select({ id: userFollowsTable.followingId })
      .from(userFollowsTable)
      .where(eq(userFollowsTable.followerId, me.id));
    const followedIds = followedRows.map(r => r.id);
    const excludeIds = [me.id, ...followedIds];

    // Who to follow: users who share at least one make with me OR are in same city,
    // ranked by shared-make count desc, then by follower count desc.
    let suggestions: any[] = [];
    if (myMakes.length > 0 || me.location) {
      const sharedCount = myMakes.length > 0
        ? sql<number>`count(distinct case when ${carsTable.make} in (${sql.join(myMakes.map(m => sql`${m}`), sql`, `)}) then ${carsTable.make} end)::int`
        : sql<number>`0::int`;

      const followerCount = sql<number>`(select count(*)::int from ${userFollowsTable} where ${userFollowsTable.followingId} = ${usersTable.id})`;

      const sameCity = me.location
        ? sql<boolean>`lower(coalesce(${usersTable.location}, '')) = lower(${me.location})`
        : sql<boolean>`false`;

      const rows = await db.select({
        user: usersTable,
        sharedMakes: sharedCount,
        sameCity,
        followerCount,
      })
        .from(usersTable)
        .leftJoin(carsTable, eq(carsTable.userId, usersTable.id))
        .where(and(
          notInArray(usersTable.id, excludeIds),
          eq(usersTable.isBlocked, false),
        ))
        .groupBy(usersTable.id)
        .having(sql`${sharedCount} > 0 or ${sameCity}`)
        .orderBy(desc(sharedCount), desc(sql`(${sameCity})::int`), desc(followerCount))
        .limit(5);

      suggestions = rows.map(r => ({
        id: r.user.id,
        username: r.user.username,
        displayName: r.user.displayName,
        avatarUrl: r.user.avatarUrl,
        location: r.user.location,
        sharedMakes: Number(r.sharedMakes) || 0,
        sameCity: !!r.sameCity,
        reason: Number(r.sharedMakes) > 0
          ? `Owns ${r.sharedMakes} of your makes`
          : "In your city",
      }));
    }

    // Trending discussions related to my garage (last 30 days), ranked by likes.
    let trending: any[] = [];
    if (myMakes.length > 0) {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const likeCount = sql<number>`(select count(*)::int from ${likesTable} where ${likesTable.postId} = ${postsTable.id})`;
      const commentCount = sql<number>`(select count(*)::int from ${commentsTable} where ${commentsTable.postId} = ${postsTable.id})`;
      const rows = await db.select({
        post: postsTable,
        author: usersTable,
        likeCount,
        commentCount,
      })
        .from(postsTable)
        .innerJoin(usersTable, eq(usersTable.id, postsTable.userId))
        .where(and(
          inArray(postsTable.make, myMakes),
          gt(postsTable.createdAt, since),
          eq(usersTable.isBlocked, false),
        ))
        .orderBy(desc(likeCount), desc(postsTable.createdAt))
        .limit(5);

      trending = rows.map(r => ({
        id: r.post.id,
        title: r.post.title,
        make: r.post.make,
        model: r.post.model,
        category: r.post.category,
        likeCount: Number(r.likeCount) || 0,
        commentCount: Number(r.commentCount) || 0,
        createdAt: r.post.createdAt,
        author: {
          id: r.author.id,
          username: r.author.username,
          displayName: r.author.displayName,
          avatarUrl: r.author.avatarUrl,
        },
      }));
    }

    // Upcoming events near me. Events have no coords, so we match on the user's
    // location text against event city/location (loose "near me" approximation).
    let events: any[] = [];
    const loc = me.location?.trim();
    if (loc) {
      const now = new Date();
      const rows = await db.select({ event: eventsTable })
        .from(eventsTable)
        .innerJoin(usersTable, eq(usersTable.id, eventsTable.userId))
        .where(and(
          gt(eventsTable.date, now),
          eq(usersTable.isBlocked, false),
          sql`(lower(coalesce(${eventsTable.city}, '')) = lower(${loc}) or lower(${eventsTable.location}) like lower(${'%' + loc + '%'}))`,
        ))
        .orderBy(eventsTable.date)
        .limit(5);
      events = rows.map(({ event: e }) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        location: e.location,
        city: e.city,
        type: e.type,
        imageUrl: e.imageUrl,
      }));
    }

    return res.json({
      suggestions,
      trending,
      events,
      myCars: myCarsRows.map(c => ({
        id: c.id,
        make: c.make,
        model: c.model,
        year: c.year,
        mainImageUrl: c.mainImageUrl,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error loading home sidebar");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
