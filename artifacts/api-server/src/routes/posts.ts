import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable, postsTable, commentsTable, likesTable, savedPostsTable } from "@workspace/db";
import { eq, and, sql, desc, ilike, or } from "drizzle-orm";
import { getOrCreateUser, formatUser } from "./users";

const router = Router();

async function getPostCounts(postId: number) {
  const [likeResult] = await db.select({ count: sql<number>`count(*)::int` })
    .from(likesTable).where(and(eq(likesTable.postId, postId)));
  const [commentResult] = await db.select({ count: sql<number>`count(*)::int` })
    .from(commentsTable).where(eq(commentsTable.postId, postId));
  return {
    likeCount: likeResult?.count ?? 0,
    commentCount: commentResult?.count ?? 0,
  };
}

async function getUserPostStatus(userId: number, postId: number) {
  const liked = await db.query.likesTable.findFirst({
    where: and(eq(likesTable.userId, userId), eq(likesTable.postId, postId)),
  });
  const saved = await db.query.savedPostsTable.findFirst({
    where: and(eq(savedPostsTable.userId, userId), eq(savedPostsTable.postId, postId)),
  });
  return { isLiked: !!liked, isSaved: !!saved };
}

function formatPost(p: typeof postsTable.$inferSelect, author: typeof usersTable.$inferSelect, likeCount = 0, commentCount = 0, isLiked = false, isSaved = false) {
  return {
    id: p.id, userId: p.userId, carId: p.carId ?? null,
    title: p.title, body: p.body, category: p.category,
    make: p.make ?? null, model: p.model ?? null, year: p.year ?? null,
    generation: p.generation ?? null, location: p.location ?? null,
    tags: p.tags ?? [], imageUrls: p.imageUrls ?? [],
    likeCount, commentCount, isLiked, isSaved,
    author: formatUser(author), createdAt: p.createdAt,
  };
}

