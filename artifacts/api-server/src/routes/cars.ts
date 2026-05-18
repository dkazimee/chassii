import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  usersTable,
  carsTable,
  carFollowsTable,
  carModsTable,
  timelineEntriesTable,
} from "@workspace/db";
import { eq, and, sql, desc, ilike, or } from "drizzle-orm";
import { getOrCreateUser, formatUser } from "./users";

const router = Router();

async function getCarFollowerCount(carId: number) {
  const [r] = await db.select({ count: sql<number>`count(*)::int` })
    .from(carFollowsTable).where(eq(carFollowsTable.carId, carId));
  return r?.count ?? 0;
}

async function isFollowingCar(userId: number, carId: number) {
  const f = await db.query.carFollowsTable.findFirst({
    where: and(eq(carFollowsTable.userId, userId), eq(carFollowsTable.carId, carId)),
  });
  return !!f;
}

function formatCar(c: typeof carsTable.$inferSelect, owner: typeof usersTable.$inferSelect, followerCount = 0, iFollow = false) {
  return {
    id: c.id, userId: c.userId, make: c.make, model: c.model, year: c.year,
    generation: c.generation ?? null, trim: c.trim ?? null, color: c.color ?? null,
    mileage: c.mileage ?? null, transmission: c.transmission ?? null, engine: c.engine ?? null,
    mainImageUrl: c.mainImageUrl ?? null, ownershipStory: c.ownershipStory ?? null,
    isPublic: c.isPublic, followerCount, iFollow, owner: formatUser(owner),
    createdAt: c.createdAt,
  };
}

