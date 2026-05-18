import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, carsTable, postsTable } from "@workspace/db";
import { eq, sql, desc, ilike, or } from "drizzle-orm";
import { formatUser } from "./users";

const router = Router();

// GET /api/search
router.get("/search", async (req, res) => {
  try {
    const { q = "", type = "all", make, model, year, location } = req.query as Record<string, string>;
    const searchTerm = `%${q}%`;

    const [cars, users, posts] = await Promise.all([
      (type === "all" || type === "cars") ? db.select({ car: carsTable, user: usersTable })
        .from(carsTable)
        .innerJoin(usersTable, eq(usersTable.id, carsTable.userId))
        .where(or(ilike(carsTable.make, searchTerm), ilike(carsTable.model, searchTerm)))
        .limit(10) : Promise.resolve([]),

      (type === "all" || type === "users") ? db.select().from(usersTable)
        .where(or(ilike(usersTable.username, searchTerm), ilike(usersTable.displayName, searchTerm)))
        .limit(10) : Promise.resolve([]),

      (type === "all" || type === "posts") ? db.select({ post: postsTable, author: usersTable })
        .from(postsTable)
        .innerJoin(usersTable, eq(usersTable.id, postsTable.userId))
        .where(or(ilike(postsTable.title, searchTerm), ilike(postsTable.body, searchTerm)))
        .limit(10) : Promise.resolve([]),
    ]);

    return res.json({
      cars: (cars as any[]).map((r: any) => ({
        id: r.car.id, userId: r.car.userId, make: r.car.make, model: r.car.model, year: r.car.year,
        generation: r.car.generation ?? null, trim: r.car.trim ?? null, color: r.car.color ?? null,
        mileage: r.car.mileage ?? null, transmission: r.car.transmission ?? null, engine: r.car.engine ?? null,
        mainImageUrl: r.car.mainImageUrl ?? null, ownershipStory: r.car.ownershipStory ?? null,
        isPublic: r.car.isPublic, followerCount: 0, iFollow: false,
        owner: formatUser(r.user), createdAt: r.car.createdAt,
      })),
      users: (users as any[]).map((u: any) => ({
        ...formatUser(u),
        cars: [], followerCount: 0, followingCount: 0, carCount: 0, postCount: 0, iFollowThem: false,
      })),
      posts: (posts as any[]).map((r: any) => ({
        id: r.post.id, userId: r.post.userId, carId: r.post.carId ?? null,
        title: r.post.title, body: r.post.body, category: r.post.category,
        make: r.post.make ?? null, model: r.post.model ?? null, year: r.post.year ?? null,
        generation: r.post.generation ?? null, location: r.post.location ?? null,
        tags: r.post.tags ?? [], imageUrls: r.post.imageUrls ?? [],
        likeCount: 0, commentCount: 0, isLiked: false, isSaved: false,
        author: formatUser(r.author), createdAt: r.post.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error searching");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/discover/garages
router.get("/discover/garages", async (req, res) => {
  try {
    const { sort = "recently_active", make, location, limit = "12" } = req.query as Record<string, string>;

    const users = await db.select().from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(parseInt(limit));

    return res.json(users.map(u => ({
      ...formatUser(u),
      cars: [], followerCount: 0, followingCount: 0, carCount: 0, postCount: 0, iFollowThem: false,
    })));
  } catch (err) {
    req.log.error({ err }, "Error discovering garages");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/stats/summary
router.get("/stats/summary", async (req, res) => {
  try {
    const [totalCarsResult] = await db.select({ count: sql<number>`count(*)::int` }).from(carsTable);
    const [totalUsersResult] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
    const [totalPostsResult] = await db.select({ count: sql<number>`count(*)::int` }).from(postsTable);

    const topMakesRaw = await db.select({
      make: carsTable.make,
      count: sql<number>`count(*)::int`,
    }).from(carsTable).groupBy(carsTable.make).orderBy(sql`count(*) desc`).limit(6);

    const recentCars = await db.select({ car: carsTable, user: usersTable })
      .from(carsTable)
      .innerJoin(usersTable, eq(usersTable.id, carsTable.userId))
      .where(eq(carsTable.isPublic, true))
      .orderBy(desc(carsTable.createdAt))
      .limit(6);

    const featuredGarages = await db.select().from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(4);

    return res.json({
      totalCars: totalCarsResult?.count ?? 0,
      totalUsers: totalUsersResult?.count ?? 0,
      totalPosts: totalPostsResult?.count ?? 0,
      topMakes: topMakesRaw.map(r => ({ make: r.make, count: r.count })),
      recentCars: recentCars.map(r => ({
        id: r.car.id, userId: r.car.userId, make: r.car.make, model: r.car.model, year: r.car.year,
        generation: r.car.generation ?? null, trim: r.car.trim ?? null, color: r.car.color ?? null,
        mileage: r.car.mileage ?? null, transmission: r.car.transmission ?? null, engine: r.car.engine ?? null,
        mainImageUrl: r.car.mainImageUrl ?? null, ownershipStory: r.car.ownershipStory ?? null,
        isPublic: r.car.isPublic, followerCount: 0, iFollow: false,
        owner: formatUser(r.user), createdAt: r.car.createdAt,
      })),
      featuredGarages: featuredGarages.map(u => ({
        ...formatUser(u),
        cars: [], followerCount: 0, followingCount: 0, carCount: 0, postCount: 0, iFollowThem: false,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting stats");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
