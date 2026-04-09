import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const patientsTable = pgTable("patients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  birthDate: text("birth_date"),
  insuranceType: text("insurance_type").notNull().default("particular"),
  insuranceName: text("insurance_name"),
  paymentMethod: text("payment_method"),
  totalSessions: integer("total_sessions").notNull().default(0),
  remainingSessions: integer("remaining_sessions").notNull().default(0),
  amountPaid: real("amount_paid"),
  zipCode: text("zip_code"),
  addressStreet: text("address_street"),
  addressNumber: text("address_number"),
  addressComplement: text("address_complement"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"),
  notes: text("notes"),
  adhesionProfile: text("adhesion_profile"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
