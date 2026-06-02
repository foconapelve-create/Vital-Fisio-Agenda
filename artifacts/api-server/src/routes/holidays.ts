import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, holidaysTable, appointmentsTable, patientsTable, therapistsTable, appointmentContactsTable } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

// ─── Easter algorithm (Anonymous Gregorian) ───────────────────────────────────
function getEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmt(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getBrazilianNationalHolidays(year: number): Array<{ date: string; description: string; type: string }> {
  const easter = getEaster(year);
  return [
    { date: `${year}-01-01`, description: "Confraternização Universal", type: "Nacional" },
    { date: fmt(addDays(easter, -48)), description: "Carnaval (Segunda-feira)", type: "Nacional" },
    { date: fmt(addDays(easter, -47)), description: "Carnaval (Terça-feira)", type: "Nacional" },
    { date: fmt(addDays(easter, -2)),  description: "Sexta-feira Santa (Paixão de Cristo)", type: "Nacional" },
    { date: `${year}-04-21`, description: "Tiradentes", type: "Nacional" },
    { date: `${year}-05-01`, description: "Dia do Trabalho", type: "Nacional" },
    { date: fmt(addDays(easter, 60)),  description: "Corpus Christi", type: "Nacional" },
    { date: `${year}-09-07`, description: "Independência do Brasil", type: "Nacional" },
    { date: `${year}-10-12`, description: "Nossa Senhora Aparecida", type: "Nacional" },
    { date: `${year}-11-02`, description: "Finados", type: "Nacional" },
    { date: `${year}-11-15`, description: "Proclamação da República", type: "Nacional" },
    { date: `${year}-11-20`, description: "Dia da Consciência Negra", type: "Nacional" },
    { date: `${year}-12-25`, description: "Natal", type: "Nacional" },
  ];
}

// ─── LIST ─────────────────────────────────────────────────────────────────────

router.get("/holidays", async (req, res): Promise<void> => {
  try {
    const year = req.query.year ? String(req.query.year) : null;
    let holidays;
    if (year) {
      holidays = await db.select().from(holidaysTable)
        .where(and(
          gte(holidaysTable.date, `${year}-01-01`),
          lte(holidaysTable.date, `${year}-12-31`),
        ))
        .orderBy(holidaysTable.date);
    } else {
      holidays = await db.select().from(holidaysTable).orderBy(holidaysTable.date);
    }
    res.json(holidays);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao listar feriados" });
  }
});

// ─── CHECK DATE ───────────────────────────────────────────────────────────────

router.get("/holidays/check", async (req, res): Promise<void> => {
  try {
    const { date } = req.query;
    if (!date || typeof date !== "string") {
      res.status(400).json({ error: "Data inválida" });
      return;
    }
    const [holiday] = await db.select().from(holidaysTable)
      .where(and(
        eq(holidaysTable.date, date),
        eq(holidaysTable.active, true),
      ));
    res.json({ isHoliday: !!holiday, holiday: holiday ?? null });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao verificar feriado" });
  }
});

// ─── SEED NATIONAL ────────────────────────────────────────────────────────────

router.post("/holidays/seed-national", requireAuth, async (req, res): Promise<void> => {
  try {
    const year = req.body.year ? Number(req.body.year) : new Date().getFullYear();
    const toInsert = getBrazilianNationalHolidays(year);

    const existing = await db.select({ date: holidaysTable.date }).from(holidaysTable)
      .where(and(
        gte(holidaysTable.date, `${year}-01-01`),
        lte(holidaysTable.date, `${year}-12-31`),
        eq(holidaysTable.type, "Nacional"),
      ));
    const existingDates = new Set(existing.map(h => h.date));
    const newOnes = toInsert.filter(h => !existingDates.has(h.date));

    if (newOnes.length === 0) {
      res.json({ message: "Feriados nacionais já cadastrados para este ano", count: 0 });
      return;
    }
    const inserted = await db.insert(holidaysTable).values(newOnes).returning();
    res.status(201).json({ message: `${inserted.length} feriados nacionais cadastrados para ${year}`, count: inserted.length, holidays: inserted });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao importar feriados" });
  }
});

// ─── AFFECTED APPOINTMENTS ────────────────────────────────────────────────────

router.get("/holidays/:id/affected", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const [holiday] = await db.select().from(holidaysTable).where(eq(holidaysTable.id, id));
    if (!holiday) { res.status(404).json({ error: "Feriado não encontrado" }); return; }

    const affected = await db.select({
      id: appointmentsTable.id, date: appointmentsTable.date, time: appointmentsTable.time,
      status: appointmentsTable.status, notes: appointmentsTable.notes,
      patientId: appointmentsTable.patientId, therapistId: appointmentsTable.therapistId,
      patientName: patientsTable.name, therapistName: therapistsTable.name,
    })
      .from(appointmentsTable)
      .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id))
      .where(and(
        eq(appointmentsTable.date, holiday.date),
        sql`${appointmentsTable.status} NOT IN ('cancelado', 'remarcado', 'falta')`,
      ));

    res.json({ holiday, affected });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao buscar agendamentos afetados" });
  }
});

// ─── AUTO-RESCHEDULE ──────────────────────────────────────────────────────────

const RESCHEDULE_SLOTS = [
  "07:00","07:30","08:00","08:30","09:00","09:30",
  "10:00","10:30","11:00","11:30","12:00","12:30",
  "13:00","13:30","14:00","14:30","15:00","15:30",
  "16:00","16:30","17:00","17:30","18:00",
];

