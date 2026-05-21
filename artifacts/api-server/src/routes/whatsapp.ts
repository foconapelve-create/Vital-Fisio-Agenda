import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, appointmentsTable, patientsTable, therapistsTable, appointmentContactsTable } from "@workspace/db";
import { randomUUID } from "crypto";
import { sendWhatsAppText, buildReminderMessage, buildSecondReminderMessage, checkZapiStatus } from "../lib/zapi";
import { pool } from "@workspace/db";
import { runReminderJob } from "../lib/scheduler";

const router: IRouter = Router();

function getAppDomain(): string {
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  if (process.env.APP_URL) return process.env.APP_URL;
  return "https://localhost";
}

// ─── SETTINGS: buscar configurações salvas ────────────────────────────────────

async function getSettings() {
  const { rows } = await pool.query("SELECT * FROM whatsapp_settings WHERE id = 1");
  return rows[0] || {
    clinic_name: "VitalFisio",
    message_template_1: "Olá, {nome}! 👋\n\nSua sessão de fisioterapia está marcada para *{data}* às *{hora}* com *{terapeuta}*.\n\nPor favor, confirme ou cancele sua presença neste link:\n{link}\n\nObrigado! — {clinica}",
    message_template_2: "⚠️ *Lembrete importante*, {nome}!\n\nAinda não recebemos sua confirmação para a sessão de *{data}* às *{hora}* com *{terapeuta}*.\n\nSua vaga pode ser liberada se não confirmar. Por favor, confirme agora:\n{link}\n\n— {clinica}",
    message_encaixe: "Olá, {nome}! Surgiu um horário disponível na clínica {clinica} para *{data}* às *{hora}*. Caso tenha interesse, responda esta mensagem para agendarmos.",
    auto_send_enabled: false,
    auto_send_time: "08:00",
  };
}

// ─── STATUS DA CONEXÃO Z-API ──────────────────────────────────────────────────

router.get("/whatsapp/status", async (_req, res): Promise<void> => {
  const status = await checkZapiStatus();
  res.json(status);
});

// ─── GET SETTINGS ─────────────────────────────────────────────────────────────

router.get("/whatsapp/settings", async (_req, res): Promise<void> => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT SETTINGS ─────────────────────────────────────────────────────────────

router.put("/whatsapp/settings", async (req, res): Promise<void> => {
  try {
    const { clinic_name, message_template_1, message_template_2, message_encaixe, auto_send_enabled, auto_send_time } = req.body || {};
    await pool.query(
      `UPDATE whatsapp_settings SET
        clinic_name = COALESCE($1, clinic_name),
        message_template_1 = COALESCE($2, message_template_1),
        message_template_2 = COALESCE($3, message_template_2),
        message_encaixe = COALESCE($4, message_encaixe),
        auto_send_enabled = COALESCE($5, auto_send_enabled),
        auto_send_time = COALESCE($6, auto_send_time),
        updated_at = now()
      WHERE id = 1`,
      [clinic_name, message_template_1, message_template_2, message_encaixe,
        auto_send_enabled !== undefined ? auto_send_enabled : null,
        auto_send_time]
    );
    const updated = await getSettings();
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
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
    const settings = await getSettings();

    const message = isSecond
      ? buildSecondReminderMessage({ patientName: apt.patientName, therapistName: apt.therapistName, date: apt.date, time: apt.time, confirmLink, clinicName: settings.clinic_name, template: settings.message_template_2 })
      : buildReminderMessage({ patientName: apt.patientName, therapistName: apt.therapistName, date: apt.date, time: apt.time, confirmLink, clinicName: settings.clinic_name, template: settings.message_template_1 });

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

// ─── DISPARO MANUAL DO CRON: lembretes 24h antes ────────────────────────────

router.post("/whatsapp/auto-remind", async (_req, res): Promise<void> => {
  try {
    const stats = await runReminderJob();
    res.json(stats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
