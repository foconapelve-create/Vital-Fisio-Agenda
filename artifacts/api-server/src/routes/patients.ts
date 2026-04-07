import { Router, type IRouter } from "express";
import { eq, ilike, sql } from "drizzle-orm";
import { db, patientsTable, appointmentsTable, therapistsTable } from "@workspace/db";
import {
  CreatePatientBody,
  UpdatePatientBody,
  GetPatientParams,
  UpdatePatientParams,
  DeletePatientParams,
  GetPatientHistoryParams,
  ListPatientsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/patients", async (req, res): Promise<void> => {
  const query = ListPatientsQueryParams.safeParse(req.query);
  const search = query.success ? query.data.search : undefined;

  let patients;
  if (search) {
    patients = await db
      .select()
      .from(patientsTable)
      .where(ilike(patientsTable.name, `%${search}%`))
      .orderBy(patientsTable.name);
  } else {
    patients = await db.select().from(patientsTable).orderBy(patientsTable.name);
  }

  res.json(patients);
});

router.post("/patients", async (req, res): Promise<void> => {
  const parsed = CreatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const [patient] = await db
    .insert(patientsTable)
    .values({
      name: data.name,
      phone: data.phone,
      birthDate: data.birthDate ?? null,
      insuranceType: data.insuranceType,
      insuranceName: data.insuranceName ?? null,
      totalSessions: data.totalSessions,
      remainingSessions: data.totalSessions,
      notes: data.notes ?? null,
    })
    .returning();

  res.status(201).json(patient);
});

router.get("/patients/:id", async (req, res): Promise<void> => {
  const params = GetPatientParams.safeParse({ id: parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.id, params.data.id));

  if (!patient) {
    res.status(404).json({ error: "Paciente não encontrado" });
    return;
  }

  res.json(patient);
});

router.patch("/patients/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdatePatientParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined) updateData.name = d.name;
  if (d.phone !== undefined) updateData.phone = d.phone;
  if (d.birthDate !== undefined) updateData.birthDate = d.birthDate;
  if (d.insuranceType !== undefined) updateData.insuranceType = d.insuranceType;
  if (d.insuranceName !== undefined) updateData.insuranceName = d.insuranceName;
  if (d.totalSessions !== undefined) updateData.totalSessions = d.totalSessions;
  if (d.remainingSessions !== undefined) updateData.remainingSessions = d.remainingSessions;
  if (d.notes !== undefined) updateData.notes = d.notes;

  const [patient] = await db
    .update(patientsTable)
    .set(updateData)
    .where(eq(patientsTable.id, params.data.id))
    .returning();

  if (!patient) {
    res.status(404).json({ error: "Paciente não encontrado" });
    return;
  }

  res.json(patient);
});

router.delete("/patients/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeletePatientParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [patient] = await db
    .delete(patientsTable)
    .where(eq(patientsTable.id, params.data.id))
    .returning();

  if (!patient) {
    res.status(404).json({ error: "Paciente não encontrado" });
    return;
  }

  res.sendStatus(204);
});

router.get("/patients/:id/history", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPatientHistoryParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const appointments = await db
    .select({
      id: appointmentsTable.id,
      patientId: appointmentsTable.patientId,
      therapistId: appointmentsTable.therapistId,
      date: appointmentsTable.date,
      time: appointmentsTable.time,
      status: appointmentsTable.status,
      notes: appointmentsTable.notes,
      originalAppointmentId: appointmentsTable.originalAppointmentId,
      createdAt: appointmentsTable.createdAt,
      updatedAt: appointmentsTable.updatedAt,
      patientName: patientsTable.name,
      patientPhone: patientsTable.phone,
      therapistName: therapistsTable.name,
      therapistSpecialty: therapistsTable.specialty,
    })
    .from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id))
    .where(eq(appointmentsTable.patientId, params.data.id))
    .orderBy(sql`${appointmentsTable.date} DESC, ${appointmentsTable.time} DESC`);

  res.json(appointments);
});

export default router;
