import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, therapistsTable } from "@workspace/db";
import {
  CreateTherapistBody,
  UpdateTherapistBody,
  GetTherapistParams,
  UpdateTherapistParams,
  DeleteTherapistParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/therapists", async (_req, res): Promise<void> => {
  const therapists = await db.select().from(therapistsTable).orderBy(therapistsTable.name);
  res.json(therapists);
});

router.post("/therapists", async (req, res): Promise<void> => {
  const parsed = CreateTherapistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [therapist] = await db
    .insert(therapistsTable)
    .values({
      name: parsed.data.name,
      specialty: parsed.data.specialty,
      phone: parsed.data.phone,
      availableHours: parsed.data.availableHours ?? null,
    })
    .returning();

  res.status(201).json(therapist);
});

router.get("/therapists/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetTherapistParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [therapist] = await db
    .select()
    .from(therapistsTable)
    .where(eq(therapistsTable.id, params.data.id));

  if (!therapist) {
    res.status(404).json({ error: "Fisioterapeuta não encontrado" });
    return;
  }

  res.json(therapist);
});

router.patch("/therapists/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateTherapistParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTherapistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined) updateData.name = d.name;
  if (d.specialty !== undefined) updateData.specialty = d.specialty;
  if (d.phone !== undefined) updateData.phone = d.phone;
  if (d.availableHours !== undefined) updateData.availableHours = d.availableHours;

  const [therapist] = await db
    .update(therapistsTable)
    .set(updateData)
    .where(eq(therapistsTable.id, params.data.id))
    .returning();

  if (!therapist) {
    res.status(404).json({ error: "Fisioterapeuta não encontrado" });
    return;
  }

  res.json(therapist);
});

router.delete("/therapists/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteTherapistParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [therapist] = await db
    .delete(therapistsTable)
    .where(eq(therapistsTable.id, params.data.id))
    .returning();

  if (!therapist) {
    res.status(404).json({ error: "Fisioterapeuta não encontrado" });
    return;
  }

  res.sendStatus(204);
});

export default router;
