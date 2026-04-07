import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";
import { therapistsTable } from "./therapists";
import { appointmentsTable } from "./appointments";

export const evolutionsTable = pgTable("evolutions", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  therapistId: integer("therapist_id").notNull().references(() => therapistsTable.id),
  appointmentId: integer("appointment_id").references(() => appointmentsTable.id),
  date: text("date").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type EvolutionRecord = typeof evolutionsTable.$inferSelect;
