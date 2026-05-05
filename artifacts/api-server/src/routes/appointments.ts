import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql, ne, desc } from "drizzle-orm";
import { db, appointmentsTable, patientsTable, therapistsTable, appointmentContactsTable } from "@workspace/db";
import {
  CreateAppointmentBody, UpdateAppointmentBody,
  RescheduleAppointmentBody,
  ListAppointmentsQueryParams,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";
import { sendWhatsAppText, buildReminderMessage, buildSecondReminderMessage } from "../lib/zapi";

const ALL_STATUSES = [
  "agendado", "mensagem_enviada", "aguardando_confirmacao", "confirmado",
  "confirmado_recepcao", "solicitou_remarcacao", "nao_respondeu",
  "presente", "falta", "cancelado", "remarcado", "encaixe", "encaixe_preenchido",
] as const;

const router: IRouter = Router();

function buildSelect() {
  return {
    id: appointmentsTable.id, patientId: appointmentsTable.patientId,
    therapistId: appointmentsTable.therapistId, date: appointmentsTable.date,
    time: appointmentsTable.time, status: appointmentsTable.status,
    notes: appointmentsTable.notes, originalAppointmentId: appointmentsTable.originalAppointmentId,
    recurringGroupId: appointmentsTable.recurringGroupId,
    createdAt: appointmentsTable.createdAt, updatedAt: appointmentsTable.updatedAt,
    patientName: patientsTable.name, patientPhone: patientsTable.phone,
    therapistName: therapistsTable.name, therapistSpecialty: therapistsTable.specialty,
  };
}

async function getWithDetails(id: number) {
  const [apt] = await db.select(buildSelect()).from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id))
    .where(eq(appointmentsTable.id, id));
  return apt;
}

// ─── LIST ─────────────────────────────────────────────────────────────────────

router.get("/appointments", async (req, res): Promise<void> => {
  const query = ListAppointmentsQueryParams.safeParse(req.query);
  const filters = query.success ? query.data : {};

  const conditions = [];
  if (filters.date) conditions.push(eq(appointmentsTable.date, filters.date));
  if (filters.weekStart) {
    const endDate = new Date(filters.weekStart + "T12:00:00");
    endDate.setDate(endDate.getDate() + 6);
    conditions.push(gte(appointmentsTable.date, filters.weekStart));
    conditions.push(lte(appointmentsTable.date, endDate.toISOString().split("T")[0]));
  }
  if (filters.therapistId) conditions.push(eq(appointmentsTable.therapistId, Number(filters.therapistId)));
  if (filters.status) conditions.push(eq(appointmentsTable.status, filters.status));
  if (filters.patientId) conditions.push(eq(appointmentsTable.patientId, Number(filters.patientId)));

  const base = db.select(buildSelect()).from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id));

  const apts = conditions.length > 0
    ? await base.where(and(...conditions)).orderBy(appointmentsTable.date, appointmentsTable.time)
    : await base.orderBy(appointmentsTable.date, appointmentsTable.time);

  res.json(apts);
});

// ─── UPCOMING (confirmation funnel) ───────────────────────────────────────────

router.get("/appointments/upcoming", async (req, res): Promise<void> => {
  const days = parseInt(String(req.query.days ?? "3"));
  const today = new Date().toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + days);
  const futureStr = future.toISOString().split("T")[0];

  const apts = await db.select(buildSelect()).from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id))
    .where(and(
      gte(appointmentsTable.date, today),
      lte(appointmentsTable.date, futureStr),
      sql`${appointmentsTable.status} NOT IN ('cancelado', 'remarcado', 'falta')`,
    ))
    .orderBy(appointmentsTable.date, appointmentsTable.time);

  res.json(apts);
});

// ─── ENCAIXE OPPORTUNITIES (must be before /:id to avoid conflict) ───────────

router.get("/appointments/encaixe-opportunities", async (req, res): Promise<void> => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    const slots = ["08:00","08:40","09:20","10:00","10:40","11:20","13:30","14:10","14:50","15:30","16:10","16:50"];

    const existingApts = await db.select(buildSelect()).from(appointmentsTable)
      .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id))
      .where(and(
        gte(appointmentsTable.date, today),
        lte(appointmentsTable.date, tomorrow),
        sql`${appointmentsTable.status} NOT IN ('cancelado', 'remarcado')`,
      ));

    const allPatients = await db.select({ id: patientsTable.id, name: patientsTable.name, phone: patientsTable.phone, remainingSessions: patientsTable.remainingSessions })
      .from(patientsTable).where(sql`${patientsTable.remainingSessions} > 0`).limit(20);

    const freeSlots: Array<{ date: string; time: string }> = [];
    for (const date of [today, tomorrow]) {
      for (const time of slots) {
        const occupied = existingApts.filter(a => a.date === date && a.time === time);
        if (occupied.length === 0) freeSlots.push({ date, time });
      }
    }

    const requestingReschedule = existingApts.filter(a => a.status === "solicitou_remarcacao");
    res.json({ freeSlots, eligiblePatients: allPatients, requestingReschedule });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao buscar oportunidades de encaixe" });
  }
});

