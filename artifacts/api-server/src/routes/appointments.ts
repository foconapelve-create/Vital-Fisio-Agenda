import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, appointmentsTable, patientsTable, therapistsTable } from "@workspace/db";
import {
  CreateAppointmentBody,
  UpdateAppointmentBody,
  GetAppointmentParams,
  UpdateAppointmentParams,
  DeleteAppointmentParams,
  UpdateAppointmentStatusParams,
  UpdateAppointmentStatusBody,
  RescheduleAppointmentParams,
  RescheduleAppointmentBody,
  ListAppointmentsQueryParams,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router: IRouter = Router();

function buildAppointmentSelect() {
  return {
    id: appointmentsTable.id,
    patientId: appointmentsTable.patientId,
    therapistId: appointmentsTable.therapistId,
    date: appointmentsTable.date,
    time: appointmentsTable.time,
    status: appointmentsTable.status,
    notes: appointmentsTable.notes,
    originalAppointmentId: appointmentsTable.originalAppointmentId,
    recurringGroupId: appointmentsTable.recurringGroupId,
    createdAt: appointmentsTable.createdAt,
    updatedAt: appointmentsTable.updatedAt,
    patientName: patientsTable.name,
    patientPhone: patientsTable.phone,
    therapistName: therapistsTable.name,
    therapistSpecialty: therapistsTable.specialty,
  };
}

router.get("/appointments", async (req, res): Promise<void> => {
  const query = ListAppointmentsQueryParams.safeParse(req.query);
  const filters = query.success ? query.data : {};

  const conditions = [];
  if (filters.date) conditions.push(eq(appointmentsTable.date, filters.date));
  if (filters.weekStart) {
    const startDate = new Date(filters.weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    conditions.push(gte(appointmentsTable.date, filters.weekStart));
    conditions.push(lte(appointmentsTable.date, endDate.toISOString().split("T")[0]));
  }
  if (filters.therapistId) conditions.push(eq(appointmentsTable.therapistId, Number(filters.therapistId)));
  if (filters.status) conditions.push(eq(appointmentsTable.status, filters.status));
  if (filters.patientId) conditions.push(eq(appointmentsTable.patientId, Number(filters.patientId)));

  const baseQuery = db.select(buildAppointmentSelect()).from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id));

  const appointments = conditions.length > 0
    ? await baseQuery.where(and(...conditions)).orderBy(appointmentsTable.date, appointmentsTable.time)
    : await baseQuery.orderBy(appointmentsTable.date, appointmentsTable.time);

  res.json(appointments);
});

router.post("/appointments", async (req, res): Promise<void> => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { patientId, therapistId, date, time, status, notes } = parsed.data;

  const existing = await db.select({ id: appointmentsTable.id }).from(appointmentsTable)
    .where(and(
      eq(appointmentsTable.patientId, patientId),
      eq(appointmentsTable.date, date),
      eq(appointmentsTable.time, time),
      sql`${appointmentsTable.status} NOT IN ('cancelado', 'remarcado')`
    ));

  if (existing.length > 0) {
    res.status(409).json({ error: "Conflito de horário: paciente já possui agendamento neste horário" });
    return;
  }

  const [appointment] = await db.insert(appointmentsTable).values({
    patientId, therapistId, date, time,
    status: status ?? "agendado",
    notes: notes ?? null,
  }).returning();

  const [withDetails] = await db.select(buildAppointmentSelect()).from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id))
    .where(eq(appointmentsTable.id, appointment.id));

  res.status(201).json(withDetails);
});

router.post("/appointments/recurring", async (req, res): Promise<void> => {
  const { patientId, therapistId, startDate, time, notes, recurrenceType, weekDays, totalCount, endDate } = req.body;

  if (!patientId || !therapistId || !startDate || !time || !recurrenceType) {
    res.status(400).json({ error: "Campos obrigatórios: paciente, fisioterapeuta, data início, horário, tipo de recorrência" });
    return;
  }

  const groupId = randomUUID();
  const dates: string[] = [];
  const start = new Date(startDate + "T12:00:00");
  const end = endDate ? new Date(endDate + "T23:59:59") : null;
  const maxCount = totalCount ? parseInt(totalCount) : 52;

  if (recurrenceType === "diaria") {
    let current = new Date(start);
    while (dates.length < maxCount && (!end || current <= end)) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }
  } else if (recurrenceType === "semanal") {
    let current = new Date(start);
    while (dates.length < maxCount && (!end || current <= end)) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 7);
    }
  } else if (recurrenceType === "dias_semana") {
    const days: number[] = weekDays || [start.getDay()];
    let current = new Date(start);
    for (let i = 0; i < 365 && dates.length < maxCount && (!end || current <= end); i++) {
      if (days.includes(current.getDay())) {
        dates.push(current.toISOString().split("T")[0]);
      }
      current.setDate(current.getDate() + 1);
    }
  }

  const created = [];
  for (const date of dates) {
    const conflict = await db.select({ id: appointmentsTable.id }).from(appointmentsTable)
      .where(and(
        eq(appointmentsTable.patientId, Number(patientId)),
        eq(appointmentsTable.date, date),
        eq(appointmentsTable.time, time),
        sql`${appointmentsTable.status} NOT IN ('cancelado', 'remarcado')`
      ));

    if (conflict.length === 0) {
      const [appt] = await db.insert(appointmentsTable).values({
        patientId: Number(patientId), therapistId: Number(therapistId),
        date, time, status: "agendado",
        notes: notes ?? null, recurringGroupId: groupId,
      }).returning();
      created.push(appt);
    }
  }

  res.status(201).json({ created: created.length, groupId, appointments: created });
});

