import { Router } from "express";
import { db } from "@workspace/db";
import { patientsTable } from "@workspace/db/schema";
import { sql, and } from "drizzle-orm";
import { pool } from "@workspace/db";

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  next();
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const router = Router();

// ── Get today's and this month's birthdays ─────────────────────────────────

router.get("/birthdays/today", requireAuth, async (req, res) => {
  try {
    const today = todayStr();
    const mm = today.slice(5, 7);
    const dd = today.slice(8, 10);

    const rows = await db
      .select()
      .from(patientsTable)
      .where(
        and(
          sql`birth_date IS NOT NULL`,
          sql`birth_date != ''`,
          sql`SUBSTRING(birth_date, 6, 2) = ${mm}`,
          sql`SUBSTRING(birth_date, 9, 2) = ${dd}`
        )
      )
      .orderBy(patientsTable.name);

    // Enrich with last appointment and next appointment
    const enriched = await enrichPatients(rows, today);
    return res.json(enriched);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/birthdays/month", requireAuth, async (req, res) => {
  try {
    const today = todayStr();
    const mm = today.slice(5, 7);

    const rows = await db
      .select()
      .from(patientsTable)
      .where(
        and(
          sql`birth_date IS NOT NULL`,
          sql`birth_date != ''`,
          sql`SUBSTRING(birth_date, 6, 2) = ${mm}`
        )
      )
      .orderBy(sql`CAST(SUBSTRING(birth_date, 9, 2) AS INTEGER)`);

    const enriched = await enrichPatients(rows, today);
    return res.json(enriched);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Birthday Actions ─────────────────────────────────────────────────────────

router.get("/birthday-actions", requireAuth, async (req, res) => {
  try {
    const { patientId } = req.query;
    let query = `SELECT ba.*, p.name as patient_name FROM birthday_actions ba
      LEFT JOIN patients p ON p.id = ba.patient_id
      WHERE 1=1`;
    const params: any[] = [];
    if (patientId) {
      params.push(parseInt(patientId as string));
      query += ` AND ba.patient_id = $${params.length}`;
    }
    query += " ORDER BY ba.created_at DESC LIMIT 200";
    const { rows } = await pool.query(query, params);
    return res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/birthday-actions", requireAuth, async (req, res) => {
  try {
    const user = (req as any).session;
    const {
      patientId, actionType, messageSent, discountValue, discountType,
      discountExpiry, discountNotes, actionDate, actionTime, performedBy,
    } = req.body;

    const today = todayStr();
    const now = nowTime();

    const { rows } = await pool.query(
      `INSERT INTO birthday_actions (patient_id, action_type, message_sent, discount_value, discount_type, discount_expiry, discount_notes, performed_by, action_date, action_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        parseInt(patientId), actionType, messageSent || null,
        discountValue || null, discountType || null,
        discountExpiry || null, discountNotes || null,
        performedBy || null, actionDate || today, actionTime || now,
      ]
    );
    return res.status(201).json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Birthday Settings ─────────────────────────────────────────────────────────

function mapSettings(r: any) {
  if (!r) return r;
  return {
    id: r.id,
    messageTemplate: r.message_template,
    discountDefaultPercent: r.discount_default_percent,
    discountDefaultValue: r.discount_default_value,
    discountDefaultType: r.discount_default_type,
    discountDefaultExpiryDays: r.discount_default_expiry_days,
    updatedAt: r.updated_at,
  };
}

router.get("/birthday-settings", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM birthday_settings WHERE id = 1");
    if (!rows.length) {
      const { rows: created } = await pool.query(
        "INSERT INTO birthday_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING RETURNING *"
      );
      return res.json(mapSettings(created[0]) || {});
    }
    return res.json(mapSettings(rows[0]));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/birthday-settings", requireAuth, async (req, res) => {
  try {
    const user = (req as any).session;
    const {
      messageTemplate, discountDefaultPercent, discountDefaultValue,
      discountDefaultType, discountDefaultExpiryDays,
    } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO birthday_settings (id, message_template, discount_default_percent, discount_default_value, discount_default_type, discount_default_expiry_days, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET
         message_template = EXCLUDED.message_template,
         discount_default_percent = EXCLUDED.discount_default_percent,
         discount_default_value = EXCLUDED.discount_default_value,
         discount_default_type = EXCLUDED.discount_default_type,
         discount_default_expiry_days = EXCLUDED.discount_default_expiry_days,
         updated_at = NOW()
       RETURNING *`,
      [messageTemplate, discountDefaultPercent || 10, discountDefaultValue || null, discountDefaultType || "percent", discountDefaultExpiryDays || 30]
    );
    return res.json(mapSettings(rows[0]));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Check if action done today ─────────────────────────────────────────────

router.get("/birthday-actions/today-check/:patientId", requireAuth, async (req, res) => {
  try {
    const today = todayStr();
    const { rows } = await pool.query(
      "SELECT action_type FROM birthday_actions WHERE patient_id = $1 AND action_date = $2",
      [parseInt(req.params.patientId), today]
    );
    const types = rows.map((r: any) => r.action_type);
    return res.json({
      congratsSent: types.includes("congratulations"),
      discountOffered: types.includes("discount"),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function enrichPatients(patients: any[], today: string) {
  if (!patients.length) return [];

  const ids = patients.map(p => p.id);

  // Last appointments
  const { rows: lastAppts } = await pool.query(
    `SELECT DISTINCT ON (patient_id) patient_id, date, time, status
     FROM appointments
     WHERE patient_id = ANY($1) AND date <= $2
     ORDER BY patient_id, date DESC, time DESC`,
    [ids, today]
  );

  // Next appointments
  const { rows: nextAppts } = await pool.query(
    `SELECT DISTINCT ON (patient_id) patient_id, date, time, status
     FROM appointments
     WHERE patient_id = ANY($1) AND date >= $2
       AND status NOT IN ('cancelado','falta','desmarcado')
     ORDER BY patient_id, date ASC, time ASC`,
    [ids, today]
  );

  // Today's actions
  const { rows: actions } = await pool.query(
    `SELECT patient_id, action_type FROM birthday_actions
     WHERE patient_id = ANY($1) AND action_date = $2`,
    [ids, today]
  );

  const lastMap = Object.fromEntries(lastAppts.map((a: any) => [a.patient_id, a]));
  const nextMap = Object.fromEntries(nextAppts.map((a: any) => [a.patient_id, a]));
  const actionMap: Record<number, Set<string>> = {};
  for (const a of actions as any[]) {
    if (!actionMap[a.patient_id]) actionMap[a.patient_id] = new Set();
    actionMap[a.patient_id].add(a.action_type);
  }

  const currentYear = new Date().getFullYear();

  return patients.map(p => {
    const birthYear = p.birthDate ? parseInt(p.birthDate.slice(0, 4)) : null;
    const age = birthYear ? currentYear - birthYear : null;
    return {
      ...p,
      age,
      lastAppointment: lastMap[p.id] || null,
      nextAppointment: nextMap[p.id] || null,
      congratsSent: !!(actionMap[p.id]?.has("congratulations")),
      discountOffered: !!(actionMap[p.id]?.has("discount")),
    };
  });
}

export default router;
