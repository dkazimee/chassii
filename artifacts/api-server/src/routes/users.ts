import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  usersTable,
  userFollowsTable,
  carsTable,
  postsTable,
} from "@workspace/db";
import { eq, and, sql, desc, ne } from "drizzle-orm";

const router = Router();

function formatUser(u: typeof usersTable.$inferSelect, extra?: {
  iFollowThem?: boolean;
  isFollowingMe?: boolean;
  followerCount?: number;
  followingCount?: number;
  carCount?: number;
  postCount?: number;
}) {
  return {
    id: u.id,
    clerkId: u.clerkId,
    username: u.username,
    displayName: u.displayName,
    bio: u.bio ?? null,
    location: u.location ?? null,
    avatarUrl: u.avatarUrl ?? null,
    coverUrl: u.coverUrl ?? null,
    iFollowThem: extra?.iFollowThem ?? false,
    isFollowingMe: extra?.isFollowingMe ?? false,
    followerCount: extra?.followerCount ?? 0,
    followingCount: extra?.followingCount ?? 0,
    carCount: extra?.carCount ?? 0,
    postCount: extra?.postCount ?? 0,
    createdAt: u.createdAt,
  };
}

async function getOrCreateUser(clerkId: string): Promise<typeof usersTable.$inferSelect> {
  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, clerkId),
  });
  if (existing) return existing;

  const username = `user_${clerkId.slice(-8)}`;
  const [created] = await db.insert(usersTable).values({
    clerkId,
    username,
    displayName: username,
  }).returning();
  return created;
}

async function getUserCounts(userId: number) {
  const [followerResult] = await db.select({ count: sql<number>`count(*)::int` })
    .from(userFollowsTable).where(eq(userFollowsTable.followingId, userId));
  const [followingResult] = await db.select({ count: sql<number>`count(*)::int` })
    .from(userFollowsTable).where(eq(userFollowsTable.followerId, userId));
  const [carResult] = await db.select({ count: sql<number>`count(*)::int` })
    .from(carsTable).where(eq(carsTable.userId, userId));
  const [postResult] = await db.select({ count: sql<number>`count(*)::int` })
    .from(postsTable).where(eq(postsTable.userId, userId));
  return {
    followerCount: followerResult?.count ?? 0,
    followingCount: followingResult?.count ?? 0,
    carCount: carResult?.count ?? 0,
    postCount: postResult?.count ?? 0,
  };
}

