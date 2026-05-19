import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  usersTable,
  postsTable,
  eventsTable,
  carsTable,
  commentsTable,
  likesTable,
  userFollowsTable,
  carFollowsTable,
} from "@workspace/db";
import { eq, desc, sql, ne } from "drizzle-orm";

const router = Router();

async function getAdminUser(clerkId: string) {
  return db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, clerkId),
  });
}

async function requireAdmin(req: any, res: any): Promise<typeof usersTable.$inferSelect | null> {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  const user = await getAdminUser(clerkId);
  if (!user || !user.isAdmin) {
    res.status(403).json({ error: "Not authorized" });
    return null;
  }
  return user;
}

// POST /api/admin/setup — claim admin (only works when no admin exists yet)
router.post("/admin/setup", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const existingAdmin = await db.query.usersTable.findFirst({
      where: eq(usersTable.isAdmin, true),
    });
    if (existingAdmin) {
      res.status(409).json({ error: "An admin already exists" });
      return;
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, clerkId),
    });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [updated] = await db.update(usersTable)
      .set({ isAdmin: true })
      .where(eq(usersTable.id, user.id))
      .returning();

    res.json({ success: true, user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Setup failed" });
  }
});

// GET /api/admin/me — check if current user is admin
router.get("/admin/me", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, clerkId),
    });
    res.json({ isAdmin: user?.isAdmin ?? false });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/admin/users — list all users
router.get("/admin/users", requireAuth(), async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const users = await db.select({
      id: usersTable.id,
      clerkId: usersTable.clerkId,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      location: usersTable.location,
      isAdmin: usersTable.isAdmin,
      isBlocked: usersTable.isBlocked,
      createdAt: usersTable.createdAt,
      carCount: sql<number>`(select count(*)::int from cars where cars.user_id = users.id)`,
      postCount: sql<number>`(select count(*)::int from posts where posts.user_id = users.id)`,
    }).from(usersTable).orderBy(desc(usersTable.createdAt));

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// PATCH /api/admin/users/:id/block — toggle block
router.patch("/admin/users/:id/block", requireAuth(), async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const userId = Number(req.params.id);
    const { blocked } = req.body as { blocked: boolean };

    const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
    if (!target) { res.status(404).json({ error: "User not found" }); return; }
    if (target.isAdmin) { res.status(400).json({ error: "Cannot block another admin" }); return; }

    const [updated] = await db.update(usersTable)
      .set({ isBlocked: blocked })
      .where(eq(usersTable.id, userId))
      .returning();

    res.json({ success: true, user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE /api/admin/users/:id — delete user and their content
router.delete("/admin/users/:id", requireAuth(), async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const userId = Number(req.params.id);
    const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
    if (!target) { res.status(404).json({ error: "User not found" }); return; }
    if (target.isAdmin) { res.status(400).json({ error: "Cannot delete another admin" }); return; }

    // Delete in dependency order
    await db.delete(likesTable).where(eq(likesTable.userId, userId));
    await db.delete(commentsTable).where(eq(commentsTable.userId, userId));
    await db.delete(userFollowsTable).where(eq(userFollowsTable.followerId, userId));
    await db.delete(userFollowsTable).where(eq(userFollowsTable.followingId, userId));
    await db.delete(carFollowsTable).where(eq(carFollowsTable.userId, userId));
    await db.delete(carsTable).where(eq(carsTable.userId, userId));
    await db.delete(postsTable).where(eq(postsTable.userId, userId));
    await db.delete(eventsTable).where(eq(eventsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// GET /api/admin/posts — list all posts
router.get("/admin/posts", requireAuth(), async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const posts = await db.select({
      id: postsTable.id,
      title: postsTable.title,
      body: postsTable.body,
      category: postsTable.category,
      createdAt: postsTable.createdAt,
      userId: postsTable.userId,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    })
      .from(postsTable)
      .innerJoin(usersTable, eq(usersTable.id, postsTable.userId))
      .orderBy(desc(postsTable.createdAt));

    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// DELETE /api/admin/posts/:id
router.delete("/admin/posts/:id", requireAuth(), async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const postId = Number(req.params.id);
    await db.delete(likesTable).where(eq(likesTable.postId, postId));
    await db.delete(commentsTable).where(eq(commentsTable.postId, postId));
    await db.delete(postsTable).where(eq(postsTable.id, postId));

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// GET /api/admin/events — list all events
router.get("/admin/events", requireAuth(), async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const events = await db.select({
      id: eventsTable.id,
      title: eventsTable.title,
      description: eventsTable.description,
      type: eventsTable.type,
      date: eventsTable.date,
      location: eventsTable.location,
      createdAt: eventsTable.createdAt,
      userId: eventsTable.userId,
      username: usersTable.username,
      displayName: usersTable.displayName,
    })
      .from(eventsTable)
      .innerJoin(usersTable, eq(usersTable.id, eventsTable.userId))
      .orderBy(desc(eventsTable.date));

    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// DELETE /api/admin/events/:id
router.delete("/admin/events/:id", requireAuth(), async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const eventId = Number(req.params.id);
    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

export default router;
