import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const financialTable = pgTable("financial", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  type: text("type").notNull().default("receita"),
  amount: real("amount").notNull(),
  paymentStatus: text("payment_status").notNull().default("pendente"),
  category: text("category"),
  supplier: text("supplier"),
  dueDate: text("due_date"),
  paymentDate: text("payment_date"),
  patientId: integer("patient_id").references(() => patientsTable.id),
  paymentMethod: text("payment_method"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type FinancialRecord = typeof financialTable.$inferSelect;
