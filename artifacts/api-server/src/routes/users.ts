import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  usersTable,
  userFollowsTable,
  userBlocksTable,
  carsTable,
  postsTable,
} from "@workspace/db";
import { eq, and, sql, desc, ne, isNotNull } from "drizzle-orm";

const router = Router();

const NOMINATIM_UA = "CHASSII Social Network (https://chassii-social-network.replit.app)";

// Quantize coords to a ~10-mile grid (~0.15°) so a member's exact home/work
// address is never exposed even if they enter a full street address. All
// addresses within the same ~10mi cell collapse to the same display point on
// the community map.
const FUZZ_GRID_DEGREES = 0.15;
function fuzzCoord(n: number): number {
  return Math.round(n / FUZZ_GRID_DEGREES) * FUZZ_GRID_DEGREES;
}

async function geocodeLocation(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": NOMINATIM_UA },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { lat: fuzzCoord(lat), lon: fuzzCoord(lon) };
  } catch {
    return null;
  }
}

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
    const { displayName, bio, location, avatarUrl, coverUrl, username } = req.body;

    if (username && username !== user.username) {
      const taken = await db.query.usersTable.findFirst({
        where: and(eq(usersTable.username, username), ne(usersTable.id, user.id)),
      });
      if (taken) {
        return res.status(409).json({ error: "Username is already taken" });
      }
    }

    let latitude: number | null | undefined = undefined;
    let longitude: number | null | undefined = undefined;
    if (location !== undefined && location !== user.location) {
      const trimmed = (location ?? "").trim();
      if (!trimmed) {
        latitude = null;
        longitude = null;
      } else {
        const geo = await geocodeLocation(trimmed);
        // Always write coords — null them out if geocode fails so stale
        // coordinates from a previous location are not retained.
        latitude = geo ? geo.lat : null;
        longitude = geo ? geo.lon : null;
      }
    }

    const [updated] = await db.update(usersTable)
      .set({
        ...(displayName !== undefined && { displayName }),
        ...(bio !== undefined && { bio }),
        ...(location !== undefined && { location }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(coverUrl !== undefined && { coverUrl }),
        ...(username !== undefined && { username }),
      })
      .where(eq(usersTable.id, user.id))
      .returning();

    const counts = await getUserCounts(user.id);
    return res.json(formatUser(updated, counts));
  } catch (err) {
    req.log.error({ err }, "Error updating me");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/map - returns all users with coordinates + their public cars
router.get("/users/map", async (req, res) => {
  try {
    const users = await db.select().from(usersTable).where(
      and(
        eq(usersTable.isPublicLocation, true),
        isNotNull(usersTable.latitude),
        isNotNull(usersTable.longitude),
      ),
    );
    const userIds = users.map(u => u.id);
    const cars = userIds.length
      ? await db.select().from(carsTable).where(eq(carsTable.isPublic, true))
      : [];
    const carsByUser = new Map<number, typeof cars>();
    for (const c of cars) {
      if (!userIds.includes(c.userId)) continue;
      const list = carsByUser.get(c.userId) ?? [];
      list.push(c);
      carsByUser.set(c.userId, list);
    }
    return res.json(users.map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl ?? null,
      location: u.location ?? null,
      latitude: u.latitude,
      longitude: u.longitude,
      cars: (carsByUser.get(u.id) ?? []).map(c => ({
        id: c.id, make: c.make, model: c.model, year: c.year,
        mainImageUrl: c.mainImageUrl ?? null,
      })),
    })));
  } catch (err) {
    req.log.error({ err }, "Error getting map users");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/reverse-geocode - given lat/lon, return city/neighborhood label
router.post("/reverse-geocode", requireAuth(), async (req, res) => {
  try {
    const lat = Number(req.body?.lat);
    const lon = Number(req.body?.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.status(400).json({ error: "lat and lon required" });
    }
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("format", "json");
    url.searchParams.set("zoom", "12");
    const r = await fetch(url.toString(), {
      headers: { "User-Agent": NOMINATIM_UA },
    });
    if (!r.ok) return res.status(502).json({ error: "Reverse geocode failed" });
    const data = (await r.json()) as {
      address?: {
        neighbourhood?: string; suburb?: string; city?: string; town?: string;
        village?: string; county?: string; state?: string; country?: string;
      };
      display_name?: string;
    };
    const a = data.address ?? {};
    const city = a.city || a.town || a.village || a.suburb || a.neighbourhood || a.county || "";
    const region = a.state || a.country || "";
    const label = [city, region].filter(Boolean).join(", ") || data.display_name || "";
    return res.json({ label, lat, lon });
  } catch (err) {
    req.log.error({ err }, "Error reverse geocoding");
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
    let iBlockThem = false;
    if (clerkId) {
      const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
      if (me) {
        const [follow, block] = await Promise.all([
          db.query.userFollowsTable.findFirst({
            where: and(eq(userFollowsTable.followerId, me.id), eq(userFollowsTable.followingId, userId)),
          }),
          db.query.userBlocksTable.findFirst({
            where: and(eq(userBlocksTable.blockerId, me.id), eq(userBlocksTable.blockedId, userId)),
          }),
        ]);
        iFollowThem = !!follow;
        iBlockThem = !!block;
      }
    }

    const cars = await db.select().from(carsTable).where(and(eq(carsTable.userId, userId), eq(carsTable.isPublic, true)));

    return res.json({
      ...formatUser(user, { ...counts, iFollowThem }),
      iBlockThem,
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

// POST /api/users/:userId/block
router.post("/users/:userId/block", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const targetId = parseInt(req.params.userId);
    if (me.id === targetId) return res.status(400).json({ error: "Cannot block yourself" });

    const existing = await db.query.userBlocksTable.findFirst({
      where: and(eq(userBlocksTable.blockerId, me.id), eq(userBlocksTable.blockedId, targetId)),
    });
    if (!existing) {
      await db.insert(userBlocksTable).values({ blockerId: me.id, blockedId: targetId });
    }
    // Also unfollow in both directions on block
    await db.delete(userFollowsTable)
      .where(and(eq(userFollowsTable.followerId, me.id), eq(userFollowsTable.followingId, targetId)));
    await db.delete(userFollowsTable)
      .where(and(eq(userFollowsTable.followerId, targetId), eq(userFollowsTable.followingId, me.id)));
    return res.json({ blocked: true });
  } catch (err) {
    req.log.error({ err }, "Error blocking user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/users/:userId/block
router.delete("/users/:userId/block", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const targetId = parseInt(req.params.userId);

    await db.delete(userBlocksTable)
      .where(and(eq(userBlocksTable.blockerId, me.id), eq(userBlocksTable.blockedId, targetId)));
    return res.json({ blocked: false });
  } catch (err) {
    req.log.error({ err }, "Error unblocking user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/users/:userId/follower — remove someone from your own followers
router.delete("/users/:userId/follower", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const followerId = parseInt(req.params.userId);

    // The person to remove is following me — delete that row
    await db.delete(userFollowsTable)
      .where(and(eq(userFollowsTable.followerId, followerId), eq(userFollowsTable.followingId, me.id)));
    return res.json({ removed: true });
  } catch (err) {
    req.log.error({ err }, "Error removing follower");
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

// POST /api/notifications/read-all — mark all notifications as read
router.post("/notifications/read-all", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const { notificationsTable } = await import("@workspace/db");
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, me.id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error marking notifications read");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { getOrCreateUser, formatUser };
export default router;