// GET /api/cars
router.get("/cars", async (req, res) => {
  try {
    const { make, model, year, generation, location, sort, limit = "20", offset = "0" } = req.query as Record<string, string>;

    let query = db.select({ car: carsTable, user: usersTable })
      .from(carsTable)
      .innerJoin(usersTable, eq(usersTable.id, carsTable.userId))
      .where(eq(carsTable.isPublic, true));

    const cars = await db.select({ car: carsTable, user: usersTable })
      .from(carsTable)
      .innerJoin(usersTable, eq(usersTable.id, carsTable.userId))
      .where(eq(carsTable.isPublic, true))
      .orderBy(desc(carsTable.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    return res.json(await Promise.all(cars.map(async r => {
      const followerCount = await getCarFollowerCount(r.car.id);
      return formatCar(r.car, r.user, followerCount);
    })));
  } catch (err) {
    req.log.error({ err }, "Error listing cars");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cars
router.post("/cars", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);

    const { make, model, year, generation, trim, color, mileage, transmission, engine, mainImageUrl, ownershipStory, isPublic } = req.body;
    const [car] = await db.insert(carsTable).values({
      userId: me.id, make, model, year: parseInt(year), generation, trim, color,
      mileage: mileage ? parseInt(mileage) : undefined,
      transmission, engine, mainImageUrl, ownershipStory,
      isPublic: isPublic ?? true,
    }).returning();

    return res.status(201).json(formatCar(car, me, 0, false));
  } catch (err) {
    req.log.error({ err }, "Error creating car");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/cars/:carId
router.get("/cars/:carId", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId);
    const { userId: clerkId } = getAuth(req);

    const result = await db.select({ car: carsTable, user: usersTable })
      .from(carsTable)
      .innerJoin(usersTable, eq(usersTable.id, carsTable.userId))
      .where(eq(carsTable.id, carId))
      .limit(1);

    if (!result.length) return res.status(404).json({ error: "Car not found" });
    const { car, user } = result[0];

    const followerCount = await getCarFollowerCount(carId);
    let iFollow = false;
    if (clerkId) {
      const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
      if (me) iFollow = await isFollowingCar(me.id, carId);
    }

    const mods = await db.select().from(carModsTable).where(eq(carModsTable.carId, carId)).orderBy(desc(carModsTable.createdAt));
    const timeline = await db.select({ entry: timelineEntriesTable, author: usersTable })
      .from(timelineEntriesTable)
      .innerJoin(usersTable, eq(usersTable.id, timelineEntriesTable.userId))
      .where(eq(timelineEntriesTable.carId, carId))
      .orderBy(desc(timelineEntriesTable.createdAt));

    return res.json({
      ...formatCar(car, user, followerCount, iFollow),
      mods: mods.map(m => ({
        id: m.id, carId: m.carId, name: m.name, category: m.category,
        brand: m.brand ?? null, notes: m.notes ?? null, installedAt: m.installedAt ?? null,
        createdAt: m.createdAt,
      })),
      timeline: timeline.map(t => ({
        id: t.entry.id, carId: t.entry.carId, userId: t.entry.userId,
        type: t.entry.type, title: t.entry.title, body: t.entry.body ?? null,
        imageUrls: t.entry.imageUrls ?? [],
        author: formatUser(t.author), createdAt: t.entry.createdAt,
      })),
      photos: [],
    });
  } catch (err) {
    req.log.error({ err }, "Error getting car");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/cars/:carId
router.patch("/cars/:carId", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const carId = parseInt(req.params.carId);

    const car = await db.query.carsTable.findFirst({ where: and(eq(carsTable.id, carId), eq(carsTable.userId, me.id)) });
    if (!car) return res.status(404).json({ error: "Car not found" });

    const { make, model, year, generation, trim, color, mileage, transmission, engine, mainImageUrl, ownershipStory, isPublic } = req.body;
    const [updated] = await db.update(carsTable)
      .set({ make, model, year, generation, trim, color, mileage, transmission, engine, mainImageUrl, ownershipStory, isPublic })
      .where(eq(carsTable.id, carId))
      .returning();

    const followerCount = await getCarFollowerCount(carId);
    return res.json(formatCar(updated, me, followerCount, false));
  } catch (err) {
    req.log.error({ err }, "Error updating car");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/cars/:carId
router.delete("/cars/:carId", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const carId = parseInt(req.params.carId);

    await db.delete(carsTable).where(and(eq(carsTable.id, carId), eq(carsTable.userId, me.id)));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting car");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cars/:carId/follow
router.post("/cars/:carId/follow", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const carId = parseInt(req.params.carId);

    const existing = await db.query.carFollowsTable.findFirst({
      where: and(eq(carFollowsTable.userId, me.id), eq(carFollowsTable.carId, carId)),
    });
    if (!existing) {
      await db.insert(carFollowsTable).values({ userId: me.id, carId });
    }
    return res.json({ following: true });
  } catch (err) {
    req.log.error({ err }, "Error following car");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/cars/:carId/follow
router.delete("/cars/:carId/follow", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const carId = parseInt(req.params.carId);

    await db.delete(carFollowsTable).where(and(eq(carFollowsTable.userId, me.id), eq(carFollowsTable.carId, carId)));
    return res.json({ following: false });
  } catch (err) {
    req.log.error({ err }, "Error unfollowing car");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/cars/:carId/mods
router.get("/cars/:carId/mods", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId);
    const mods = await db.select().from(carModsTable).where(eq(carModsTable.carId, carId)).orderBy(desc(carModsTable.createdAt));
    return res.json(mods.map(m => ({
      id: m.id, carId: m.carId, name: m.name, category: m.category,
      brand: m.brand ?? null, notes: m.notes ?? null, installedAt: m.installedAt ?? null,
      createdAt: m.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Error getting mods");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cars/:carId/mods
router.post("/cars/:carId/mods", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const carId = parseInt(req.params.carId);

    const car = await db.query.carsTable.findFirst({ where: and(eq(carsTable.id, carId), eq(carsTable.userId, me.id)) });
    if (!car) return res.status(404).json({ error: "Car not found" });

    const { name, category, brand, notes, installedAt } = req.body;
    const [mod] = await db.insert(carModsTable).values({ carId, name, category, brand, notes, installedAt }).returning();

    return res.status(201).json({
      id: mod.id, carId: mod.carId, name: mod.name, category: mod.category,
      brand: mod.brand ?? null, notes: mod.notes ?? null, installedAt: mod.installedAt ?? null,
      createdAt: mod.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Error adding mod");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/cars/:carId/timeline
router.get("/cars/:carId/timeline", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId);
    const timeline = await db.select({ entry: timelineEntriesTable, author: usersTable })
      .from(timelineEntriesTable)
      .innerJoin(usersTable, eq(usersTable.id, timelineEntriesTable.userId))
      .where(eq(timelineEntriesTable.carId, carId))
      .orderBy(desc(timelineEntriesTable.createdAt));

    return res.json(timeline.map(t => ({
      id: t.entry.id, carId: t.entry.carId, userId: t.entry.userId,
      type: t.entry.type, title: t.entry.title, body: t.entry.body ?? null,
      imageUrls: t.entry.imageUrls ?? [],
      author: formatUser(t.author), createdAt: t.entry.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Error getting timeline");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cars/:carId/timeline
router.post("/cars/:carId/timeline", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    const me = await getOrCreateUser(clerkId);
    const carId = parseInt(req.params.carId);

    const car = await db.query.carsTable.findFirst({ where: and(eq(carsTable.id, carId), eq(carsTable.userId, me.id)) });
    if (!car) return res.status(404).json({ error: "Car not found" });

    const { type, title, body, imageUrls } = req.body;
    const [entry] = await db.insert(timelineEntriesTable).values({
      carId, userId: me.id, type, title, body, imageUrls: imageUrls || [],
    }).returning();

    return res.status(201).json({
      id: entry.id, carId: entry.carId, userId: entry.userId,
      type: entry.type, title: entry.title, body: entry.body ?? null,
      imageUrls: entry.imageUrls ?? [],
      author: formatUser(me), createdAt: entry.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Error adding timeline entry");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/cars/:carId/similar
router.get("/cars/:carId/similar", async (req, res) => {
  try {
    const carId = parseInt(req.params.carId);
    const car = await db.query.carsTable.findFirst({ where: eq(carsTable.id, carId) });
    if (!car) return res.status(404).json({ error: "Car not found" });

    const similar = await db.select({ car: carsTable, user: usersTable })
      .from(carsTable)
      .innerJoin(usersTable, eq(usersTable.id, carsTable.userId))
      .where(and(
        eq(carsTable.make, car.make),
        eq(carsTable.model, car.model),
        eq(carsTable.isPublic, true),
      ))
      .limit(6);

    return res.json(similar
      .filter(r => r.car.id !== carId)
      .map(r => formatCar(r.car, r.user))
    );
  } catch (err) {
    req.log.error({ err }, "Error getting similar cars");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