// GET /api/users/me
router.get("/users/me", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

    const user = await getOrCreateUser(clerkId);
    const counts = await getUserCounts(user.id);

    return res.json(formatUser(user, counts));
  } catch (err) {
    req.log.error({ err }, "Error getting me");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/me
router.patch("/users/me", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

    const user = await getOrCreateUser(clerkId);
    const { displayName, bio, location, avatarUrl, coverUrl } = req.body;

    const [updated] = await db.update(usersTable)
      .set({ displayName, bio, location, avatarUrl, coverUrl })
      .where(eq(usersTable.id, user.id))
      .returning();

    const counts = await getUserCounts(user.id);
    return res.json(formatUser(updated, counts));
  } catch (err) {
    req.log.error({ err }, "Error updating me");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:userId
router.get("/users/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { userId: clerkId } = getAuth(req);

    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
    if (!user) return res.status(404).json({ error: "User not found" });

    const counts = await getUserCounts(userId);

    let iFollowThem = false;
    if (clerkId) {
      const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
      if (me) {
        const follow = await db.query.userFollowsTable.findFirst({
          where: and(eq(userFollowsTable.followerId, me.id), eq(userFollowsTable.followingId, userId)),
        });
        iFollowThem = !!follow;
      }
    }

    const cars = await db.select().from(carsTable).where(and(eq(carsTable.userId, userId), eq(carsTable.isPublic, true)));

    return res.json({
      ...formatUser(user, { ...counts, iFollowThem }),
      cars: cars.map(c => ({
        id: c.id, userId: c.userId, make: c.make, model: c.model, year: c.year,
        generation: c.generation, trim: c.trim, color: c.color, mileage: c.mileage,
        transmission: c.transmission, engine: c.engine, mainImageUrl: c.mainImageUrl,
        ownershipStory: c.ownershipStory, isPublic: c.isPublic,
        followerCount: 0, iFollow: false, owner: formatUser(user),
        createdAt: c.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:userId/cars
router.get("/users/:userId/cars", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { userId: clerkId } = getAuth(req);

    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
    if (!user) return res.status(404).json({ error: "User not found" });

    const cars = await db.select().from(carsTable)
      .where(eq(carsTable.userId, userId))
      .orderBy(desc(carsTable.createdAt));

    return res.json(cars.map(c => ({
      id: c.id, userId: c.userId, make: c.make, model: c.model, year: c.year,
      generation: c.generation, trim: c.trim, color: c.color, mileage: c.mileage,
      transmission: c.transmission, engine: c.engine, mainImageUrl: c.mainImageUrl,
      ownershipStory: c.ownershipStory, isPublic: c.isPublic,
      followerCount: 0, iFollow: false, owner: formatUser(user),
      createdAt: c.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Error getting user cars");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:userId/posts
router.get("/users/:userId/posts", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
    if (!user) return res.status(404).json({ error: "User not found" });

    const posts = await db.select().from(postsTable)
      .where(eq(postsTable.userId, userId))
      .orderBy(desc(postsTable.createdAt));

    return res.json(posts.map(p => ({
      id: p.id, userId: p.userId, carId: p.carId ?? null,
      title: p.title, body: p.body, category: p.category,
      make: p.make ?? null, model: p.model ?? null, year: p.year ?? null,
      generation: p.generation ?? null, location: p.location ?? null,
      tags: p.tags ?? [], imageUrls: p.imageUrls ?? [],
      likeCount: 0, commentCount: 0, isLiked: false, isSaved: false,
      author: formatUser(user), createdAt: p.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Error getting user posts");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/users/:userId/follow
router.post("/users/:userId/follow", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const targetId = parseInt(req.params.userId);
    if (me.id === targetId) return res.status(400).json({ error: "Cannot follow yourself" });

    const existing = await db.query.userFollowsTable.findFirst({
      where: and(eq(userFollowsTable.followerId, me.id), eq(userFollowsTable.followingId, targetId)),
    });
    if (!existing) {
      await db.insert(userFollowsTable).values({ followerId: me.id, followingId: targetId });
    }
    return res.json({ following: true });
  } catch (err) {
    req.log.error({ err }, "Error following user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/users/:userId/follow
router.delete("/users/:userId/follow", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const targetId = parseInt(req.params.userId);

    await db.delete(userFollowsTable)
      .where(and(eq(userFollowsTable.followerId, me.id), eq(userFollowsTable.followingId, targetId)));
    return res.json({ following: false });
  } catch (err) {
    req.log.error({ err }, "Error unfollowing user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:userId/followers
router.get("/users/:userId/followers", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const followers = await db.select({ user: usersTable })
      .from(userFollowsTable)
      .innerJoin(usersTable, eq(usersTable.id, userFollowsTable.followerId))
      .where(eq(userFollowsTable.followingId, userId));

    return res.json(followers.map(f => formatUser(f.user)));
  } catch (err) {
    req.log.error({ err }, "Error getting followers");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:userId/following
router.get("/users/:userId/following", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const following = await db.select({ user: usersTable })
      .from(userFollowsTable)
      .innerJoin(usersTable, eq(usersTable.id, userFollowsTable.followingId))
      .where(eq(userFollowsTable.followerId, userId));

    return res.json(following.map(f => formatUser(f.user)));
  } catch (err) {
    req.log.error({ err }, "Error getting following");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/notifications
router.get("/notifications", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const { notificationsTable } = await import("@workspace/db");
    const limit = parseInt(req.query.limit as string) || 20;
    const notifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, me.id))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(limit);

    return res.json(notifications.map(n => ({
      id: n.id, type: n.type, isRead: n.isRead,
      postId: n.postId ?? null, carId: n.carId ?? null,
      message: n.message, createdAt: n.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Error getting notifications");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { getOrCreateUser, formatUser };
export default router;