// ─── DELETE GROUP (must be before /:id to avoid conflict) ────────────────────

router.delete("/appointments/group/:groupId", async (req, res): Promise<void> => {
  const { groupId } = req.params;
  if (!groupId) { res.status(400).json({ error: "groupId inválido" }); return; }

  const deleted = await db.delete(appointmentsTable)
    .where(and(
      eq(appointmentsTable.recurringGroupId, groupId),
      sql`${appointmentsTable.status} NOT IN ('presente', 'falta')`,
    ))
    .returning();

  res.json({ deleted: deleted.length, message: `${deleted.length} sessões removidas` });
});

// ─── CREATE SINGLE ────────────────────────────────────────────────────────────

router.post("/appointments", async (req, res): Promise<void> => {
  try {
    const parsed = CreateAppointmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos: paciente, fisioterapeuta, data e horário são obrigatórios" });
      return;
    }

    const { patientId, therapistId, date, time, status, notes } = parsed.data;

    // Conflict check
    const conflict = await db.select({ id: appointmentsTable.id }).from(appointmentsTable)
      .where(and(
        eq(appointmentsTable.patientId, patientId),
        eq(appointmentsTable.date, date),
        eq(appointmentsTable.time, time),
        sql`${appointmentsTable.status} NOT IN ('cancelado', 'remarcado')`,
      ));

    if (conflict.length > 0) {
      res.status(409).json({ error: "Paciente já possui agendamento neste horário" });
      return;
    }

    const [apt] = await db.insert(appointmentsTable).values({
      patientId, therapistId, date, time,
      status: status ?? "agendado",
      notes: notes ?? null,
    }).returning();

    const withDetails = await getWithDetails(apt.id);
    res.status(201).json(withDetails);
  } catch (e: any) {
    console.error("Create appointment error:", e);
    res.status(500).json({ error: e.message || "Erro ao criar agendamento" });
  }
});

// ─── CREATE RECURRING ─────────────────────────────────────────────────────────

router.post("/appointments/recurring", async (req, res): Promise<void> => {
  try {
    const { patientId, therapistId, startDate, time, notes, recurrenceType, weekDays, totalCount, endDate } = req.body;

    if (!patientId || !therapistId || !startDate || !time || !recurrenceType) {
      res.status(400).json({ error: "Preencha: paciente, fisioterapeuta, data de início, horário e tipo de recorrência" });
      return;
    }

    if (recurrenceType === "dias_semana" && (!Array.isArray(weekDays) || weekDays.length === 0)) {
      res.status(400).json({ error: "Selecione pelo menos um dia da semana para a recorrência" });
      return;
    }

    const groupId = randomUUID();
    const dates: string[] = [];
    const start = new Date(startDate + "T12:00:00");
    const end = endDate ? new Date(endDate + "T23:59:59") : null;
    const maxCount = totalCount ? Math.min(parseInt(String(totalCount)), 200) : 52;

    if (recurrenceType === "diaria") {
      let curr = new Date(start);
      while (dates.length < maxCount && (!end || curr <= end)) {
        dates.push(curr.toISOString().split("T")[0]);
        curr.setDate(curr.getDate() + 1);
      }
    } else if (recurrenceType === "semanal") {
      let curr = new Date(start);
      while (dates.length < maxCount && (!end || curr <= end)) {
        dates.push(curr.toISOString().split("T")[0]);
        curr.setDate(curr.getDate() + 7);
      }
    } else if (recurrenceType === "dias_semana") {
      const days: number[] = weekDays.map(Number);
      let curr = new Date(start);
      for (let i = 0; i < 730 && dates.length < maxCount && (!end || curr <= end); i++) {
        if (days.includes(curr.getDay())) {
          dates.push(curr.toISOString().split("T")[0]);
        }
        curr.setDate(curr.getDate() + 1);
      }
    }

    if (dates.length === 0) {
      res.status(400).json({ error: "Nenhuma data gerada. Verifique os parâmetros de recorrência." });
      return;
    }

    const created: number[] = [];
    const skipped: string[] = [];

    for (const date of dates) {
      const conflict = await db.select({ id: appointmentsTable.id }).from(appointmentsTable)
        .where(and(
          eq(appointmentsTable.patientId, Number(patientId)),
          eq(appointmentsTable.date, date),
          eq(appointmentsTable.time, time),
          sql`${appointmentsTable.status} NOT IN ('cancelado', 'remarcado')`,
        ));

      if (conflict.length === 0) {
        const [apt] = await db.insert(appointmentsTable).values({
          patientId: Number(patientId), therapistId: Number(therapistId),
          date, time, status: "agendado",
          notes: notes ?? null, recurringGroupId: groupId,
        }).returning();
        created.push(apt.id);
      } else {
        skipped.push(date);
      }
    }

    res.status(201).json({
      created: created.length, skipped: skipped.length, groupId,
      message: `${created.length} sessão(ões) criada(s)${skipped.length > 0 ? `, ${skipped.length} ignorada(s) por conflito de horário` : ""}`,
    });
  } catch (e: any) {
    console.error("Recurring error:", e);
    res.status(500).json({ error: e.message || "Erro ao criar recorrência" });
  }
});

