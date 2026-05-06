import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { pool } from "@workspace/db";

const router: IRouter = Router();

function mapUser(u: any) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email || null,
    phone: u.phone || null,
    role: u.role,
    active: u.active !== false,
  };
}

// ── Login ──────────────────────────────────────────────────────────────────────

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: "Usuário e senha são obrigatórios" });
    return;
  }

  // Support login by username or email (case-insensitive, trim spaces)
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE (LOWER(TRIM(username)) = LOWER(TRIM($1)) OR LOWER(TRIM(COALESCE(email,''))) = LOWER(TRIM($1))) AND active = true LIMIT 1",
    [username.trim()]
  );
  const user = rows[0];

  if (!user) {
    res.status(401).json({ error: "Usuário ou senha inválidos" });
    return;
  }

  // Support both bcrypt and plain passwords (migration fallback)
  let match = false;
  if (user.password && user.password.startsWith("$2")) {
    match = await bcrypt.compare(password, user.password);
  } else {
    match = user.password === password;
    if (match) {
      // Auto-migrate to bcrypt
      const hash = await bcrypt.hash(password, 10);
      await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hash, user.id]);
    }
  }

  if (!match) {
    res.status(401).json({ error: "Usuário ou senha inválidos" });
    return;
  }

  (req.session as any).userId = user.id;
  (req.session as any).username = user.username;
  (req.session as any).role = user.role;

  res.json(mapUser(user));
});

// ── Logout ─────────────────────────────────────────────────────────────────────

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.json({ message: "Logout realizado com sucesso" });
  });
});

// ── Me ─────────────────────────────────────────────────────────────────────────

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId as number | undefined;
  if (!userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  const user = rows[0];

  if (!user) {
    res.status(401).json({ error: "Usuário não encontrado" });
    return;
  }

  res.json(mapUser(user));
});

// ── Register ───────────────────────────────────────────────────────────────────

router.post("/auth/register", async (req, res): Promise<void> => {
  const { name, username, email, phone, password, confirmPassword, role } = req.body || {};

  if (!name || !password) {
    res.status(400).json({ error: "Nome e senha são obrigatórios" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
    return;
  }
  if (password !== confirmPassword) {
    res.status(400).json({ error: "Senhas não conferem" });
    return;
  }
  if (!username && !email) {
    res.status(400).json({ error: "Informe nome de usuário ou e-mail" });
    return;
  }

  // Check duplicates
  if (username) {
    const { rows } = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    if (rows.length) { res.status(400).json({ error: "Nome de usuário já em uso" }); return; }
  }
  if (email) {
    const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (rows.length) { res.status(400).json({ error: "E-mail já cadastrado" }); return; }
  }

  const validRoles = ["admin", "fisioterapeuta", "profissional", "financeiro", "recepcao"];
  const userRole = validRoles.includes(role) ? role : "profissional";
  const hash = await bcrypt.hash(password, 10);
  const uname = username || (email ? email.split("@")[0] : name.toLowerCase().replace(/\s+/g, "."));

  try {
    const { rows } = await pool.query(
      "INSERT INTO users (username, password, name, email, phone, role, active) VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING *",
      [uname, hash, name, email || null, phone || null, userRole]
    );
    res.status(201).json(mapUser(rows[0]));
  } catch (e: any) {
    if (e.code === "23505") {
      res.status(400).json({ error: "Usuário ou e-mail já cadastrado" });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

// ── Forgot Password ─────────────────────────────────────────────────────────────

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body || {};
  if (!email) {
    res.status(400).json({ error: "Informe seu e-mail" });
    return;
  }

  const { rows } = await pool.query(
    "SELECT * FROM users WHERE email = $1 AND active = true LIMIT 1",
    [email]
  );
  const user = rows[0];

  // Always respond success to avoid email enumeration
  if (!user) {
    res.json({ message: "Se este e-mail estiver cadastrado, você receberá um link em breve" });
    return;
  }

  // Invalidate existing tokens
  await pool.query("UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false", [user.id]);

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await pool.query(
    "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)",
    [user.id, token, expiresAt]
  );

  res.json({
    message: "Link de redefinição gerado com sucesso",
    token, // In production, only send via email
    email: user.email,
    expiresAt,
  });
});

// ── Reset Password ─────────────────────────────────────────────────────────────

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password, confirmPassword } = req.body || {};
  if (!token || !password) {
    res.status(400).json({ error: "Token e nova senha são obrigatórios" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
    return;
  }
  if (password !== confirmPassword) {
    res.status(400).json({ error: "Senhas não conferem" });
    return;
  }

  const { rows } = await pool.query(
    "SELECT * FROM password_reset_tokens WHERE token = $1 AND used = false AND expires_at > NOW()",
    [token]
  );
  const resetToken = rows[0];

  if (!resetToken) {
    res.status(400).json({ error: "Token inválido ou expirado" });
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hash, resetToken.user_id]);
  await pool.query("UPDATE password_reset_tokens SET used = true WHERE id = $1", [resetToken.id]);

  res.json({ message: "Senha redefinida com sucesso" });
});

// ── Validate Reset Token ───────────────────────────────────────────────────────

router.get("/auth/validate-token/:token", async (req, res): Promise<void> => {
  const { rows } = await pool.query(
    "SELECT prt.*, u.name, u.email FROM password_reset_tokens prt JOIN users u ON prt.user_id = u.id WHERE prt.token = $1 AND prt.used = false AND prt.expires_at > NOW()",
    [req.params.token]
  );
  if (!rows.length) {
    res.status(400).json({ valid: false, error: "Token inválido ou expirado" });
    return;
  }
  res.json({ valid: true, name: rows[0].name, email: rows[0].email });
});

export default router;
