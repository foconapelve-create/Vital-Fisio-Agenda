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

// ── Birthday Stats ─────────────────────────────────────────────────────────

router.get("/birthday-actions/stats", requireAuth, async (req, res) => {
  try {
    const today = todayStr();
    const mm = today.slice(5, 7);
    const dd = today.slice(8, 10);

    // Count WhatsApp and email sent today
    const { rows: actionStats } = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE channel = 'whatsapp' AND action_type = 'congratulations') as whatsapp_sent,
        COUNT(*) FILTER (WHERE channel = 'email' AND action_type = 'congratulations') as email_sent
       FROM birthday_actions
       WHERE action_date = $1`,
      [today]
    );

    // Count total birthday patients today
    const { rows: totalToday } = await pool.query(
      `SELECT COUNT(*) as total FROM patients
       WHERE birth_date IS NOT NULL AND birth_date != ''
         AND SUBSTRING(birth_date, 6, 2) = $1
         AND SUBSTRING(birth_date, 9, 2) = $2`,
      [mm, dd]
    );

    // Count how many have NOT been contacted today (by either channel)
    const { rows: contacted } = await pool.query(
      `SELECT COUNT(DISTINCT patient_id) as contacted FROM birthday_actions
       WHERE action_date = $1 AND action_type = 'congratulations'`,
      [today]
    );

    const total = parseInt(totalToday[0]?.total || "0");
    const contactedCount = parseInt(contacted[0]?.contacted || "0");

    return res.json({
      whatsappSentToday: parseInt(actionStats[0]?.whatsapp_sent || "0"),
      emailSentToday: parseInt(actionStats[0]?.email_sent || "0"),
      pendingToday: Math.max(0, total - contactedCount),
      totalToday: total,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Birthday Actions ─────────────────────────────────────────────────────────

router.get("/birthday-actions", requireAuth, async (req, res) => {
  try {
    const { patientId, channel } = req.query;
    let query = `SELECT ba.*, p.name as patient_name FROM birthday_actions ba
      LEFT JOIN patients p ON p.id = ba.patient_id
      WHERE 1=1`;
    const params: any[] = [];
    if (patientId) {
      params.push(parseInt(patientId as string));
      query += ` AND ba.patient_id = $${params.length}`;
    }
    if (channel) {
      params.push(channel);
      query += ` AND ba.channel = $${params.length}`;
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
    const {
      patientId, actionType, messageSent, discountValue, discountType,
      discountExpiry, discountNotes, actionDate, actionTime, performedBy,
      channel, messageType,
    } = req.body;

    const today = todayStr();
    const now = nowTime();

    const { rows } = await pool.query(
      `INSERT INTO birthday_actions (patient_id, action_type, message_sent, discount_value, discount_type, discount_expiry, discount_notes, performed_by, action_date, action_time, channel, message_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        parseInt(patientId), actionType, messageSent || null,
        discountValue || null, discountType || null,
        discountExpiry || null, discountNotes || null,
        performedBy || null, actionDate || today, actionTime || now,
        channel || "whatsapp", messageType || "dia",
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
    emailSubject: r.email_subject,
    emailTemplateDay: r.email_template_day,
    emailTemplateMonth: r.email_template_month,
    whatsappTemplateMonth: r.whatsapp_template_month,
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
    const {
      messageTemplate, emailSubject, emailTemplateDay, emailTemplateMonth,
      whatsappTemplateMonth, discountDefaultPercent, discountDefaultValue,
      discountDefaultType, discountDefaultExpiryDays,
    } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO birthday_settings (id, message_template, email_subject, email_template_day, email_template_month, whatsapp_template_month,
         discount_default_percent, discount_default_value, discount_default_type, discount_default_expiry_days, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (id) DO UPDATE SET
         message_template = EXCLUDED.message_template,
         email_subject = EXCLUDED.email_subject,
         email_template_day = EXCLUDED.email_template_day,
         email_template_month = EXCLUDED.email_template_month,
         whatsapp_template_month = EXCLUDED.whatsapp_template_month,
         discount_default_percent = EXCLUDED.discount_default_percent,
         discount_default_value = EXCLUDED.discount_default_value,
         discount_default_type = EXCLUDED.discount_default_type,
         discount_default_expiry_days = EXCLUDED.discount_default_expiry_days,
         updated_at = NOW()
       RETURNING *`,
      [messageTemplate, emailSubject, emailTemplateDay, emailTemplateMonth, whatsappTemplateMonth,
       discountDefaultPercent || 10, discountDefaultValue || null, discountDefaultType || "percent", discountDefaultExpiryDays || 30]
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
      "SELECT action_type, channel FROM birthday_actions WHERE patient_id = $1 AND action_date = $2",
      [parseInt(req.params.patientId), today]
    );
    const whatsappSent = rows.some((r: any) => r.action_type === "congratulations" && r.channel === "whatsapp");
    const emailSent = rows.some((r: any) => r.action_type === "congratulations" && r.channel === "email");
    const discountOffered = rows.some((r: any) => r.action_type === "discount");
    return res.json({ whatsappSent, emailSent, discountOffered });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function enrichPatients(patients: any[], today: string) {
  if (!patients.length) return [];

  const ids = patients.map(p => p.id);

  const { rows: lastAppts } = await pool.query(
    `SELECT DISTINCT ON (patient_id) patient_id, date, time, status
     FROM appointments
     WHERE patient_id = ANY($1) AND date <= $2
     ORDER BY patient_id, date DESC, time DESC`,
    [ids, today]
  );

  const { rows: nextAppts } = await pool.query(
    `SELECT DISTINCT ON (patient_id) patient_id, date, time, status
     FROM appointments
     WHERE patient_id = ANY($1) AND date >= $2
       AND status NOT IN ('cancelado','falta','desmarcado')
     ORDER BY patient_id, date ASC, time ASC`,
    [ids, today]
  );

  const { rows: actions } = await pool.query(
    `SELECT patient_id, action_type, channel FROM birthday_actions
     WHERE patient_id = ANY($1) AND action_date = $2`,
    [ids, today]
  );

  const lastMap = Object.fromEntries(lastAppts.map((a: any) => [a.patient_id, a]));
  const nextMap = Object.fromEntries(nextAppts.map((a: any) => [a.patient_id, a]));
  const actionMap: Record<number, { whatsapp: boolean; email: boolean; discount: boolean }> = {};
  for (const a of actions as any[]) {
    if (!actionMap[a.patient_id]) actionMap[a.patient_id] = { whatsapp: false, email: false, discount: false };
    if (a.action_type === "congratulations" && a.channel === "whatsapp") actionMap[a.patient_id].whatsapp = true;
    if (a.action_type === "congratulations" && a.channel === "email") actionMap[a.patient_id].email = true;
    if (a.action_type === "discount") actionMap[a.patient_id].discount = true;
  }

  const currentYear = new Date().getFullYear();

  return patients.map(p => {
    const birthYear = p.birth_date ? parseInt(p.birth_date.slice(0, 4)) : null;
    const age = birthYear ? currentYear - birthYear : null;
    const am = actionMap[p.id] || { whatsapp: false, email: false, discount: false };
    return {
      ...p,
      // normalize camelCase for frontend
      birthDate: p.birth_date,
      contactPreference: p.contact_preference || "whatsapp",
      age,
      lastAppointment: lastMap[p.id] || null,
      nextAppointment: nextMap[p.id] || null,
      // Legacy
      congratsSent: am.whatsapp || am.email,
      whatsappSent: am.whatsapp,
      emailSent: am.email,
      discountOffered: am.discount,
    };
  });
}

export default router;
