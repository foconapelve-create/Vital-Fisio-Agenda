import { Router } from "express";
import { pool } from "@workspace/db";

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) return res.status(401).json({ error: "Não autenticado" });
  next();
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const router = Router();

// ── Content Tasks ─────────────────────────────────────────────────────────────

router.get("/content-tasks", requireAuth, async (req, res) => {
  try {
    const { from, to, status, tipo, canal, prioridade, responsavel, objetivo } = req.query;
    let q = "SELECT * FROM content_tasks WHERE ativo = true";
    const p: any[] = [];
    if (from) { p.push(from); q += ` AND data >= $${p.length}`; }
    if (to) { p.push(to); q += ` AND data <= $${p.length}`; }
    if (status) { p.push(status); q += ` AND status = $${p.length}`; }
    if (tipo) { p.push(tipo); q += ` AND tipo = $${p.length}`; }
    if (canal) { p.push(canal); q += ` AND canal = $${p.length}`; }
    if (prioridade) { p.push(prioridade); q += ` AND prioridade = $${p.length}`; }
    if (responsavel) { p.push(`%${responsavel}%`); q += ` AND responsavel ILIKE $${p.length}`; }
    if (objetivo) { p.push(objetivo); q += ` AND objetivo = $${p.length}`; }
    q += " ORDER BY data ASC, hora ASC";
    const { rows } = await pool.query(q, p);
    return res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/content-tasks/stats", requireAuth, async (req, res) => {
  try {
    const today = todayStr();
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const sowStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, "0")}-${String(startOfWeek.getDate()).padStart(2, "0")}`;
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    const eowStr = `${endOfWeek.getFullYear()}-${String(endOfWeek.getMonth() + 1).padStart(2, "0")}-${String(endOfWeek.getDate()).padStart(2, "0")}`;
    const startOfMonth = today.slice(0, 7) + "-01";
    const endOfMonth = new Date(parseInt(today.slice(0, 4)), parseInt(today.slice(5, 7)), 0);
    const eomStr = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, "0")}-${String(endOfMonth.getDate()).padStart(2, "0")}`;

    const { rows } = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE data = $1) as today,
        COUNT(*) FILTER (WHERE data >= $2 AND data <= $3) as week,
        COUNT(*) FILTER (WHERE data >= $4 AND data <= $5) as month,
        COUNT(*) FILTER (WHERE status = 'pendente') as pendentes,
        COUNT(*) FILTER (WHERE status = 'em_criacao') as em_criacao,
        COUNT(*) FILTER (WHERE status = 'publicado') as publicados,
        COUNT(*) FILTER (WHERE data < $1 AND status NOT IN ('publicado','cancelado')) as atrasados
       FROM content_tasks WHERE ativo = true`,
      [today, sowStr, eowStr, startOfMonth, eomStr]
    );
    return res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/content-tasks/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM content_tasks WHERE id = $1 AND ativo = true", [parseInt(req.params.id)]);
    if (!rows.length) return res.status(404).json({ error: "Tarefa não encontrada" });
    return res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/content-tasks", requireAuth, async (req, res) => {
  try {
    const user = (req as any).session;
    const {
      title, tipo, objetivo, descricao, data, hora, responsavel, status,
      prioridade, canal, tema, publico_alvo, cta, observacoes,
      roteiro, legenda, cta_gerado, ideia_visual, hashtags, obs_estrategicas,
      recorrente, recorrencia,
    } = req.body;
    if (!title || !data) return res.status(400).json({ error: "Título e data são obrigatórios" });
    const { rows } = await pool.query(
      `INSERT INTO content_tasks (title, tipo, objetivo, descricao, data, hora, responsavel, status, prioridade,
        canal, tema, publico_alvo, cta, observacoes, roteiro, legenda, cta_gerado, ideia_visual, hashtags,
        obs_estrategicas, recorrente, recorrencia, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,
      [title, tipo||"post_estatico", objetivo||"engajamento", descricao||null, data, hora||"09:00",
       responsavel||null, status||"pendente", prioridade||"media", canal||"instagram",
       tema||null, publico_alvo||null, cta||null, observacoes||null,
       roteiro||null, legenda||null, cta_gerado||null, ideia_visual||null, hashtags||null, obs_estrategicas||null,
       recorrente||false, recorrencia||null, (req as any).session?.username || null]
    );
    await pool.query(
      "INSERT INTO content_task_history (task_id, action, performed_by) VALUES ($1, 'created', $2)",
      [rows[0].id, (req as any).session?.username || null]
    );
    return res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/content-tasks/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      title, tipo, objetivo, descricao, data, hora, responsavel, status,
      prioridade, canal, tema, publico_alvo, cta, observacoes,
      roteiro, legenda, cta_gerado, ideia_visual, hashtags, obs_estrategicas,
      recorrente, recorrencia,
    } = req.body;
    const { rows } = await pool.query(
      `UPDATE content_tasks SET
        title=$1, tipo=$2, objetivo=$3, descricao=$4, data=$5, hora=$6, responsavel=$7,
        status=$8, prioridade=$9, canal=$10, tema=$11, publico_alvo=$12, cta=$13, observacoes=$14,
        roteiro=$15, legenda=$16, cta_gerado=$17, ideia_visual=$18, hashtags=$19, obs_estrategicas=$20,
        recorrente=$21, recorrencia=$22, editado_por=$23, updated_at=NOW()
       WHERE id=$24 AND ativo=true RETURNING *`,
      [title, tipo, objetivo, descricao||null, data, hora||"09:00", responsavel||null,
       status||"pendente", prioridade||"media", canal||"instagram", tema||null, publico_alvo||null,
       cta||null, observacoes||null, roteiro||null, legenda||null, cta_gerado||null, ideia_visual||null,
       hashtags||null, obs_estrategicas||null, recorrente||false, recorrencia||null,
       (req as any).session?.username || null, id]
    );
    if (!rows.length) return res.status(404).json({ error: "Tarefa não encontrada" });
    await pool.query(
      "INSERT INTO content_task_history (task_id, action, performed_by) VALUES ($1, 'updated', $2)",
      [id, (req as any).session?.username || null]
    );
    return res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/content-tasks/:id/status", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const { rows } = await pool.query(
      "UPDATE content_tasks SET status=$1, updated_at=NOW() WHERE id=$2 AND ativo=true RETURNING *",
      [status, id]
    );
    if (!rows.length) return res.status(404).json({ error: "Tarefa não encontrada" });
    await pool.query(
      "INSERT INTO content_task_history (task_id, action, details, performed_by) VALUES ($1, 'status_changed', $2, $3)",
      [id, `Status alterado para ${status}`, (req as any).session?.username || null]
    );
    return res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/content-tasks/:id/duplicate", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { newDate } = req.body;
    const { rows: orig } = await pool.query("SELECT * FROM content_tasks WHERE id = $1", [id]);
    if (!orig.length) return res.status(404).json({ error: "Tarefa não encontrada" });
    const o = orig[0];
    const { rows } = await pool.query(
      `INSERT INTO content_tasks (title, tipo, objetivo, descricao, data, hora, responsavel, status,
        prioridade, canal, tema, publico_alvo, cta, observacoes, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pendente',$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [`${o.title} (cópia)`, o.tipo, o.objetivo, o.descricao, newDate||o.data, o.hora, o.responsavel,
       o.prioridade, o.canal, o.tema, o.publico_alvo, o.cta, o.observacoes,
       (req as any).session?.username || null]
    );
    return res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/content-tasks/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await pool.query("UPDATE content_tasks SET ativo=false, updated_at=NOW() WHERE id=$1", [id]);
    await pool.query(
      "INSERT INTO content_task_history (task_id, action, performed_by) VALUES ($1, 'deleted', $2)",
      [id, (req as any).session?.username || null]
    );
    return res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/content-tasks", requireAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: "IDs inválidos" });
    await pool.query(
      `UPDATE content_tasks SET ativo=false, updated_at=NOW() WHERE id = ANY($1)`,
      [ids]
    );
    return res.json({ ok: true, deleted: ids.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Content Ideas ─────────────────────────────────────────────────────────────

router.get("/content-ideas", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM content_ideas WHERE ativo = true ORDER BY created_at DESC");
    return res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/content-ideas", requireAuth, async (req, res) => {
  try {
    const { title, tema, objetivo, canal, observacao } = req.body;
    if (!title) return res.status(400).json({ error: "Título é obrigatório" });
    const { rows } = await pool.query(
      "INSERT INTO content_ideas (title, tema, objetivo, canal, observacao, criado_por) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [title, tema||null, objetivo||null, canal||null, observacao||null, (req as any).session?.username || null]
    );
    return res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/content-ideas/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("UPDATE content_ideas SET ativo=false WHERE id=$1", [parseInt(req.params.id)]);
    return res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/content-ideas/:id/to-task", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { data } = req.body;
    const { rows: ideas } = await pool.query("SELECT * FROM content_ideas WHERE id=$1", [id]);
    if (!ideas.length) return res.status(404).json({ error: "Ideia não encontrada" });
    const idea = ideas[0];
    const { rows: task } = await pool.query(
      `INSERT INTO content_tasks (title, objetivo, canal, tema, observacoes, data, criado_por, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pendente') RETURNING *`,
      [idea.title, idea.objetivo||"engajamento", idea.canal||"instagram", idea.tema, idea.observacao,
       data || todayStr(), (req as any).session?.username || null]
    );
    await pool.query("UPDATE content_ideas SET convertida=true WHERE id=$1", [id]);
    return res.status(201).json(task[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── AI Chat ───────────────────────────────────────────────────────────────────

router.post("/content-ai/chat", requireAuth, async (req, res) => {
  try {
    const { message, taskContext, history = [] } = req.body;

    const { openai } = await import("@workspace/integrations-openai-ai-server");

    const systemPrompt = `Você é um assistente especializado em marketing de conteúdo para clínicas de fisioterapia e saúde.
Você ajuda a criar:
- Legendas para redes sociais (Instagram, Facebook, TikTok)
- Roteiros para Reels e vídeos curtos
- Sequências de Stories
- Ideias de carrosséis educativos
- Textos de autoridade sobre fisioterapia
- CTAs (chamadas para ação)
- Calendários editoriais
- Campanhas promocionais

Contexto da clínica: CliniSmart — sistema inteligente para profissionais da saúde.
Sempre use linguagem próxima, empática e profissional.
Formate bem suas respostas usando markdown quando adequado.
Seja objetivo e prático — entregue conteúdo pronto para usar.
${taskContext ? `\n\nContexto da tarefa atual:\n${taskContext}` : ""}`;

    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10).map((h: any) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (e: any) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

export default router;