// GET /api/posts
router.get("/posts", async (req, res) => {
  try {
    const { make, model, year, category, tag, location, sort, limit = "20", offset = "0" } = req.query as Record<string, string>;
    const { userId: clerkId } = getAuth(req);

    const posts = await db.select({ post: postsTable, author: usersTable })
      .from(postsTable)
      .innerJoin(usersTable, eq(usersTable.id, postsTable.userId))
      .orderBy(desc(postsTable.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    let meUser: typeof usersTable.$inferSelect | undefined;
    if (clerkId) {
      meUser = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) }) || undefined;
    }

    return res.json(await Promise.all(posts.map(async r => {
      const counts = await getPostCounts(r.post.id);
      let isLiked = false, isSaved = false;
      if (meUser) {
        const status = await getUserPostStatus(meUser.id, r.post.id);
        isLiked = status.isLiked;
        isSaved = status.isSaved;
      }
      return formatPost(r.post, r.author, counts.likeCount, counts.commentCount, isLiked, isSaved);
    })));
  } catch (err) {
    req.log.error({ err }, "Error listing posts");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/posts
router.post("/posts", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);

    const { title, body, category, carId, make, model, year, generation, location, tags, imageUrls } = req.body;
    const [post] = await db.insert(postsTable).values({
      userId: me.id, title, body, category: category || "general",
      carId: carId || null, make, model, year, generation, location,
      tags: tags || [], imageUrls: imageUrls || [],
    }).returning();

    return res.status(201).json(formatPost(post, me));
  } catch (err) {
    req.log.error({ err }, "Error creating post");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/posts/:postId
router.get("/posts/:postId", async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const { userId: clerkId } = getAuth(req);

    const result = await db.select({ post: postsTable, author: usersTable })
      .from(postsTable)
      .innerJoin(usersTable, eq(usersTable.id, postsTable.userId))
      .where(eq(postsTable.id, postId))
      .limit(1);

    if (!result.length) return res.status(404).json({ error: "Post not found" });
    const { post, author } = result[0];

    const counts = await getPostCounts(postId);
    let isLiked = false, isSaved = false;
    if (clerkId) {
      const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
      if (me) {
        const status = await getUserPostStatus(me.id, postId);
        isLiked = status.isLiked;
        isSaved = status.isSaved;
      }
    }

    const rawComments = await db.select({ comment: commentsTable, author: usersTable })
      .from(commentsTable)
      .innerJoin(usersTable, eq(usersTable.id, commentsTable.userId))
      .where(and(eq(commentsTable.postId, postId)))
      .orderBy(commentsTable.createdAt);

    const topLevel = rawComments.filter(c => !c.comment.parentId);
    const replies = rawComments.filter(c => !!c.comment.parentId);

    const comments = topLevel.map(c => ({
      id: c.comment.id, postId: c.comment.postId, userId: c.comment.userId,
      parentId: null, body: c.comment.body, likeCount: 0, isLiked: false,
      author: formatUser(c.author),
      replies: replies.filter(r => r.comment.parentId === c.comment.id).map(r => ({
        id: r.comment.id, postId: r.comment.postId, userId: r.comment.userId,
        parentId: r.comment.parentId ?? null, body: r.comment.body, likeCount: 0, isLiked: false,
        author: formatUser(r.author), replies: [], createdAt: r.comment.createdAt,
      })),
      createdAt: c.comment.createdAt,
    }));

    return res.json({
      ...formatPost(post, author, counts.likeCount, counts.commentCount, isLiked, isSaved),
      comments,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting post");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/posts/:postId
router.patch("/posts/:postId", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const postId = parseInt(req.params.postId);

    const post = await db.query.postsTable.findFirst({ where: and(eq(postsTable.id, postId), eq(postsTable.userId, me.id)) });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const { title, body, tags, imageUrls } = req.body;
    const [updated] = await db.update(postsTable).set({ title, body, tags, imageUrls }).where(eq(postsTable.id, postId)).returning();
    const counts = await getPostCounts(postId);
    return res.json(formatPost(updated, me, counts.likeCount, counts.commentCount));
  } catch (err) {
    req.log.error({ err }, "Error updating post");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/posts/:postId
router.delete("/posts/:postId", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const postId = parseInt(req.params.postId);

    await db.delete(postsTable).where(and(eq(postsTable.id, postId), eq(postsTable.userId, me.id)));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting post");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/posts/:postId/like
router.post("/posts/:postId/like", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const postId = parseInt(req.params.postId);

    const existing = await db.query.likesTable.findFirst({
      where: and(eq(likesTable.userId, me.id), eq(likesTable.postId, postId)),
    });
    if (!existing) {
      await db.insert(likesTable).values({ userId: me.id, postId });
    }
    const [r] = await db.select({ count: sql<number>`count(*)::int` }).from(likesTable).where(eq(likesTable.postId, postId));
    return res.json({ liked: true, likeCount: r?.count ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Error liking post");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/posts/:postId/like
router.delete("/posts/:postId/like", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const postId = parseInt(req.params.postId);

    await db.delete(likesTable).where(and(eq(likesTable.userId, me.id), eq(likesTable.postId, postId)));
    const [r] = await db.select({ count: sql<number>`count(*)::int` }).from(likesTable).where(eq(likesTable.postId, postId));
    return res.json({ liked: false, likeCount: r?.count ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Error unliking post");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/posts/:postId/save
router.post("/posts/:postId/save", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const postId = parseInt(req.params.postId);

    const existing = await db.query.savedPostsTable.findFirst({
      where: and(eq(savedPostsTable.userId, me.id), eq(savedPostsTable.postId, postId)),
    });
    if (!existing) {
      await db.insert(savedPostsTable).values({ userId: me.id, postId });
    }
    return res.json({ saved: true });
  } catch (err) {
    req.log.error({ err }, "Error saving post");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/posts/:postId/save
router.delete("/posts/:postId/save", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const postId = parseInt(req.params.postId);

    await db.delete(savedPostsTable).where(and(eq(savedPostsTable.userId, me.id), eq(savedPostsTable.postId, postId)));
    return res.json({ saved: false });
  } catch (err) {
    req.log.error({ err }, "Error unsaving post");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/posts/:postId/comments
router.get("/posts/:postId/comments", async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const rawComments = await db.select({ comment: commentsTable, author: usersTable })
      .from(commentsTable)
      .innerJoin(usersTable, eq(usersTable.id, commentsTable.userId))
      .where(eq(commentsTable.postId, postId))
      .orderBy(commentsTable.createdAt);

    const topLevel = rawComments.filter(c => !c.comment.parentId);
    const replies = rawComments.filter(c => !!c.comment.parentId);

    return res.json(topLevel.map(c => ({
      id: c.comment.id, postId: c.comment.postId, userId: c.comment.userId,
      parentId: null, body: c.comment.body, likeCount: 0, isLiked: false,
      author: formatUser(c.author),
      replies: replies.filter(r => r.comment.parentId === c.comment.id).map(r => ({
        id: r.comment.id, postId: r.comment.postId, userId: r.comment.userId,
        parentId: r.comment.parentId ?? null, body: r.comment.body, likeCount: 0, isLiked: false,
        author: formatUser(r.author), replies: [], createdAt: r.comment.createdAt,
      })),
      createdAt: c.comment.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Error getting comments");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/posts/:postId/comments
router.post("/posts/:postId/comments", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const postId = parseInt(req.params.postId);

    const { body, parentId } = req.body;
    const [comment] = await db.insert(commentsTable).values({
      postId, userId: me.id, body, parentId: parentId || null,
    }).returning();

    return res.status(201).json({
      id: comment.id, postId: comment.postId, userId: comment.userId,
      parentId: comment.parentId ?? null, body: comment.body,
      likeCount: 0, isLiked: false, author: formatUser(me), replies: [],
      createdAt: comment.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Error creating comment");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
