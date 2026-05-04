import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, appointmentsTable, patientsTable, therapistsTable, appointmentContactsTable } from "@workspace/db";

const router: IRouter = Router();

function buildSelect() {
  return {
    id: appointmentsTable.id,
    patientId: appointmentsTable.patientId,
    therapistId: appointmentsTable.therapistId,
    date: appointmentsTable.date,
    time: appointmentsTable.time,
    status: appointmentsTable.status,
    notes: appointmentsTable.notes,
    confirmationToken: appointmentsTable.confirmationToken,
    tokenCreatedAt: appointmentsTable.tokenCreatedAt,
    createdAt: appointmentsTable.createdAt,
    updatedAt: appointmentsTable.updatedAt,
    patientName: patientsTable.name,
    patientPhone: patientsTable.phone,
    therapistName: therapistsTable.name,
    therapistSpecialty: therapistsTable.specialty,
  };
}

async function getByToken(token: string) {
  const [apt] = await db.select(buildSelect()).from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id))
    .where(eq(appointmentsTable.confirmationToken, token));
  return apt ?? null;
}

// ─── GET appointment info by token (public) ──────────────────────────────────

router.get("/confirm", async (req, res): Promise<void> => {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token inválido ou ausente" });
    return;
  }

  const apt = await getByToken(token);
  if (!apt) {
    res.status(404).json({ error: "Link de confirmação inválido ou expirado" });
    return;
  }

  // Check 48h expiry
  if (apt.tokenCreatedAt) {
    const age = Date.now() - new Date(apt.tokenCreatedAt).getTime();
    if (age > 48 * 60 * 60 * 1000) {
      res.status(410).json({ error: "Este link de confirmação expirou (48h)" });
      return;
    }
  }

  res.json({
    patientName: apt.patientName,
    therapistName: apt.therapistName,
    date: apt.date,
    time: apt.time,
    status: apt.status,
    notes: apt.notes,
  });
});

// ─── CONFIRM (public) ─────────────────────────────────────────────────────────

router.post("/confirm", async (req, res): Promise<void> => {
  const { token } = req.body;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token inválido" });
    return;
  }

  const apt = await getByToken(token);
  if (!apt) {
    res.status(404).json({ error: "Link de confirmação inválido ou expirado" });
    return;
  }

  if (apt.tokenCreatedAt) {
    const age = Date.now() - new Date(apt.tokenCreatedAt).getTime();
    if (age > 48 * 60 * 60 * 1000) {
      res.status(410).json({ error: "Este link expirou" });
      return;
    }
  }

  if (apt.status === "confirmado" || apt.status === "presente") {
    res.json({ message: "Consulta já confirmada", status: apt.status });
    return;
  }

  await db.update(appointmentsTable)
    .set({ status: "confirmado" })
    .where(eq(appointmentsTable.id, apt.id));

  await db.insert(appointmentContactsTable).values({
    appointmentId: apt.id,
    type: "status_change",
    content: "Paciente confirmou presença via link WhatsApp",
    performedBy: "paciente",
  });

  res.json({ message: "Presença confirmada com sucesso!", status: "confirmado" });
});

// ─── CANCEL (public) ──────────────────────────────────────────────────────────

router.post("/cancel", async (req, res): Promise<void> => {
  const { token } = req.body;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token inválido" });
    return;
  }

  const apt = await getByToken(token);
  if (!apt) {
    res.status(404).json({ error: "Link de confirmação inválido ou expirado" });
    return;
  }

  if (apt.tokenCreatedAt) {
    const age = Date.now() - new Date(apt.tokenCreatedAt).getTime();
    if (age > 48 * 60 * 60 * 1000) {
      res.status(410).json({ error: "Este link expirou" });
      return;
    }
  }

  if (apt.status === "cancelado") {
    res.json({ message: "Consulta já cancelada", status: apt.status });
    return;
  }

  await db.update(appointmentsTable)
    .set({ status: "cancelado" })
    .where(eq(appointmentsTable.id, apt.id));

  await db.insert(appointmentContactsTable).values({
    appointmentId: apt.id,
    type: "status_change",
    content: "Paciente cancelou via link WhatsApp",
    performedBy: "paciente",
  });

  res.json({ message: "Consulta cancelada.", status: "cancelado" });
});

export default router;
