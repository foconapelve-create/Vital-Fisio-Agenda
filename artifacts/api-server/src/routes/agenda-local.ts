import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

/* ─── helpers ──────────────────────────────────────────────────────────── */
async function fetchWithDetails(id: number) {
  const { rows } = await pool.query(`
    SELECT a.id, a.patient_id, a.therapist_id, a.date, a.time, a.status,
           a.notes, a.location, a.insurance, a.appointment_type,
           a.recurring_group_id, a.created_at,
           p.name  AS patient_name,  p.phone AS patient_phone,
           t.name  AS therapist_name, t.specialty AS therapist_specialty
    FROM appointments a
    JOIN patients  p ON a.patient_id   = p.id
    JOIN therapists t ON a.therapist_id = t.id
    WHERE a.id = $1
  `, [id]);
  if (!rows[0]) return null;
  return mapRow(rows[0]);
}

function mapRow(r: any) {
  return {
    id:                 r.id,
    patientId:          r.patient_id,
    therapistId:        r.therapist_id,
    date:               r.date,
    time:               r.time,
    status:             r.status,
    notes:              r.notes,
    location:           r.location,
    insurance:          r.insurance,
    appointmentType:    r.appointment_type,
    recurringGroupId:   r.recurring_group_id,
    createdAt:          r.created_at,
    patientName:        r.patient_name,
    patientPhone:       r.patient_phone,
    therapistName:      r.therapist_name,
    therapistSpecialty: r.therapist_specialty,
  };
}

/* ─── LIST ──────────────────────────────────────────────────────────────── */
router.get("/agenda-local", async (req, res): Promise<void> => {
  try {
    const { weekStart, therapistId, location } = req.query;

    const conditions: string[] = ["a.status NOT IN ('cancelado', 'remarcado')"];
    const params: any[] = [];
    let idx = 1;

    if (weekStart) {
      const endDate = new Date((weekStart as string) + "T12:00:00");
      endDate.setDate(endDate.getDate() + 6);
      const endStr = endDate.toISOString().split("T")[0];
      conditions.push(`a.date >= $${idx++}`, `a.date <= $${idx++}`);
      params.push(weekStart, endStr);
    }
    if (therapistId) {
      conditions.push(`a.therapist_id = $${idx++}`);
      params.push(Number(therapistId));
    }
    if (location) {
      conditions.push(`a.location = $${idx++}`);
      params.push(location);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(`
      SELECT a.id, a.patient_id, a.therapist_id, a.date, a.time, a.status,
             a.notes, a.location, a.insurance, a.appointment_type,
             a.recurring_group_id, a.created_at,
             p.name  AS patient_name,  p.phone AS patient_phone,
             t.name  AS therapist_name, t.specialty AS therapist_specialty
      FROM appointments a
      JOIN patients  p ON a.patient_id   = p.id
      JOIN therapists t ON a.therapist_id = t.id
      ${where}
      ORDER BY a.date, a.time, a.location
    `, params);

    res.json(rows.map(mapRow));
  } catch (e: any) {
    console.error("agenda-local list error:", e);
    res.status(500).json({ error: e.message });
  }
});

/* ─── CREATE ────────────────────────────────────────────────────────────── */
router.post("/agenda-local", async (req, res): Promise<void> => {
  try {
    const { patientId, therapistId, date, time, location, status, notes, insurance, appointmentType } = req.body;

    if (!patientId || !therapistId || !date || !time || !location) {
      res.status(400).json({ error: "Campos obrigatórios: paciente, profissional, data, horário e local" });
      return;
    }

    // Conflict check: same location + date + time
    const { rows: conflict } = await pool.query(
      `SELECT id FROM appointments
       WHERE location = $1 AND date = $2 AND time = $3
         AND status NOT IN ('cancelado', 'remarcado')`,
      [location, date, time]
    );

    if (conflict.length > 0) {
      res.status(409).json({ error: "Este local já está ocupado neste horário" });
      return;
    }

    const { rows } = await pool.query(`
      INSERT INTO appointments
        (patient_id, therapist_id, date, time, status, notes, location, insurance, appointment_type)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id
    `, [
      patientId, therapistId, date, time,
      status ?? "agendado",
      notes ?? null,
      location,
      insurance ?? null,
      appointmentType ?? null,
    ]);

    const apt = await fetchWithDetails(rows[0].id);
    res.status(201).json(apt);
  } catch (e: any) {
    console.error("agenda-local create error:", e);
    res.status(500).json({ error: e.message });
  }
});

/* ─── UPDATE ────────────────────────────────────────────────────────────── */
router.put("/agenda-local/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { patientId, therapistId, date, time, location, status, notes, insurance, appointmentType } = req.body;

    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (patientId !== undefined)       { fields.push(`patient_id = $${idx++}`);        params.push(patientId); }
    if (therapistId !== undefined)     { fields.push(`therapist_id = $${idx++}`);      params.push(therapistId); }
    if (date !== undefined)            { fields.push(`date = $${idx++}`);              params.push(date); }
    if (time !== undefined)            { fields.push(`time = $${idx++}`);              params.push(time); }
    if (location !== undefined)        { fields.push(`location = $${idx++}`);          params.push(location); }
    if (status !== undefined)          { fields.push(`status = $${idx++}`);            params.push(status); }
    if (notes !== undefined)           { fields.push(`notes = $${idx++}`);             params.push(notes); }
    if (insurance !== undefined)       { fields.push(`insurance = $${idx++}`);         params.push(insurance); }
    if (appointmentType !== undefined) { fields.push(`appointment_type = $${idx++}`);  params.push(appointmentType); }

    if (fields.length === 0) {
      res.status(400).json({ error: "Nenhum campo para atualizar" });
      return;
    }

    fields.push(`updated_at = NOW()`);
    params.push(id);

    await pool.query(`UPDATE appointments SET ${fields.join(", ")} WHERE id = $${idx}`, params);
    const apt = await fetchWithDetails(id);
    res.json(apt);
  } catch (e: any) {
    console.error("agenda-local update error:", e);
    res.status(500).json({ error: e.message });
  }
});

/* ─── STATUS PATCH ──────────────────────────────────────────────────────── */
router.patch("/agenda-local/:id/status", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    await pool.query(`UPDATE appointments SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);
    res.json({ id, status });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── DELETE ────────────────────────────────────────────────────────────── */
router.delete("/agenda-local/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await pool.query(`DELETE FROM appointments WHERE id = $1`, [id]);
    res.json({ message: "Agendamento removido" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