// ─── GET BY ID ────────────────────────────────────────────────────────────────

router.get("/appointments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const apt = await getWithDetails(id);
  if (!apt) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }
  res.json(apt);
});

// ─── UPDATE ───────────────────────────────────────────────────────────────────

router.patch("/appointments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados inválidos" }); return; }

  const d = parsed.data;
  const update: Record<string, unknown> = {};
  if (d.patientId !== undefined) update.patientId = d.patientId;
  if (d.therapistId !== undefined) update.therapistId = d.therapistId;
  if (d.date !== undefined) update.date = d.date;
  if (d.time !== undefined) update.time = d.time;
  if (d.status !== undefined) update.status = d.status;
  if (d.notes !== undefined) update.notes = d.notes;

  await db.update(appointmentsTable).set(update).where(eq(appointmentsTable.id, id));
  const apt = await getWithDetails(id);
  if (!apt) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }
  res.json(apt);
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

router.delete("/appointments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [apt] = await db.delete(appointmentsTable).where(eq(appointmentsTable.id, id)).returning();
  if (!apt) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }
  res.sendStatus(204);
});

// ─── CONTACT HISTORY ─────────────────────────────────────────────────────────

router.get("/appointments/:id/contacts", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const contacts = await db.select().from(appointmentContactsTable)
    .where(eq(appointmentContactsTable.appointmentId, id))
    .orderBy(desc(appointmentContactsTable.createdAt));
  res.json(contacts);
});

router.post("/appointments/:id/contacts", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const { type, content, performedBy } = req.body;
    if (!type) { res.status(400).json({ error: "type é obrigatório" }); return; }
    const [contact] = await db.insert(appointmentContactsTable).values({
      appointmentId: id,
      type: String(type),
      content: content ? String(content) : null,
      performedBy: performedBy ? String(performedBy) : "sistema",
    }).returning();
    res.status(201).json(contact);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao registrar contato" });
  }
});

// ─── UPDATE STATUS ────────────────────────────────────────────────────────────

router.patch("/appointments/:id/status", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const { status, performedBy } = req.body;
    if (!status || !ALL_STATUSES.includes(status)) {
      res.status(400).json({ error: `Status inválido. Use: ${ALL_STATUSES.join(", ")}` });
      return;
    }

    const [current] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, id));
    if (!current) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }

    const prevStatus = current.status;
    await db.update(appointmentsTable).set({ status }).where(eq(appointmentsTable.id, id));

    // Auto-log status change in contacts
    const statusLabel: Record<string, string> = {
      mensagem_enviada: "Mensagem WhatsApp enviada",
      aguardando_confirmacao: "Aguardando confirmação do paciente",
      confirmado: "Paciente confirmou presença",
      confirmado_recepcao: "Confirmado manualmente pela recepção",
      solicitou_remarcacao: "Paciente solicitou remarcação",
      nao_respondeu: "Paciente não respondeu",
      presente: "Paciente presente na sessão",
      falta: "Paciente faltou à sessão",
      cancelado: "Sessão cancelada",
      remarcado: "Sessão remarcada",
    };
    if (statusLabel[status] && status !== prevStatus) {
      await db.insert(appointmentContactsTable).values({
        appointmentId: id,
        type: "status_change",
        content: statusLabel[status],
        performedBy: performedBy ? String(performedBy) : "sistema",
      });
    }

    // Session count management
    if (status === "presente" && prevStatus !== "presente") {
      await db.update(patientsTable)
        .set({ remainingSessions: sql`GREATEST(${patientsTable.remainingSessions} - 1, 0)` })
        .where(eq(patientsTable.id, current.patientId));
    } else if (prevStatus === "presente" && status !== "presente") {
      await db.update(patientsTable)
        .set({ remainingSessions: sql`${patientsTable.remainingSessions} + 1` })
        .where(eq(patientsTable.id, current.patientId));
    }

    const apt = await getWithDetails(id);
    res.json(apt);
  } catch (e: any) {
    console.error("Status update error:", e);
    res.status(500).json({ error: e.message || "Erro ao atualizar status" });
  }
});

