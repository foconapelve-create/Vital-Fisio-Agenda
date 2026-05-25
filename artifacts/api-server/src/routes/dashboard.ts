import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, pool, appointmentsTable, patientsTable, therapistsTable, financialTable } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

async function getTherapistIds(userId: number): Promise<number[] | null> {
  const { rows: userRows } = await pool.query("SELECT role, name FROM users WHERE id = $1", [userId]);
  const user = userRows[0];
  if (!user) return null;
  const isProfissional = user.role === "profissional" || user.role === "fisioterapeuta";
  if (!isProfissional || !user.name) return null;
  const firstName = user.name.split(" ")[0].toLowerCase();
  const { rows: therapistRows } = await pool.query(
    "SELECT id FROM therapists WHERE LOWER(name) LIKE $1",
    [`%${firstName}%`]
  );
  return therapistRows.length > 0 ? therapistRows.map((t: any) => t.id) : [];
}

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId as number;
    const { rows: userRows } = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
    const role = userRows[0]?.role || "admin";
    const isProfissional = role === "profissional" || role === "fisioterapeuta";
    const showFinancial = role === "admin" || role === "financeiro";

    const today = getTodayString();
    const therapistIds = isProfissional ? await getTherapistIds(userId) : null;

    let rows: any[];
    if (therapistIds !== null) {
      if (therapistIds.length === 0) {
        rows = [];
      } else {
        const placeholders = therapistIds.map((_: any, i: number) => `$${i + 2}`).join(", ");
        const { rows: r } = await pool.query(
          `SELECT status, CAST(COUNT(*) AS INTEGER) as count FROM appointments
           WHERE date = $1 AND therapist_id IN (${placeholders})
           GROUP BY status`,
          [today, ...therapistIds]
        );
        rows = r;
      }
    } else {
      rows = await db
        .select({ status: appointmentsTable.status, count: sql<number>`cast(count(*) as integer)` })
        .from(appointmentsTable)
        .where(eq(appointmentsTable.date, today))
        .groupBy(appointmentsTable.status);
    }

    let totalToday = 0, totalAbsences = 0, totalCompleted = 0, totalScheduled = 0, totalCancelled = 0;
    for (const row of rows) {
      totalToday += Number(row.count);
      if (row.status === "falta") totalAbsences += Number(row.count);
      if (row.status === "presente") totalCompleted += Number(row.count);
      if (["agendado", "confirmado", "encaixe"].includes(row.status)) totalScheduled += Number(row.count);
      if (row.status === "cancelado") totalCancelled += Number(row.count);
    }

    const result: any = { totalToday, totalAbsences, totalCompleted, totalScheduled, totalCancelled };

    if (showFinancial) {
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

      result.financialSummary = {
        receivedToday: todayReceitas?.total || 0,
        receivedMonth: monthReceitas?.total || 0,
        billsMonth: pendingTotal?.total || 0,
        overdueCount: overdueRecords.length,
        overdueRecords,
        upcomingBillsCount: upcomingBills.length,
        upcomingBills,
      };
    }

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/dashboard/upcoming", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId as number;
    const today = getTodayString();
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const therapistIds = await getTherapistIds(userId);

    let upcoming: any[];

    if (therapistIds !== null) {
      if (therapistIds.length === 0) {
        upcoming = [];
      } else {
        const placeholders = therapistIds.map((_: any, i: number) => `$${i + 3}`).join(", ");
        const { rows } = await pool.query(
          `SELECT a.id, a.patient_id, a.therapist_id, a.date, a.time, a.status, a.notes,
                  p.name as "patientName", p.phone as "patientPhone",
                  t.name as "therapistName", t.specialty as "therapistSpecialty"
           FROM appointments a
           INNER JOIN patients p ON a.patient_id = p.id
           INNER JOIN therapists t ON a.therapist_id = t.id
           WHERE a.date = $1 AND a.time >= $2
             AND a.status IN ('agendado', 'confirmado', 'encaixe')
             AND a.therapist_id IN (${placeholders})
           ORDER BY a.time
           LIMIT 10`,
          [today, currentTime, ...therapistIds]
        );
        upcoming = rows;
      }
    } else {
      upcoming = await db
        .select({
          id: appointmentsTable.id,
          patientId: appointmentsTable.patientId,
          therapistId: appointmentsTable.therapistId,
          date: appointmentsTable.date,
          time: appointmentsTable.time,
          status: appointmentsTable.status,
          notes: appointmentsTable.notes,
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
    }

    res.json(upcoming);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
