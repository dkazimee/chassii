import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable, postsTable, commentsTable, likesTable, savedPostsTable } from "@workspace/db";
import { eq, and, sql, desc, ilike, or, inArray } from "drizzle-orm";
import { getOrCreateUser, formatUser } from "./users";

const router = Router();

router.param("postId", (req, res, next, value) => {
  const id = parseInt(value, 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid post id" });
  next();
});

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

async function getBatchPostCounts(postIds: number[]): Promise<Map<number, { likeCount: number; commentCount: number }>> {
  if (!postIds.length) return new Map();
  const [likes, comments] = await Promise.all([
    db.select({ postId: likesTable.postId, count: sql<number>`count(*)::int` })
      .from(likesTable).where(inArray(likesTable.postId, postIds)).groupBy(likesTable.postId),
    db.select({ postId: commentsTable.postId, count: sql<number>`count(*)::int` })
      .from(commentsTable).where(inArray(commentsTable.postId, postIds)).groupBy(commentsTable.postId),
  ]);
  const likeMap = new Map(likes.map(r => [r.postId!, r.count]));
  const commentMap = new Map(comments.map(r => [r.postId, r.count]));
  return new Map(postIds.map(id => [id, { likeCount: likeMap.get(id) ?? 0, commentCount: commentMap.get(id) ?? 0 }]));
}

async function getBatchUserPostStatus(userId: number, postIds: number[]): Promise<Map<number, { isLiked: boolean; isSaved: boolean }>> {
  if (!postIds.length) return new Map();
  const [liked, saved] = await Promise.all([
    db.select({ postId: likesTable.postId }).from(likesTable)
      .where(and(eq(likesTable.userId, userId), inArray(likesTable.postId, postIds))),
    db.select({ postId: savedPostsTable.postId }).from(savedPostsTable)
      .where(and(eq(savedPostsTable.userId, userId), inArray(savedPostsTable.postId, postIds))),
  ]);
  const likedSet = new Set(liked.map(r => r.postId!));
  const savedSet = new Set(saved.map(r => r.postId));
  return new Map(postIds.map(id => [id, { isLiked: likedSet.has(id), isSaved: savedSet.has(id) }]));
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
    const { q, make, model, year, generation, category, tag, location, sort, limit = "20", offset = "0" } = req.query as Record<string, string>;
    const { userId: clerkId } = getAuth(req);

    const conditions = [] as any[];
    if (make) conditions.push(ilike(postsTable.make, make));
    if (model) conditions.push(ilike(postsTable.model, model));
    if (year) {
      const y = parseInt(year);
      if (!Number.isNaN(y)) conditions.push(eq(postsTable.year, y));
    }
    if (generation) conditions.push(ilike(postsTable.generation, `%${generation}%`));
    if (category && category !== "all") conditions.push(eq(postsTable.category, category));
    if (tag) conditions.push(sql`${postsTable.tags} @> ARRAY[${tag}]::text[]`);
    if (location) conditions.push(ilike(postsTable.location, `%${location}%`));
    if (q?.trim()) {
      const term = `%${q.trim()}%`;
      conditions.push(or(ilike(postsTable.title, term), ilike(postsTable.body, term))!);
    }

    const likeCount = sql<number>`(select count(*)::int from ${likesTable} where ${likesTable.postId} = ${postsTable.id})`;
    const orderBy = sort === "popular"
      ? [desc(likeCount), desc(postsTable.createdAt)]
      : [desc(postsTable.createdAt)];

    const posts = await db.select({ post: postsTable, author: usersTable })
      .from(postsTable)
      .innerJoin(usersTable, eq(usersTable.id, postsTable.userId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(...orderBy)
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    let meUser: typeof usersTable.$inferSelect | undefined;
    if (clerkId) {
      meUser = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) }) || undefined;
    }

    const postIds = posts.map(r => r.post.id);
    const [countsMap, statusMap] = await Promise.all([
      getBatchPostCounts(postIds),
      meUser ? getBatchUserPostStatus(meUser.id, postIds) : Promise.resolve(new Map<number, { isLiked: boolean; isSaved: boolean }>()),
    ]);

    return res.json(posts.map(r => {
      const counts = countsMap.get(r.post.id) ?? { likeCount: 0, commentCount: 0 };
      const status = statusMap.get(r.post.id) ?? { isLiked: false, isSaved: false };
      return formatPost(r.post, r.author, counts.likeCount, counts.commentCount, status.isLiked, status.isSaved);
    }));
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
    if (!title || !body) return res.status(400).json({ error: "title and body are required" });
    const [post] = await db.insert(postsTable).values({
      userId: me.id,
      title: String(title).trim().slice(0, 300),
      body: String(body).trim().slice(0, 10000),
      category: category || "general",
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
