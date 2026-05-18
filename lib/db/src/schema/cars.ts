import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const carsTable = pgTable("cars", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  make: text("make").notNull(),
  model: text("model").notNull(),
  year: integer("year").notNull(),
  generation: text("generation"),
  trim: text("trim"),
  color: text("color"),
  mileage: integer("mileage"),
  transmission: text("transmission"),
  engine: text("engine"),
  vin: text("vin"),
  mainImageUrl: text("main_image_url"),
  ownershipStory: text("ownership_story"),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCarSchema = createInsertSchema(carsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCar = z.infer<typeof insertCarSchema>;
export type Car = typeof carsTable.$inferSelect;

export const carFollowsTable = pgTable("car_follows", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  carId: integer("car_id").notNull().references(() => carsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CarFollow = typeof carFollowsTable.$inferSelect;

export const carPhotosTable = pgTable("car_photos", {
  id: serial("id").primaryKey(),
  carId: integer("car_id").notNull().references(() => carsTable.id),
  url: text("url").notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CarPhoto = typeof carPhotosTable.$inferSelect;

export const carModsTable = pgTable("car_mods", {
  id: serial("id").primaryKey(),
  carId: integer("car_id").notNull().references(() => carsTable.id),
  name: text("name").notNull(),
  category: text("category").notNull(),
  brand: text("brand"),
  notes: text("notes"),
  installedAt: text("installed_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCarModSchema = createInsertSchema(carModsTable).omit({ id: true, createdAt: true });
export type InsertCarMod = z.infer<typeof insertCarModSchema>;
export type CarMod = typeof carModsTable.$inferSelect;

export const timelineEntriesTable = pgTable("timeline_entries", {
  id: serial("id").primaryKey(),
  carId: integer("car_id").notNull().references(() => carsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  imageUrls: text("image_urls").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTimelineEntrySchema = createInsertSchema(timelineEntriesTable).omit({ id: true, createdAt: true });
export type InsertTimelineEntry = z.infer<typeof insertTimelineEntrySchema>;
export type TimelineEntry = typeof timelineEntriesTable.$inferSelect;
