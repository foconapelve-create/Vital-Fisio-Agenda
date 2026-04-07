import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, appointmentsTable, patientsTable, therapistsTable } from "@workspace/db";
import {
  GetDailyReportQueryParams,
  GetAbsenceReportQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/reports/daily", async (req, res): Promise<void> => {
  const parsed = GetDailyReportQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { startDate, endDate } = parsed.data;

  const rows = await db
    .select({
      date: appointmentsTable.date,
      status: appointmentsTable.status,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(appointmentsTable)
    .where(
      and(
        gte(appointmentsTable.date, startDate),
        lte(appointmentsTable.date, endDate)
      )
    )
    .groupBy(appointmentsTable.date, appointmentsTable.status)
    .orderBy(appointmentsTable.date);

  const byDate = new Map<string, { total: number; completed: number; absent: number; cancelled: number }>();

  for (const row of rows) {
    if (!byDate.has(row.date)) {
      byDate.set(row.date, { total: 0, completed: 0, absent: 0, cancelled: 0 });
    }
    const entry = byDate.get(row.date)!;
    entry.total += Number(row.count);
    if (row.status === "presente") entry.completed += Number(row.count);
    if (row.status === "falta") entry.absent += Number(row.count);
    if (row.status === "cancelado") entry.cancelled += Number(row.count);
  }

  const result = Array.from(byDate.entries()).map(([date, stats]) => ({
    date,
    ...stats,
  }));

  res.json(result);
});

router.get("/reports/absences", async (req, res): Promise<void> => {
  const parsed = GetAbsenceReportQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { startDate, endDate } = parsed.data;

  const absences = await db
    .select({
      date: appointmentsTable.date,
      time: appointmentsTable.time,
      patientName: patientsTable.name,
      therapistName: therapistsTable.name,
    })
    .from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id))
    .where(
      and(
        eq(appointmentsTable.status, "falta"),
        gte(appointmentsTable.date, startDate),
        lte(appointmentsTable.date, endDate)
      )
    )
    .orderBy(appointmentsTable.date, appointmentsTable.time);

  res.json(absences);
});

router.get("/reports/sessions", async (_req, res): Promise<void> => {
  const patients = await db
    .select({
      patientId: patientsTable.id,
      patientName: patientsTable.name,
      totalSessions: patientsTable.totalSessions,
      remainingSessions: patientsTable.remainingSessions,
    })
    .from(patientsTable)
    .orderBy(patientsTable.name);

  const result = patients.map((p) => ({
    patientId: p.patientId,
    patientName: p.patientName,
    totalSessions: p.totalSessions,
    remainingSessions: p.remainingSessions,
    usedSessions: p.totalSessions - p.remainingSessions,
  }));

  res.json(result);
});

export default router;
