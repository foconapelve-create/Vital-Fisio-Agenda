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

const VALID_TYPES = ["pelvica", "bebe"];

function mapApt(r: any) {
  return {
    id: r.id, agendaType: r.agenda_type,
    patientId: r.patient_id, therapistId: r.therapist_id,
    patientName: r.patient_name, patientPhone: r.patient_phone,
    therapistName: r.therapist_name, therapistSpecialty: r.therapist_specialty,
    date: r.date, time: r.time, status: r.status,
    notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

// ── List ───────────────────────────────────────────────────────────────────────
router.get("/agenda-esp/appointments", requireAuth, async (req, res): Promise<void> => {
  const { agendaType, weekStart, therapistId, date } = req.query as any;
  if (!agendaType || !VALID_TYPES.includes(agendaType)) {
    res.status(400).json({ error: "agendaType inválido" }); return;
  }

  const conditions: string[] = ["agenda_type = $1"];
  const params: any[] = [agendaType];
  let i = 2;

  if (date) { conditions.push(`date = $${i++}`); params.push(date); }
  else if (weekStart) {
    const end = new Date(weekStart + "T12:00:00");
    end.setDate(end.getDate() + 6);
    conditions.push(`date >= $${i++}`); params.push(weekStart);
    conditions.push(`date <= $${i++}`); params.push(end.toISOString().split("T")[0]);
  }
  if (therapistId) { conditions.push(`therapist_id = $${i++}`); params.push(parseInt(therapistId)); }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM especializada_appointments WHERE ${conditions.join(" AND ")} ORDER BY date, time`,
      params
    );
    res.json(rows.map(mapApt));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Create ─────────────────────────────────────────────────────────────────────
router.post("/agenda-esp/appointments", requireAuth, async (req, res): Promise<void> => {
  const { agendaType, patientId, therapistId, date, time, status, notes } = req.body || {};
  if (!agendaType || !VALID_TYPES.includes(agendaType)) {
    res.status(400).json({ error: "agendaType inválido" }); return;
  }
  if (!patientId || !therapistId || !date || !time) {
    res.status(400).json({ error: "Campos obrigatórios: paciente, profissional, data e horário" }); return;
  }

  try {
    // Fetch patient and therapist names
    const [{ rows: pRows }, { rows: tRows }] = await Promise.all([
      pool.query("SELECT name, phone FROM patients WHERE id = $1", [patientId]),
      pool.query("SELECT name, specialty FROM therapists WHERE id = $1", [therapistId]),
    ]);
    if (!pRows.length) { res.status(400).json({ error: "Paciente não encontrado" }); return; }
    if (!tRows.length) { res.status(400).json({ error: "Profissional não encontrado" }); return; }

    const { rows } = await pool.query(
      `INSERT INTO especializada_appointments
        (agenda_type, patient_id, therapist_id, patient_name, patient_phone, therapist_name, therapist_specialty, date, time, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [agendaType, patientId, therapistId,
       pRows[0].name, pRows[0].phone || null,
       tRows[0].name, tRows[0].specialty || null,
       date, time, status || "agendado", notes || null]
    );
    res.status(201).json(mapApt(rows[0]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Update status ──────────────────────────────────────────────────────────────
router.patch("/agenda-esp/appointments/:id/status", requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!status) { res.status(400).json({ error: "Status é obrigatório" }); return; }
  try {
    const { rows } = await pool.query(
      "UPDATE especializada_appointments SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [status, id]
    );
    if (!rows.length) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }
    res.json(mapApt(rows[0]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Update appointment ─────────────────────────────────────────────────────────
router.put("/agenda-esp/appointments/:id", requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { patientId, therapistId, date, time, status, notes } = req.body || {};
  try {
    let patientName = null, patientPhone = null, therapistName = null, therapistSpecialty = null;
    if (patientId) {
      const { rows } = await pool.query("SELECT name, phone FROM patients WHERE id=$1", [patientId]);
      if (rows.length) { patientName = rows[0].name; patientPhone = rows[0].phone; }
    }
    if (therapistId) {
      const { rows } = await pool.query("SELECT name, specialty FROM therapists WHERE id=$1", [therapistId]);
      if (rows.length) { therapistName = rows[0].name; therapistSpecialty = rows[0].specialty; }
    }

    const sets: string[] = ["updated_at=NOW()"];
    const params: any[] = [];
    let i = 1;

    if (patientId)        { sets.push(`patient_id=$${i++}`); params.push(patientId); }
    if (patientName)      { sets.push(`patient_name=$${i++}`); params.push(patientName); }
    if (patientPhone)     { sets.push(`patient_phone=$${i++}`); params.push(patientPhone); }
    if (therapistId)      { sets.push(`therapist_id=$${i++}`); params.push(therapistId); }
    if (therapistName)    { sets.push(`therapist_name=$${i++}`); params.push(therapistName); }
    if (therapistSpecialty) { sets.push(`therapist_specialty=$${i++}`); params.push(therapistSpecialty); }
    if (date)             { sets.push(`date=$${i++}`); params.push(date); }
    if (time)             { sets.push(`time=$${i++}`); params.push(time); }
    if (status)           { sets.push(`status=$${i++}`); params.push(status); }
    sets.push(`notes=$${i++}`); params.push(notes || null);
    params.push(id);

    const { rows } = await pool.query(
      `UPDATE especializada_appointments SET ${sets.join(",")} WHERE id=$${i} RETURNING *`,
      params
    );
    if (!rows.length) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }
    res.json(mapApt(rows[0]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Delete ─────────────────────────────────────────────────────────────────────
router.delete("/agenda-esp/appointments/:id", requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM especializada_appointments WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
