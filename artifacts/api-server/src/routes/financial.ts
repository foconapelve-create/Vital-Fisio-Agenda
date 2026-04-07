import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { db, financialTable, patientsTable } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

function buildSelect() {
  return {
    id: financialTable.id,
    description: financialTable.description,
    type: financialTable.type,
    amount: financialTable.amount,
    paymentStatus: financialTable.paymentStatus,
    category: financialTable.category,
    dueDate: financialTable.dueDate,
    paymentDate: financialTable.paymentDate,
    patientId: financialTable.patientId,
    paymentMethod: financialTable.paymentMethod,
    notes: financialTable.notes,
    createdAt: financialTable.createdAt,
    updatedAt: financialTable.updatedAt,
  };
}

router.get("/financial", requireAuth, async (req, res): Promise<void> => {
  const { startDate, endDate, type, paymentStatus } = req.query as Record<string, string>;

  const conditions = [];
  if (startDate) conditions.push(gte(financialTable.createdAt, new Date(startDate)));
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(financialTable.createdAt, end));
  }
  if (type) conditions.push(eq(financialTable.type, type));
  if (paymentStatus) conditions.push(eq(financialTable.paymentStatus, paymentStatus));

  const baseQuery = db
    .select({
      ...buildSelect(),
      patientName: patientsTable.name,
    })
    .from(financialTable)
    .leftJoin(patientsTable, eq(financialTable.patientId, patientsTable.id));

  const records = conditions.length > 0
    ? await baseQuery.where(and(...conditions)).orderBy(desc(financialTable.createdAt))
    : await baseQuery.orderBy(desc(financialTable.createdAt));

  res.json(records);
});

router.get("/financial/summary", requireAuth, async (req, res): Promise<void> => {
  const { month, year } = req.query as Record<string, string>;

  const conditions = [];
  if (month && year) {
    const startDate = new Date(`${year}-${month.padStart(2, "0")}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);
    endDate.setHours(23, 59, 59, 999);
    conditions.push(gte(financialTable.createdAt, startDate));
    conditions.push(lte(financialTable.createdAt, endDate));
  }

  const allRecords = conditions.length > 0
    ? await db.select(buildSelect()).from(financialTable).where(and(...conditions))
    : await db.select(buildSelect()).from(financialTable);

  const totalReceitas = allRecords
    .filter((r) => r.type === "receita" && r.paymentStatus === "pago")
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  const totalDespesas = allRecords
    .filter((r) => r.type === "despesa" && r.paymentStatus === "pago")
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  const totalPendente = allRecords
    .filter((r) => r.paymentStatus === "pendente")
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  const totalVencido = allRecords
    .filter((r) => r.paymentStatus === "vencido")
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  res.json({
    totalReceitas,
    totalDespesas,
    saldo: totalReceitas - totalDespesas,
    totalPendente,
    totalVencido,
    countReceitas: allRecords.filter((r) => r.type === "receita").length,
    countDespesas: allRecords.filter((r) => r.type === "despesa").length,
  });
});

router.post("/financial", requireAuth, async (req, res): Promise<void> => {
  const { description, type, amount, paymentStatus, category, dueDate, paymentDate, patientId, paymentMethod, notes } = req.body;

  if (!description || !type || amount === undefined) {
    res.status(400).json({ error: "Campos obrigatórios: description, type, amount" });
    return;
  }

  const [record] = await db
    .insert(financialTable)
    .values({
      description,
      type,
      amount: Number(amount),
      paymentStatus: paymentStatus ?? "pendente",
      category: category ?? null,
      dueDate: dueDate ?? null,
      paymentDate: paymentDate ?? null,
      patientId: patientId ? Number(patientId) : null,
      paymentMethod: paymentMethod ?? null,
      notes: notes ?? null,
    })
    .returning();

  res.status(201).json(record);
});

router.put("/financial/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const { description, type, amount, paymentStatus, category, dueDate, paymentDate, patientId, paymentMethod, notes } = req.body;

  const [updated] = await db
    .update(financialTable)
    .set({
      description,
      type,
      amount: amount !== undefined ? Number(amount) : undefined,
      paymentStatus,
      category: category ?? null,
      dueDate: dueDate ?? null,
      paymentDate: paymentDate ?? null,
      patientId: patientId ? Number(patientId) : null,
      paymentMethod: paymentMethod ?? null,
      notes: notes ?? null,
    })
    .where(eq(financialTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Registro não encontrado" });
    return;
  }

  res.json(updated);
});

router.delete("/financial/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  await db.delete(financialTable).where(eq(financialTable.id, id));
  res.status(204).send();
});

export default router;
