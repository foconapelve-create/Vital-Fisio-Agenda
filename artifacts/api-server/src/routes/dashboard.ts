import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, appointmentsTable, patientsTable, therapistsTable, financialTable } from "@workspace/db";

const router: IRouter = Router();

function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const today = getTodayString();

  const rows = await db
    .select({ status: appointmentsTable.status, count: sql<number>`cast(count(*) as integer)` })
    .from(appointmentsTable)
    .where(eq(appointmentsTable.date, today))
    .groupBy(appointmentsTable.status);

  let totalToday = 0, totalAbsences = 0, totalCompleted = 0, totalScheduled = 0, totalCancelled = 0;

  for (const row of rows) {
    totalToday += Number(row.count);
    if (row.status === "falta") totalAbsences += Number(row.count);
    if (row.status === "presente") totalCompleted += Number(row.count);
    if (["agendado", "confirmado", "encaixe"].includes(row.status)) totalScheduled += Number(row.count);
    if (row.status === "cancelado") totalCancelled += Number(row.count);
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [todayReceitas] = await db.select({ total: sql<number>`cast(coalesce(sum(amount),0) as float)` })
    .from(financialTable)
    .where(and(eq(financialTable.type, "receita"), eq(financialTable.paymentStatus, "pago"), eq(sql`date(${financialTable.paymentDate})`, today)));

  const [monthReceitas] = await db.select({ total: sql<number>`cast(coalesce(sum(amount),0) as float)` })
    .from(financialTable)
    .where(and(eq(financialTable.type, "receita"), eq(financialTable.paymentStatus, "pago"),
      gte(financialTable.dueDate, monthStart), lte(financialTable.dueDate, monthEnd)));

  const overdueRecords = await db.select({ id: financialTable.id, description: financialTable.description, amount: financialTable.amount, dueDate: financialTable.dueDate })
    .from(financialTable)
    .where(and(eq(financialTable.paymentStatus, "pendente"), lte(financialTable.dueDate, today)));

  const upcomingBills = await db.select({ id: financialTable.id, description: financialTable.description, amount: financialTable.amount, dueDate: financialTable.dueDate })
    .from(financialTable)
    .where(and(eq(financialTable.paymentStatus, "pendente"), gte(financialTable.dueDate, today), lte(financialTable.dueDate, in7Days)));

  const [pendingTotal] = await db.select({ total: sql<number>`cast(coalesce(sum(amount),0) as float)` })
    .from(financialTable)
    .where(and(eq(financialTable.type, "despesa"), eq(financialTable.paymentStatus, "pendente"),
      gte(financialTable.dueDate, monthStart), lte(financialTable.dueDate, monthEnd)));

  res.json({
    totalToday, totalAbsences, totalCompleted, totalScheduled, totalCancelled,
    financialSummary: {
      receivedToday: todayReceitas?.total || 0,
      receivedMonth: monthReceitas?.total || 0,
      billsMonth: pendingTotal?.total || 0,
      overdueCount: overdueRecords.length,
      overdueRecords,
      upcomingBillsCount: upcomingBills.length,
      upcomingBills,
    },
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
    .where(and(
      eq(appointmentsTable.date, today),
      sql`${appointmentsTable.time} >= ${currentTime}`,
      sql`${appointmentsTable.status} IN ('agendado', 'confirmado', 'encaixe')`
    ))
    .orderBy(appointmentsTable.time)
    .limit(10);

  res.json(upcoming);
});

export default router;
