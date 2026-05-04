import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

// ── Ensure tables exist ──────────────────────────────────────────────────────
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'geral',
      current_qty REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'unidade',
      min_qty REAL NOT NULL DEFAULT 0,
      supplier TEXT,
      unit_cost REAL,
      expiry_date TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      qty REAL NOT NULL,
      responsavel TEXT,
      notes TEXT,
      date TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
ensureTables().catch(console.error);

// ── Summary ───────────────────────────────────────────────────────────────────
router.get("/inventory/summary", requireAuth, async (_req, res): Promise<void> => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE current_qty <= min_qty) AS low_stock,
        COUNT(*) FILTER (WHERE expiry_date IS NOT NULL AND expiry_date <= to_char(NOW() + INTERVAL '30 days','YYYY-MM-DD')) AS expiring_soon,
        COALESCE(SUM(current_qty * unit_cost) FILTER (WHERE unit_cost IS NOT NULL), 0) AS total_value
      FROM inventory_items
    `);
    const r = rows[0];
    res.json({
      total: parseInt(r.total) || 0,
      lowStock: parseInt(r.low_stock) || 0,
      expiringSoon: parseInt(r.expiring_soon) || 0,
      totalValue: parseFloat(r.total_value) || 0,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── List items ─────────────────────────────────────────────────────────────────
router.get("/inventory/items", requireAuth, async (req, res): Promise<void> => {
  try {
    const { filter } = req.query as any;
    let where = "";
    if (filter === "low_stock") where = "WHERE current_qty <= min_qty";
    else if (filter === "expiring")
      where = `WHERE expiry_date IS NOT NULL AND expiry_date <= to_char(NOW() + INTERVAL '30 days','YYYY-MM-DD')`;
    else if (filter === "expired")
      where = `WHERE expiry_date IS NOT NULL AND expiry_date < to_char(NOW(),'YYYY-MM-DD')`;
    const { rows } = await pool.query(`SELECT * FROM inventory_items ${where} ORDER BY name ASC`);
    res.json(rows.map(r => ({
      id: r.id, name: r.name, category: r.category,
      currentQty: r.current_qty, unit: r.unit, minQty: r.min_qty,
      supplier: r.supplier, unitCost: r.unit_cost, expiryDate: r.expiry_date,
      notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at,
      isLowStock: r.current_qty <= r.min_qty,
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Create item ────────────────────────────────────────────────────────────────
router.post("/inventory/items", requireAuth, async (req, res): Promise<void> => {
  const { name, category, currentQty, unit, minQty, supplier, unitCost, expiryDate, notes } = req.body || {};
  if (!name?.trim()) { res.status(400).json({ error: "Nome é obrigatório" }); return; }
  try {
    const { rows } = await pool.query(
      `INSERT INTO inventory_items (name, category, current_qty, unit, min_qty, supplier, unit_cost, expiry_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name.trim(), category || "geral", parseFloat(currentQty) || 0, unit || "unidade",
       parseFloat(minQty) || 0, supplier || null, unitCost ? parseFloat(unitCost) : null,
       expiryDate || null, notes || null]
    );
    const r = rows[0];
    res.status(201).json({ id: r.id, name: r.name, category: r.category, currentQty: r.current_qty, unit: r.unit, minQty: r.min_qty, supplier: r.supplier, unitCost: r.unit_cost, expiryDate: r.expiry_date, notes: r.notes });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Update item ────────────────────────────────────────────────────────────────
router.put("/inventory/items/:id", requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { name, category, currentQty, unit, minQty, supplier, unitCost, expiryDate, notes } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE inventory_items SET name=$1, category=$2, current_qty=$3, unit=$4, min_qty=$5,
       supplier=$6, unit_cost=$7, expiry_date=$8, notes=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [name, category || "geral", parseFloat(currentQty) || 0, unit || "unidade",
       parseFloat(minQty) || 0, supplier || null, unitCost ? parseFloat(unitCost) : null,
       expiryDate || null, notes || null, id]
    );
    if (!rows.length) { res.status(404).json({ error: "Item não encontrado" }); return; }
    const r = rows[0];
    res.json({ id: r.id, name: r.name, category: r.category, currentQty: r.current_qty, unit: r.unit, minQty: r.min_qty, supplier: r.supplier, unitCost: r.unit_cost, expiryDate: r.expiry_date, notes: r.notes });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Delete item ────────────────────────────────────────────────────────────────
router.delete("/inventory/items/:id", requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM inventory_items WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── List movements ─────────────────────────────────────────────────────────────
router.get("/inventory/movements", requireAuth, async (req, res): Promise<void> => {
  try {
    const { itemId } = req.query as any;
    const where = itemId ? `WHERE m.item_id = ${parseInt(itemId)}` : "";
    const { rows } = await pool.query(`
      SELECT m.*, i.name AS item_name, i.unit
      FROM inventory_movements m
      JOIN inventory_items i ON i.id = m.item_id
      ${where}
      ORDER BY m.created_at DESC LIMIT 200
    `);
    res.json(rows.map(r => ({
      id: r.id, itemId: r.item_id, itemName: r.item_name, unit: r.unit,
      type: r.type, qty: r.qty, responsavel: r.responsavel,
      notes: r.notes, date: r.date, createdAt: r.created_at,
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Register movement (entry or exit) ─────────────────────────────────────────
router.post("/inventory/movements", requireAuth, async (req, res): Promise<void> => {
  const { itemId, type, qty, responsavel, notes, date } = req.body || {};
  if (!itemId || !type || !qty || !date) {
    res.status(400).json({ error: "Campos obrigatórios: itemId, type, qty, date" }); return;
  }
  const parsedQty = parseFloat(qty);
  if (parsedQty <= 0) { res.status(400).json({ error: "Quantidade deve ser maior que zero" }); return; }
  const delta = type === "entrada" ? parsedQty : -parsedQty;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: itemRows } = await client.query("SELECT current_qty FROM inventory_items WHERE id=$1 FOR UPDATE", [itemId]);
    if (!itemRows.length) { await client.query("ROLLBACK"); res.status(404).json({ error: "Item não encontrado" }); return; }
    const newQty = itemRows[0].current_qty + delta;
    if (newQty < 0) { await client.query("ROLLBACK"); res.status(400).json({ error: "Quantidade insuficiente em estoque" }); return; }
    await client.query("UPDATE inventory_items SET current_qty=$1, updated_at=NOW() WHERE id=$2", [newQty, itemId]);
    const { rows } = await client.query(
      `INSERT INTO inventory_movements (item_id, type, qty, responsavel, notes, date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [itemId, type, parsedQty, responsavel || null, notes || null, date]
    );
    await client.query("COMMIT");
    res.status(201).json({ ...rows[0], newQty });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

export default router;
