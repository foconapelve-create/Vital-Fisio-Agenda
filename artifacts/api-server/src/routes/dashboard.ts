import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, appointmentsTable, patientsTable, therapistsTable } from "@workspace/db";

const router: IRouter = Router();

function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const today = getTodayString();

  const rows = await db
    .select({
      status: appointmentsTable.status,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(appointmentsTable)
    .where(eq(appointmentsTable.date, today))
    .groupBy(appointmentsTable.status);

  let totalToday = 0;
  let totalAbsences = 0;
  let totalCompleted = 0;
  let totalScheduled = 0;
  let totalCancelled = 0;

  for (const row of rows) {
    totalToday += Number(row.count);
    if (row.status === "falta") totalAbsences += Number(row.count);
    if (row.status === "presente") totalCompleted += Number(row.count);
    if (row.status === "agendado" || row.status === "confirmado" || row.status === "encaixe") totalScheduled += Number(row.count);
    if (row.status === "cancelado") totalCancelled += Number(row.count);
  }

  res.json({
    totalToday,
    totalAbsences,
    totalCompleted,
    totalScheduled,
    totalCancelled,
  });
});

router.get("/dashboard/upcoming", async (_req, res): Promise<void> => {
  const today = getTodayString();

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const upcoming = await db
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
    .where(
      and(
        eq(appointmentsTable.date, today),
        sql`${appointmentsTable.time} >= ${currentTime}`,
        sql`${appointmentsTable.status} IN ('agendado', 'confirmado', 'encaixe')`
      )
    )
    .orderBy(appointmentsTable.time)
    .limit(10);

  res.json(upcoming);
});

export default router;
