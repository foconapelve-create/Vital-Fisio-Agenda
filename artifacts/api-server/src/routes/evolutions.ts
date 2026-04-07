import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, evolutionsTable, patientsTable, therapistsTable } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

router.get("/evolutions/patient/:patientId", requireAuth, async (req, res): Promise<void> => {
  const patientId = parseInt(req.params.patientId);
  if (isNaN(patientId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const evolutions = await db
    .select({
      id: evolutionsTable.id,
      patientId: evolutionsTable.patientId,
      therapistId: evolutionsTable.therapistId,
      appointmentId: evolutionsTable.appointmentId,
      date: evolutionsTable.date,
      content: evolutionsTable.content,
      createdAt: evolutionsTable.createdAt,
      updatedAt: evolutionsTable.updatedAt,
      therapistName: therapistsTable.name,
      therapistSpecialty: therapistsTable.specialty,
      patientName: patientsTable.name,
    })
    .from(evolutionsTable)
    .innerJoin(therapistsTable, eq(evolutionsTable.therapistId, therapistsTable.id))
    .innerJoin(patientsTable, eq(evolutionsTable.patientId, patientsTable.id))
    .where(eq(evolutionsTable.patientId, patientId))
    .orderBy(desc(evolutionsTable.date), desc(evolutionsTable.createdAt));

  res.json(evolutions);
});

router.post("/evolutions", requireAuth, async (req, res): Promise<void> => {
  const { patientId, therapistId, date, content, appointmentId } = req.body;

  if (!patientId || !therapistId || !date || !content) {
    res.status(400).json({ error: "Campos obrigatórios: patientId, therapistId, date, content" });
    return;
  }

  const [evolution] = await db
    .insert(evolutionsTable)
    .values({
      patientId: Number(patientId),
      therapistId: Number(therapistId),
      appointmentId: appointmentId ? Number(appointmentId) : null,
      date,
      content,
    })
    .returning();

  const [withDetails] = await db
    .select({
      id: evolutionsTable.id,
      patientId: evolutionsTable.patientId,
      therapistId: evolutionsTable.therapistId,
      appointmentId: evolutionsTable.appointmentId,
      date: evolutionsTable.date,
      content: evolutionsTable.content,
      createdAt: evolutionsTable.createdAt,
      updatedAt: evolutionsTable.updatedAt,
      therapistName: therapistsTable.name,
      therapistSpecialty: therapistsTable.specialty,
      patientName: patientsTable.name,
    })
    .from(evolutionsTable)
    .innerJoin(therapistsTable, eq(evolutionsTable.therapistId, therapistsTable.id))
    .innerJoin(patientsTable, eq(evolutionsTable.patientId, patientsTable.id))
    .where(eq(evolutionsTable.id, evolution.id));

  res.status(201).json(withDetails);
});

router.put("/evolutions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { content, date } = req.body;

  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const [updated] = await db
    .update(evolutionsTable)
    .set({ content, date })
    .where(eq(evolutionsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Evolução não encontrada" });
    return;
  }

  res.json(updated);
});

router.delete("/evolutions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  await db.delete(evolutionsTable).where(eq(evolutionsTable.id, id));
  res.status(204).send();
});

export default router;
