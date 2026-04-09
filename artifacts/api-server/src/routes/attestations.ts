import { Router } from "express";
import { db } from "@workspace/db";
import { attestationsTable, clinicSettingsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  next();
}

const router = Router();

// ── Clinic Settings ─────────────────────────────────────────────────────────

router.get("/clinic-settings", requireAuth, async (req, res) => {
  try {
    const rows = await db.select().from(clinicSettingsTable).limit(1);
    if (rows.length === 0) {
      // Create default row
      const [created] = await db.insert(clinicSettingsTable).values({ nomeClinica: "CliniSmart", enderecoClinica: "" }).returning();
      return res.json(created);
    }
    return res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/clinic-settings", requireAuth, async (req, res) => {
  try {
    const user = (req as any).session?.user;
    if (user?.role !== "admin") {
      return res.status(403).json({ error: "Apenas administradores podem editar as configurações da clínica" });
    }
    const { nomeClinica, enderecoClinica, telefone, email } = req.body;
    const rows = await db.select().from(clinicSettingsTable).limit(1);
    let result;
    if (rows.length === 0) {
      [result] = await db.insert(clinicSettingsTable).values({ nomeClinica, enderecoClinica, telefone, email }).returning();
    } else {
      [result] = await db.update(clinicSettingsTable)
        .set({ nomeClinica, enderecoClinica, telefone, email })
        .where(eq(clinicSettingsTable.id, rows[0].id))
        .returning();
    }
    return res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Attestations ─────────────────────────────────────────────────────────────

// GET /attestations?patientId=X
router.get("/attestations", requireAuth, async (req, res) => {
  try {
    const { patientId } = req.query;
    let rows;
    if (patientId) {
      rows = await db
        .select()
        .from(attestationsTable)
        .where(eq(attestationsTable.patientId, parseInt(patientId as string)))
        .orderBy(desc(attestationsTable.createdAt));
    } else {
      rows = await db.select().from(attestationsTable).orderBy(desc(attestationsTable.createdAt)).limit(100);
    }
    return res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /attestations/:id
router.get("/attestations/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const rows = await db.select().from(attestationsTable).where(eq(attestationsTable.id, id));
    if (!rows.length) return res.status(404).json({ error: "Atestado não encontrado" });
    return res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /attestations
router.post("/attestations", requireAuth, async (req, res) => {
  try {
    const user = (req as any).session?.user;
    const {
      patientId, tipoDocumento, dataAtendimento, horaInicio, horaTermino,
      tipoAtendimento, outroTipoAtendimento, observacoes, profissionalResponsavel,
      registroProfissional, dataEmissao, cidade, enderecoClinica, textoGerado,
    } = req.body;

    if (!patientId || !dataAtendimento || !horaInicio || !horaTermino || !tipoAtendimento || !profissionalResponsavel || !dataEmissao) {
      return res.status(400).json({ error: "Campos obrigatórios não preenchidos" });
    }

    const [row] = await db.insert(attestationsTable).values({
      patientId: parseInt(patientId),
      tipoDocumento: tipoDocumento || "declaracao",
      dataAtendimento, horaInicio, horaTermino, tipoAtendimento,
      outroTipoAtendimento: outroTipoAtendimento || null,
      observacoes: observacoes || null,
      profissionalResponsavel, registroProfissional: registroProfissional || null,
      dataEmissao, cidade: cidade || null,
      enderecoClinica: enderecoClinica || null,
      textoGerado: textoGerado || null,
      criadoPor: user?.username || null,
      ativo: true,
    }).returning();

    return res.status(201).json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /attestations/:id
router.delete("/attestations/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(attestationsTable).set({ ativo: false }).where(eq(attestationsTable.id, id));
    return res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
