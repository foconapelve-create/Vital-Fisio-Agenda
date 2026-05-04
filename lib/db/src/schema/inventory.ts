import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";

export const inventoryItemsTable = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("geral"),
  currentQty: real("current_qty").notNull().default(0),
  unit: text("unit").notNull().default("unidade"),
  minQty: real("min_qty").notNull().default(0),
  supplier: text("supplier"),
  unitCost: real("unit_cost"),
  expiryDate: text("expiry_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const inventoryMovementsTable = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => inventoryItemsTable.id),
  type: text("type").notNull(),
  qty: real("qty").notNull(),
  responsavel: text("responsavel"),
  notes: text("notes"),
  date: text("date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
