import cron from "node-cron";
import { randomUUID } from "crypto";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { db, appointmentsTable, patientsTable, therapistsTable, appointmentContactsTable, pool } from "@workspace/db";
import { sendWhatsAppText, buildReminderMessage } from "./zapi";
import { logger } from "./logger";

async function getClinicName(): Promise<string> {
  try {
    const { rows } = await pool.query("SELECT system_name FROM clinic_settings LIMIT 1");
    return rows[0]?.system_name || "VitalFisio";
  } catch {
    return "VitalFisio";
  }
}

function getConfirmDomain(): string {
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  if (process.env.APP_URL) return process.env.APP_URL;
  return "https://localhost";
}

export async function runReminderJob(): Promise<{ sent: number; failed: number; skipped: number }> {
  const stats = { sent: 0, failed: 0, skipped: 0 };

  const now = new Date();
  // Window: appointments between now+22h and now+26h
  const windowStart = new Date(now.getTime() + 22 * 60 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 26 * 60 * 60 * 1000);

  // Format as "YYYY-MM-DD" to compare with text date column
  const dateStart = windowStart.toISOString().slice(0, 10);
  const dateEnd   = windowEnd.toISOString().slice(0, 10);

  try {
    const pending = await db
      .select({
        id: appointmentsTable.id,
        date: appointmentsTable.date,
        time: appointmentsTable.time,
        status: appointmentsTable.status,
        patientName: patientsTable.name,
        patientPhone: patientsTable.phone,
        therapistName: therapistsTable.name,
      })
      .from(appointmentsTable)
      .innerJoin(patientsTable,    eq(appointmentsTable.patientId,    patientsTable.id))
      .innerJoin(therapistsTable,  eq(appointmentsTable.therapistId,  therapistsTable.id))
      .where(
        and(
          inArray(appointmentsTable.status, ["agendado", "encaixe"]),
          isNull(appointmentsTable.confirmationToken),
          sql`${appointmentsTable.date} >= ${dateStart}`,
          sql`${appointmentsTable.date} <= ${dateEnd}`,
        )
      );

    logger.info({ count: pending.length }, "Scheduler: appointments pending reminder");

    const clinicName = await getClinicName();
    const domain = getConfirmDomain();

    for (const apt of pending) {
      if (!apt.patientPhone) {
        stats.skipped++;
        logger.warn({ id: apt.id }, "Scheduler: no phone, skipping");
        continue;
      }

      const token = randomUUID();
      const confirmLink = `${domain}/confirmar?token=${token}`;
      const message = buildReminderMessage({
        patientName:   apt.patientName,
        therapistName: apt.therapistName,
        date:          apt.date,
        time:          apt.time,
        confirmLink,
        clinicName,
      });

      // Persist token and update status before sending
      await db.update(appointmentsTable)
        .set({ confirmationToken: token, tokenCreatedAt: new Date(), status: "mensagem_enviada" })
        .where(eq(appointmentsTable.id, apt.id));

      const result = await sendWhatsAppText(apt.patientPhone, message);

      const logContent = result.success
        ? `Lembrete automático (24h) enviado via Z-API. Link: ${confirmLink}`
        : `Falha no lembrete automático: ${result.error}. Link gerado: ${confirmLink}`;

      await db.insert(appointmentContactsTable).values({
        appointmentId: apt.id,
        type:          "whatsapp_sent",
        content:       logContent,
        performedBy:   "sistema_automatico",
      });

      if (result.success) {
        stats.sent++;
        logger.info({ id: apt.id, patient: apt.patientName }, "Scheduler: reminder sent");
      } else {
        stats.failed++;
        logger.warn({ id: apt.id, error: result.error }, "Scheduler: reminder failed");
      }
    }
  } catch (e: any) {
    logger.error({ err: e.message }, "Scheduler: job error");
  }

  return stats;
}

export function startScheduler() {
  // Run every hour at minute :00
  cron.schedule("0 * * * *", async () => {
    logger.info("Scheduler: running 24h reminder check");
    const stats = await runReminderJob();
    logger.info(stats, "Scheduler: reminder job done");
  });

  logger.info("Scheduler: 24h reminder cron started (runs every hour)");
}
