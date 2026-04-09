import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { appointmentsTable } from "./appointments";

export const appointmentContactsTable = pgTable("appointment_contacts", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").notNull().references(() => appointmentsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  content: text("content"),
  performedBy: text("performed_by").default("sistema"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppointmentContact = typeof appointmentContactsTable.$inferSelect;
