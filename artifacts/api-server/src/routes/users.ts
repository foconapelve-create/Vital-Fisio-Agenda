import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) return res.status(401).json({ error: "Não autenticado" });
  next();
}

async function requireAdmin(req: any, res: any, next: any) {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ error: "Não autenticado" });
  const { rows } = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
  if (!rows.length || rows[0].role !== "admin") return res.status(403).json({ error: "Acesso restrito a administradores" });
  next();
}

function mapUser(u: any) {
  return {
    id: u.id, username: u.username, name: u.name, email: u.email || null,
    phone: u.phone || null, role: u.role, active: u.active !== false,
    createdAt: u.created_at,
  };
}

const router = Router();

// ── List users ────────────────────────────────────────────────────────────────

router.get("/users", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users ORDER BY name");
    return res.json(rows.map(mapUser));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Create user (admin) ────────────────────────────────────────────────────────

router.post("/users", requireAdmin, async (req, res) => {
  try {
    const { name, username, email, phone, password, role } = req.body;
    if (!name || !password) return res.status(400).json({ error: "Nome e senha são obrigatórios" });
    if (password.length < 6) return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
    if (!username && !email) return res.status(400).json({ error: "Informe nome de usuário ou e-mail" });

    if (username) {
      const { rows } = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
      if (rows.length) return res.status(400).json({ error: "Nome de usuário já em uso" });
    }
    if (email) {
      const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
      if (rows.length) return res.status(400).json({ error: "E-mail já cadastrado" });
    }

    const validRoles = ["admin", "fisioterapeuta", "profissional", "financeiro"];
    const userRole = validRoles.includes(role) ? role : "profissional";
    const hash = await bcrypt.hash(password, 10);
    const uname = username || (email ? email.split("@")[0] : name.toLowerCase().replace(/\s+/g, "."));

    const { rows } = await pool.query(
      "INSERT INTO users (username, password, name, email, phone, role, active) VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING *",
      [uname, hash, name, email || null, phone || null, userRole]
    );
    return res.status(201).json(mapUser(rows[0]));
  } catch (e: any) {
    if ((e as any).code === "23505") return res.status(400).json({ error: "Usuário ou e-mail já cadastrado" });
    res.status(500).json({ error: e.message });
  }
});

// ── Update user ────────────────────────────────────────────────────────────────

router.put("/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, email, phone, role } = req.body;
    if (!name) return res.status(400).json({ error: "Nome é obrigatório" });

    if (email) {
      const { rows } = await pool.query("SELECT id FROM users WHERE email = $1 AND id != $2", [email, id]);
      if (rows.length) return res.status(400).json({ error: "E-mail já em uso por outro usuário" });
    }

    const validRoles = ["admin", "fisioterapeuta", "profissional", "financeiro"];
    const userRole = validRoles.includes(role) ? role : "profissional";
    const { rows } = await pool.query(
      "UPDATE users SET name=$1, email=$2, phone=$3, role=$4 WHERE id=$5 RETURNING *",
      [name, email || null, phone || null, userRole, id]
    );
    if (!rows.length) return res.status(404).json({ error: "Usuário não encontrado" });
    return res.json(mapUser(rows[0]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Toggle active ──────────────────────────────────────────────────────────────

router.patch("/users/:id/toggle-active", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { rows } = await pool.query(
      "UPDATE users SET active = NOT active WHERE id = $1 RETURNING *",
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Usuário não encontrado" });
    return res.json(mapUser(rows[0]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Admin reset password ────────────────────────────────────────────────────────

router.post("/users/:id/reset-password", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query("UPDATE users SET password=$1 WHERE id=$2 RETURNING id, name, username", [hash, id]);
    if (!rows.length) return res.status(404).json({ error: "Usuário não encontrado" });
    return res.json({ message: "Senha redefinida com sucesso", user: rows[0].name });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Delete user ────────────────────────────────────────────────────────────────

router.delete("/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { rows: check } = await pool.query("SELECT id FROM users WHERE id = $1", [id]);
    if (!check.length) return res.status(404).json({ error: "Usuário não encontrado" });

    // Prevent deleting yourself
    const myId = (req.session as any).userId;
    if (id === myId) return res.status(400).json({ error: "Não é possível excluir seu próprio usuário" });

    // Soft delete or hard delete?
    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    return res.json({ message: "Usuário excluído com sucesso" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
