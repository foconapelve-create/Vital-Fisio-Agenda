import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

// ── Public: get system settings (no auth required) ────────────────────────────
router.get("/settings/public", async (_req, res): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT system_name, logo_url, nome_clinica, telefone, email FROM clinic_settings LIMIT 1`
    );
    if (!rows.length) {
      res.json({ systemName: "CliniSmart", logoUrl: null, nomeClinica: null });
      return;
    }
    const r = rows[0];
    res.json({
      systemName: r.system_name || "CliniSmart",
      logoUrl: r.logo_url || null,
      nomeClinica: r.nome_clinica || null,
      telefone: r.telefone || null,
      email: r.email || null,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

async function requireAdmin(req: any, res: any, next: any) {
  const userId = (req.session as any)?.userId;
  if (!userId) { res.status(401).json({ error: "Não autenticado" }); return; }
  const { rows } = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
  if (!rows.length || rows[0].role !== "admin") {
    res.status(403).json({ error: "Acesso restrito a administradores" }); return;
  }
  next();
}

// ── Admin: update system settings ─────────────────────────────────────────────
router.put("/settings/system", requireAdmin, async (req, res): Promise<void> => {
  const { systemName, logoUrl, nomeClinica, enderecoClinica, telefone, email } = req.body || {};
  try {
    const { rows } = await pool.query(`SELECT id FROM clinic_settings LIMIT 1`);
    if (!rows.length) {
      await pool.query(
        `INSERT INTO clinic_settings (system_name, logo_url, nome_clinica, endereco_clinica, telefone, email)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [systemName || "CliniSmart", logoUrl || null, nomeClinica || null, enderecoClinica || null, telefone || null, email || null]
      );
    } else {
      const updates: string[] = [];
      const vals: any[] = [];
      let idx = 1;
      if (systemName !== undefined) { updates.push(`system_name = $${idx++}`); vals.push(systemName); }
      if (logoUrl !== undefined)    { updates.push(`logo_url = $${idx++}`); vals.push(logoUrl || null); }
      if (nomeClinica !== undefined){ updates.push(`nome_clinica = $${idx++}`); vals.push(nomeClinica); }
      if (enderecoClinica !== undefined){ updates.push(`endereco_clinica = $${idx++}`); vals.push(enderecoClinica); }
      if (telefone !== undefined)   { updates.push(`telefone = $${idx++}`); vals.push(telefone); }
      if (email !== undefined)      { updates.push(`email = $${idx++}`); vals.push(email); }
      if (updates.length) {
        updates.push(`updated_at = NOW()`);
        vals.push(rows[0].id);
        await pool.query(`UPDATE clinic_settings SET ${updates.join(", ")} WHERE id = $${idx}`, vals);
      }
    }
    const { rows: updated } = await pool.query(`SELECT system_name, logo_url, nome_clinica, telefone, email FROM clinic_settings LIMIT 1`);
    const r = updated[0] || {};
    res.json({ systemName: r.system_name || "CliniSmart", logoUrl: r.logo_url || null, nomeClinica: r.nome_clinica || null });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