router.get("/appointments/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetAppointmentParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [appointment] = await db.select(buildAppointmentSelect()).from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id))
    .where(eq(appointmentsTable.id, params.data.id));

  if (!appointment) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }

  res.json(appointment);
});

router.patch("/appointments/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateAppointmentParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.patientId !== undefined) updateData.patientId = d.patientId;
  if (d.therapistId !== undefined) updateData.therapistId = d.therapistId;
  if (d.date !== undefined) updateData.date = d.date;
  if (d.time !== undefined) updateData.time = d.time;
  if (d.status !== undefined) updateData.status = d.status;
  if (d.notes !== undefined) updateData.notes = d.notes;

  await db.update(appointmentsTable).set(updateData).where(eq(appointmentsTable.id, params.data.id));

  const [appointment] = await db.select(buildAppointmentSelect()).from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id))
    .where(eq(appointmentsTable.id, params.data.id));

  if (!appointment) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }

  res.json(appointment);
});

router.delete("/appointments/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteAppointmentParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [appointment] = await db.delete(appointmentsTable).where(eq(appointmentsTable.id, params.data.id)).returning();
  if (!appointment) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }

  res.sendStatus(204);
});

router.delete("/appointments/group/:groupId", async (req, res): Promise<void> => {
  const { groupId } = req.params;
  if (!groupId) { res.status(400).json({ error: "groupId inválido" }); return; }

  const deleted = await db.delete(appointmentsTable)
    .where(and(eq(appointmentsTable.recurringGroupId, groupId), sql`${appointmentsTable.status} NOT IN ('presente', 'falta')`))
    .returning();

  res.json({ deleted: deleted.length });
});

router.patch("/appointments/:id/status", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateAppointmentStatusParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateAppointmentStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { status } = parsed.data;

  const [current] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, params.data.id));
  if (!current) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }

  const prevStatus = current.status;

  await db.update(appointmentsTable).set({ status }).where(eq(appointmentsTable.id, params.data.id));

  if (status === "presente" && prevStatus !== "presente") {
    await db.update(patientsTable)
      .set({ remainingSessions: sql`${patientsTable.remainingSessions} - 1` })
      .where(and(eq(patientsTable.id, current.patientId), sql`${patientsTable.remainingSessions} > 0`));
  } else if (prevStatus === "presente" && status !== "presente") {
    await db.update(patientsTable)
      .set({ remainingSessions: sql`${patientsTable.remainingSessions} + 1` })
      .where(eq(patientsTable.id, current.patientId));
  }

  const [appointment] = await db.select(buildAppointmentSelect()).from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id))
    .where(eq(appointmentsTable.id, params.data.id));

  res.json(appointment);
});

router.post("/appointments/:id/reschedule", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = RescheduleAppointmentParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = RescheduleAppointmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { date, time, therapistId } = parsed.data;

  const [original] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, params.data.id));
  if (!original) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }

  const targetTherapistId = therapistId ?? original.therapistId;

  const conflict = await db.select({ id: appointmentsTable.id }).from(appointmentsTable)
    .where(and(
      eq(appointmentsTable.patientId, original.patientId),
      eq(appointmentsTable.date, date), eq(appointmentsTable.time, time),
      sql`${appointmentsTable.status} NOT IN ('cancelado', 'remarcado')`
    ));

  if (conflict.length > 0) {
    res.status(409).json({ error: "Conflito de horário: paciente já possui agendamento neste horário" });
    return;
  }

  await db.update(appointmentsTable).set({ status: "remarcado" }).where(eq(appointmentsTable.id, params.data.id));

  const [newAppointment] = await db.insert(appointmentsTable).values({
    patientId: original.patientId, therapistId: targetTherapistId,
    date, time, status: "agendado",
    notes: original.notes, originalAppointmentId: params.data.id,
  }).returning();

  const [withDetails] = await db.select(buildAppointmentSelect()).from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id))
    .where(eq(appointmentsTable.id, newAppointment.id));

  res.json(withDetails);
});

export default router;
