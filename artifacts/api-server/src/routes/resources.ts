import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, resourcesTable } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

const DEFAULT_RESOURCES = [
  { name: "Eletroterapia 1", type: "Eletroterapia" },
  { name: "Eletroterapia 2", type: "Eletroterapia" },
  { name: "Eletroterapia 3", type: "Eletroterapia" },
  { name: "Eletroterapia 4", type: "Eletroterapia" },
  { name: "Mão/Punho 1", type: "Mão/Punho" },
  { name: "Mão/Punho 2", type: "Mão/Punho" },
  { name: "Maca 1", type: "Maca" },
  { name: "Maca 2", type: "Maca" },
  { name: "Maca 3", type: "Maca" },
  { name: "Maca 4", type: "Maca" },
  { name: "Espaldar 1", type: "Espaldar" },
  { name: "Barra 1", type: "Barra" },
  { name: "Cadeira de Exercícios 1", type: "Cadeira de Exercícios" },
  { name: "Cadeira de Exercícios 2", type: "Cadeira de Exercícios" },
  { name: "Tablado 1", type: "Tablado" },
  { name: "Tablado 2", type: "Tablado" },
  { name: "Espaldar 2", type: "Espaldar" },
  { name: "Espaldar 3", type: "Espaldar" },
  { name: "Cadeira Eletro 1", type: "Cadeira Eletro" },
  { name: "Cadeira Eletro 2", type: "Cadeira Eletro" },
];

// ─── LIST ─────────────────────────────────────────────────────────────────────

router.get("/resources", async (_req, res): Promise<void> => {
  try {
    const resources = await db.select().from(resourcesTable).orderBy(resourcesTable.id);
    res.json(resources);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao listar recursos" });
  }
});

// ─── SEED DEFAULTS ────────────────────────────────────────────────────────────

router.post("/resources/seed", requireAuth, async (_req, res): Promise<void> => {
  try {
    const existing = await db.select().from(resourcesTable);
    if (existing.length > 0) {
      res.json({ message: "Recursos já existem", count: existing.length });
      return;
    }
    const inserted = await db.insert(resourcesTable).values(DEFAULT_RESOURCES).returning();
    res.status(201).json({ message: "Recursos padrão criados", count: inserted.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao criar recursos padrão" });
  }
});

// ─── CREATE ───────────────────────────────────────────────────────────────────

router.post("/resources", requireAuth, async (req, res): Promise<void> => {
  try {
    const { name, type } = req.body;
    if (!name || !type) {
      res.status(400).json({ error: "Nome e tipo são obrigatórios" });
      return;
    }
    const [resource] = await db.insert(resourcesTable).values({ name, type }).returning();
    res.status(201).json(resource);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao criar recurso" });
  }
});

// ─── UPDATE ───────────────────────────────────────────────────────────────────

router.patch("/resources/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const { name, type, active } = req.body;
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (type !== undefined) update.type = type;
    if (active !== undefined) update.active = active;
    const [resource] = await db.update(resourcesTable).set(update).where(eq(resourcesTable.id, id)).returning();
    if (!resource) { res.status(404).json({ error: "Recurso não encontrado" }); return; }
    res.json(resource);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao atualizar recurso" });
  }
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

router.delete("/resources/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const [resource] = await db.delete(resourcesTable).where(eq(resourcesTable.id, id)).returning();
    if (!resource) { res.status(404).json({ error: "Recurso não encontrado" }); return; }
    res.sendStatus(204);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erro ao excluir recurso" });
  }
});

export default router;
