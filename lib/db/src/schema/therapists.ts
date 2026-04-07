import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const therapistsTable = pgTable("therapists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  specialty: text("specialty").notNull(),
  phone: text("phone").notNull(),
  availableHours: text("available_hours"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTherapistSchema = createInsertSchema(therapistsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTherapist = z.infer<typeof insertTherapistSchema>;
export type Therapist = typeof therapistsTable.$inferSelect;
