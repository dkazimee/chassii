import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  usersTable,
  postsTable,
  carsTable,
  timelineEntriesTable,
  userFollowsTable,
} from "@workspace/db";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { getOrCreateUser, formatUser } from "./users";

const router = Router();

// GET /api/feed
router.get("/feed", async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    const limit = parseInt((req.query.limit as string) || "20");
    const offset = parseInt((req.query.offset as string) || "0");

    // Get recent posts for the feed (simplified – show all recent posts)
    const posts = await db.select({ post: postsTable, author: usersTable })
      .from(postsTable)
      .innerJoin(usersTable, eq(usersTable.id, postsTable.userId))
      .orderBy(desc(postsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const feedItems = posts.map(r => ({
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

    return res.json(feedItems);
  } catch (err) {
    req.log.error({ err }, "Error getting feed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
