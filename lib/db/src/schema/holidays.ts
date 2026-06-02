import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const holidaysTable = pgTable("holidays", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull().default("Nacional"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Holiday = typeof holidaysTable.$inferSelect;
