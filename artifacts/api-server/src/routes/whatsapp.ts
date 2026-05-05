import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, appointmentsTable, patientsTable, therapistsTable, appointmentContactsTable } from "@workspace/db";
import { randomUUID } from "crypto";
import { sendWhatsAppText, buildReminderMessage, buildSecondReminderMessage, checkZapiStatus } from "../lib/zapi";

const router: IRouter = Router();

function getAppDomain(): string {
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  if (process.env.APP_URL) return process.env.APP_URL;
  return "https://localhost";
}

// ─── STATUS DA CONEXÃO Z-API ──────────────────────────────────────────────────

router.get("/whatsapp/status", async (_req, res): Promise<void> => {
  const status = await checkZapiStatus();
  res.json(status);
});

// ─── ENVIAR LEMBRETE MANUAL (24h) ────────────────────────────────────────────

router.post("/whatsapp/send/:appointmentId", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.appointmentId);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const isSecond = req.body?.second === true;

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
    if (!apt.patientPhone) { res.status(400).json({ error: "Paciente sem telefone cadastrado" }); return; }

    const token = randomUUID();
    await db.update(appointmentsTable)
      .set({ confirmationToken: token, tokenCreatedAt: new Date(), status: "mensagem_enviada" })
      .where(eq(appointmentsTable.id, id));

    const confirmLink = `${getAppDomain()}/confirmar?token=${token}`;

    const message = isSecond
      ? buildSecondReminderMessage({ patientName: apt.patientName, therapistName: apt.therapistName, date: apt.date, time: apt.time, confirmLink })
      : buildReminderMessage({ patientName: apt.patientName, therapistName: apt.therapistName, date: apt.date, time: apt.time, confirmLink });

    const result = await sendWhatsAppText(apt.patientPhone, message);

    await db.insert(appointmentContactsTable).values({
      appointmentId: id,
      type: "whatsapp_sent",
      content: result.success
        ? `Lembrete ${isSecond ? "(2ª tentativa)" : "(1ª tentativa)"} enviado via Z-API. Link: ${confirmLink}`
        : `Falha ao enviar WhatsApp: ${result.error}. Link gerado: ${confirmLink}`,
      performedBy: req.body?.performedBy ? String(req.body.performedBy) : "sistema",
    });

    res.json({ success: result.success, token, confirmLink, error: result.error });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DISPARO AUTOMÁTICO (CRON-LIKE): lembretes 24h antes ─────────────────────

router.post("/whatsapp/auto-remind", async (req, res): Promise<void> => {
  try {
    const now = new Date();

    // Janela: agendamentos entre 23h e 25h a partir de agora
    const from = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const fromDate = from.toISOString().slice(0, 10);
    const toDate = to.toISOString().slice(0, 10);

    const fromTime = from.toTimeString().slice(0, 5);
    const toTime = to.toTimeString().slice(0, 5);

    const candidates = await db.select({
      id: appointmentsTable.id,
      date: appointmentsTable.date,
      time: appointmentsTable.time,
      status: appointmentsTable.status,
      patientName: patientsTable.name,
      patientPhone: patientsTable.phone,
      therapistName: therapistsTable.name,
    })
      .from(appointmentsTable)
      .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id))
      .where(
        and(
          gte(appointmentsTable.date, fromDate),
          lte(appointmentsTable.date, toDate),
          sql`${appointmentsTable.status} IN ('agendado', 'encaixe')`
        )
      );

    // Filter by time window
    const filtered = candidates.filter(apt => {
      if (apt.date === fromDate && apt.date === toDate) {
        return apt.time >= fromTime && apt.time <= toTime;
      }
      if (apt.date === fromDate) return apt.time >= fromTime;
      if (apt.date === toDate) return apt.time <= toTime;
      return true;
    });

    const results: Array<{ id: number; patientName: string; sent: boolean; error?: string }> = [];

    for (const apt of filtered) {
      if (!apt.patientPhone) {
        results.push({ id: apt.id, patientName: apt.patientName, sent: false, error: "Sem telefone" });
        continue;
      }

      const token = randomUUID();
      await db.update(appointmentsTable)
        .set({ confirmationToken: token, tokenCreatedAt: new Date(), status: "mensagem_enviada" })
        .where(eq(appointmentsTable.id, apt.id));

      const confirmLink = `${getAppDomain()}/confirmar?token=${token}`;
      const message = buildReminderMessage({ patientName: apt.patientName, therapistName: apt.therapistName, date: apt.date, time: apt.time, confirmLink });

      const sendResult = await sendWhatsAppText(apt.patientPhone, message);

      await db.insert(appointmentContactsTable).values({
        appointmentId: apt.id,
        type: "whatsapp_sent",
        content: sendResult.success
          ? `Lembrete automático 24h enviado via Z-API. Link: ${confirmLink}`
          : `Falha no lembrete automático: ${sendResult.error}`,
        performedBy: "sistema",
      });

      results.push({ id: apt.id, patientName: apt.patientName, sent: sendResult.success, error: sendResult.error });
    }

    res.json({ processed: results.length, results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
