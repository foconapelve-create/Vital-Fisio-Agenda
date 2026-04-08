import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { therapistsTable } from "./therapists";

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  therapistId: integer("therapist_id").notNull().references(() => therapistsTable.id),
  date: text("date").notNull(),
  time: text("time").notNull(),
  status: text("status").notNull().default("agendado"),
  notes: text("notes"),
  originalAppointmentId: integer("original_appointment_id"),
  recurringGroupId: text("recurring_group_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type AppointmentRecord = typeof appointmentsTable.$inferSelect;