router.post("/holidays/:id/auto-reschedule", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const [holiday] = await db.select().from(holidaysTable).where(eq(holidaysTable.id, id));
    if (!holiday) { res.status(404).json({ error: "Feriado não encontrado" }); return; }

    const affected = await db.select({
      id: appointmentsTable.id, date: appointmentsTable.date, time: appointmentsTable.time,
      status: appointmentsTable.status, notes: appointmentsTable.notes,
      patientId: appointmentsTable.patientId, therapistId: appointmentsTable.therapistId,
      resourceId: appointmentsTable.resourceId,
      patientName: patientsTable.name, therapistName: therapistsTable.name,
    })
      .from(appointmentsTable)
      .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id))
      .where(and(
        eq(appointmentsTable.date, holiday.date),
        sql`${appointmentsTable.status} NOT IN ('cancelado', 'remarcado', 'falta')`,
      ));

    const rescheduled: any[] = [];
    const pending: any[] = [];

    for (const apt of affected) {
      // Search for next available slot starting from the day after the holiday
      const holidayDate = new Date(holiday.date + "T12:00:00");
      let found = false;

      for (let dayOffset = 1; dayOffset <= 30 && !found; dayOffset++) {
        const tryDate = new Date(holidayDate);
        tryDate.setDate(tryDate.getDate() + dayOffset);
        const tryDateStr = tryDate.toISOString().split("T")[0];
        const dayOfWeek = tryDate.getDay();

        // Skip Sundays (0)
        if (dayOfWeek === 0) continue;

        // Check if tryDate is itself a holiday
        const [isHoliday] = await db.select({ id: holidaysTable.id }).from(holidaysTable)
          .where(and(eq(holidaysTable.date, tryDateStr), eq(holidaysTable.active, true)));
        if (isHoliday) continue;

        // Try to keep same time slot first, then try others
        const slotsToTry = [apt.time, ...RESCHEDULE_SLOTS.filter(s => s !== apt.time)];

        for (const slot of slotsToTry) {
          // Check patient conflict
          const patientConflict = await db.select({ id: appointmentsTable.id }).from(appointmentsTable)
            .where(and(
              eq(appointmentsTable.patientId, apt.patientId),
              eq(appointmentsTable.date, tryDateStr),
              eq(appointmentsTable.time, slot),
              sql`${appointmentsTable.status} NOT IN ('cancelado', 'remarcado')`,
            ));
          if (patientConflict.length > 0) continue;

          // Check therapist conflict
          const therapistConflict = await db.select({ id: appointmentsTable.id }).from(appointmentsTable)
            .where(and(
              eq(appointmentsTable.therapistId, apt.therapistId),
              eq(appointmentsTable.date, tryDateStr),
              eq(appointmentsTable.time, slot),
              sql`${appointmentsTable.status} NOT IN ('cancelado', 'remarcado')`,
            ));
          if (therapistConflict.length > 0) continue;

          // Mark old as remarcado
          await db.update(appointmentsTable)
            .set({ status: "remarcado" })
            .where(eq(appointmentsTable.id, apt.id));

          // Create new appointment
          const [newApt] = await db.insert(appointmentsTable).values({
            patientId: apt.patientId,
            therapistId: apt.therapistId,
            resourceId: apt.resourceId ?? null,
            date: tryDateStr,
            time: slot,
            status: "agendado",
            notes: apt.notes ?? null,
            originalAppointmentId: apt.id,
          }).returning();

          // Log the auto-reschedule
          await db.insert(appointmentContactsTable).values({
            appointmentId: newApt.id,
            type: "status_change",
            content: `Remarcado automaticamente devido ao feriado: ${holiday.description} (${holiday.date})`,
            performedBy: "sistema",
          });

          rescheduled.push({ original: apt, newDate: tryDateStr, newTime: slot, newId: newApt.id });
          found = true;
          break;
        }
      }

      if (!found) {
        pending.push(apt);
      }
    }

    res.json({
      rescheduled: rescheduled.length,
      pending: pending.length,
      details: { rescheduled, pending },
      message: `${rescheduled.length} agendamento(s) remarcado(s) automaticamente. ${pending.length} em pendência.`,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao remarcar automaticamente" });
  }
});

// ─── CREATE ───────────────────────────────────────────────────────────────────

router.post("/holidays", requireAuth, async (req, res): Promise<void> => {
  try {
    const { date, description, type } = req.body;
    if (!date || !description) {
      res.status(400).json({ error: "Data e descrição são obrigatórios" });
      return;
    }
    const [holiday] = await db.insert(holidaysTable).values({
      date, description, type: type ?? "Nacional",
    }).returning();
    res.status(201).json(holiday);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao criar feriado" });
  }
});

// ─── UPDATE ───────────────────────────────────────────────────────────────────

router.patch("/holidays/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const { date, description, type, active } = req.body;
    const update: Record<string, unknown> = {};
    if (date !== undefined) update.date = date;
    if (description !== undefined) update.description = description;
    if (type !== undefined) update.type = type;
    if (active !== undefined) update.active = active;
    const [holiday] = await db.update(holidaysTable).set(update).where(eq(holidaysTable.id, id)).returning();
    if (!holiday) { res.status(404).json({ error: "Feriado não encontrado" }); return; }
    res.json(holiday);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao atualizar feriado" });
  }
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

router.delete("/holidays/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const [holiday] = await db.delete(holidaysTable).where(eq(holidaysTable.id, id)).returning();
    if (!holiday) { res.status(404).json({ error: "Feriado não encontrado" }); return; }
    res.sendStatus(204);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao excluir feriado" });
  }
});

export default router;
