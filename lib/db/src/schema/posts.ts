import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { carsTable } from "./cars";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  carId: integer("car_id").references(() => carsTable.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull().default("general"),
  make: text("make"),
  model: text("model"),
  year: integer("year"),
  generation: text("generation"),
  location: text("location"),
  tags: text("tags").array(),
  imageUrls: text("image_urls").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  parentId: integer("parent_id"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommentSchema = createInsertSchema(commentsTable).omit({ id: true, createdAt: true });
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof commentsTable.$inferSelect;

export const likesTable = pgTable("likes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  postId: integer("post_id").references(() => postsTable.id),
  commentId: integer("comment_id").references(() => commentsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Like = typeof likesTable.$inferSelect;

export const savedPostsTable = pgTable("saved_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  postId: integer("post_id").notNull().references(() => postsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SavedPost = typeof savedPostsTable.$inferSelect;

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  actorId: integer("actor_id").references(() => usersTable.id),
  type: text("type").notNull(),
  postId: integer("post_id").references(() => postsTable.id),
  carId: integer("car_id").references(() => carsTable.id),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