// ─── GENERATE WHATSAPP CONFIRMATION TOKEN + SEND VIA Z-API ──────────────────

router.post("/appointments/:id/whatsapp-token", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const [apt] = await db.select({
      id: appointmentsTable.id,
      status: appointmentsTable.status,
      date: appointmentsTable.date,
      time: appointmentsTable.time,
      patientName: patientsTable.name,
      patientPhone: patientsTable.phone,
      therapistName: therapistsTable.name,
    })
      .from(appointmentsTable)
      .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id))
      .where(eq(appointmentsTable.id, id));

    if (!apt) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }

    const token = randomUUID();
    await db.update(appointmentsTable)
      .set({ confirmationToken: token, tokenCreatedAt: new Date(), status: "mensagem_enviada" })
      .where(eq(appointmentsTable.id, id));

    const isSecond = req.body?.second === true;
    const domain = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : (process.env.APP_URL || "https://localhost");
    const confirmLink = `${domain}/confirmar?token=${token}`;

    const message = isSecond
      ? buildSecondReminderMessage({ patientName: apt.patientName, therapistName: apt.therapistName, date: apt.date, time: apt.time, confirmLink })
      : buildReminderMessage({ patientName: apt.patientName, therapistName: apt.therapistName, date: apt.date, time: apt.time, confirmLink });

    let whatsappResult: { success: boolean; error?: string } = { success: false, error: "Telefone não cadastrado" };
    if (apt.patientPhone) {
      whatsappResult = await sendWhatsAppText(apt.patientPhone, message);
    }

    const contactContent = whatsappResult.success
      ? `Mensagem WhatsApp ${isSecond ? "(2ª tentativa)" : ""} enviada via Z-API. Link: ${confirmLink}`
      : `Falha ao enviar WhatsApp: ${whatsappResult.error}. Link gerado: ${confirmLink}`;

    await db.insert(appointmentContactsTable).values({
      appointmentId: id,
      type: "whatsapp_sent",
      content: contactContent,
      performedBy: req.body?.performedBy ? String(req.body.performedBy) : "sistema",
    });

    res.json({ token, confirmLink, whatsappSent: whatsappResult.success, whatsappError: whatsappResult.error });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao gerar token" });
  }
});

// ─── RESCHEDULE ───────────────────────────────────────────────────────────────

router.post("/appointments/:id/reschedule", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const parsed = RescheduleAppointmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Informe a nova data e o novo horário para remarcar" });
      return;
    }

    const { date, time, therapistId } = parsed.data;

    const [original] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, id));
    if (!original) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }

    const targetTherapistId = (therapistId != null ? therapistId : null) ?? original.therapistId;

    // Conflict check (excluding self)
    const conflict = await db.select({ id: appointmentsTable.id }).from(appointmentsTable)
      .where(and(
        eq(appointmentsTable.patientId, original.patientId),
        eq(appointmentsTable.date, date),
        eq(appointmentsTable.time, time),
        ne(appointmentsTable.id, id),
        sql`${appointmentsTable.status} NOT IN ('cancelado', 'remarcado')`,
      ));

    if (conflict.length > 0) {
      res.status(409).json({ error: "Conflito: o paciente já tem outra sessão neste horário" });
      return;
    }

    // Restore session count if original was "presente"
    if (original.status === "presente") {
      await db.update(patientsTable)
        .set({ remainingSessions: sql`${patientsTable.remainingSessions} + 1` })
        .where(eq(patientsTable.id, original.patientId));
    }

    // Mark original as remarcado
    await db.update(appointmentsTable)
      .set({ status: "remarcado" })
      .where(eq(appointmentsTable.id, id));

    // Create new appointment
    const [newApt] = await db.insert(appointmentsTable).values({
      patientId: original.patientId,
      therapistId: targetTherapistId,
      date, time,
      status: "agendado",
      notes: original.notes,
      originalAppointmentId: id,
      recurringGroupId: original.recurringGroupId ?? null,
    }).returning();

    const withDetails = await getWithDetails(newApt.id);
    res.json(withDetails);
  } catch (e: any) {
    console.error("Reschedule error:", e);
    res.status(500).json({ error: e.message || "Erro ao remarcar sessão" });
  }
});

export default router;
