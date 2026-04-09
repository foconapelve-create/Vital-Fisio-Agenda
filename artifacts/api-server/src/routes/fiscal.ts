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

function mapSettings(r: any) {
  if (!r) return null;
  return {
    id: r.id, razaoSocial: r.razao_social, nomeFantasia: r.nome_fantasia, cnpj: r.cnpj,
    inscricaoMunicipal: r.inscricao_municipal, regimeTributario: r.regime_tributario,
    endereco: r.endereco, numero: r.numero, complemento: r.complemento, bairro: r.bairro,
    cidade: r.cidade, estado: r.estado, cep: r.cep, emailFiscal: r.email_fiscal,
    telefone: r.telefone, codigoServico: r.codigo_servico, aliquota: r.aliquota,
    cnae: r.cnae, serieNota: r.serie_nota, ambiente: r.ambiente, provedor: r.provedor,
    apiUrl: r.api_url, apiToken: r.api_token, updatedAt: r.updated_at,
  };
}

function mapInvoice(r: any) {
  if (!r) return null;
  return {
    id: r.id, numero: r.numero, pacienteId: r.paciente_id, pacienteNome: r.paciente_nome,
    pacienteCpf: r.paciente_cpf, pacienteEmail: r.paciente_email, pacienteEndereco: r.paciente_endereco,
    receitaId: r.receita_id, descricaoServico: r.descricao_servico, codigoServico: r.codigo_servico,
    aliquota: r.aliquota, valorServico: r.valor_servico, valorIss: r.valor_iss,
    valorDeducoes: r.valor_deducoes, profissional: r.profissional, formaPagamento: r.forma_pagamento,
    dataServico: r.data_servico, observacoes: r.observacoes, status: r.status, ambiente: r.ambiente,
    numeroNotaPrefeitura: r.numero_nota_prefeitura, codigoVerificacao: r.codigo_verificacao,
    emitidoPor: r.emitido_por, canceladoPor: r.cancelado_por, motivoCancelamento: r.motivo_cancelamento,
    emitidoEm: r.emitido_em, canceladoEm: r.cancelado_em, emailEnviado: r.email_enviado,
    emailEnviadoEm: r.email_enviado_em, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

const router = Router();

// ── Fiscal Settings ───────────────────────────────────────────────────────────

router.get("/fiscal-settings", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM fiscal_settings WHERE id = 1");
    if (!rows.length) {
      const { rows: created } = await pool.query(
        "INSERT INTO fiscal_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING RETURNING *"
      );
      return res.json(mapSettings(created[0]) || {});
    }
    return res.json(mapSettings(rows[0]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/fiscal-settings", requireAuth, async (req, res) => {
  try {
    const {
      razaoSocial, nomeFantasia, cnpj, inscricaoMunicipal, regimeTributario,
      endereco, numero, complemento, bairro, cidade, estado, cep, emailFiscal, telefone,
      codigoServico, aliquota, cnae, serieNota, ambiente, provedor, apiUrl, apiToken,
    } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO fiscal_settings (id, razao_social, nome_fantasia, cnpj, inscricao_municipal, regime_tributario,
         endereco, numero, complemento, bairro, cidade, estado, cep, email_fiscal, telefone,
         codigo_servico, aliquota, cnae, serie_nota, ambiente, provedor, api_url, api_token, updated_at)
       VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW())
       ON CONFLICT (id) DO UPDATE SET
         razao_social=EXCLUDED.razao_social, nome_fantasia=EXCLUDED.nome_fantasia, cnpj=EXCLUDED.cnpj,
         inscricao_municipal=EXCLUDED.inscricao_municipal, regime_tributario=EXCLUDED.regime_tributario,
         endereco=EXCLUDED.endereco, numero=EXCLUDED.numero, complemento=EXCLUDED.complemento,
         bairro=EXCLUDED.bairro, cidade=EXCLUDED.cidade, estado=EXCLUDED.estado, cep=EXCLUDED.cep,
         email_fiscal=EXCLUDED.email_fiscal, telefone=EXCLUDED.telefone, codigo_servico=EXCLUDED.codigo_servico,
         aliquota=EXCLUDED.aliquota, cnae=EXCLUDED.cnae, serie_nota=EXCLUDED.serie_nota,
         ambiente=EXCLUDED.ambiente, provedor=EXCLUDED.provedor, api_url=EXCLUDED.api_url,
         api_token=EXCLUDED.api_token, updated_at=NOW()
       RETURNING *`,
      [razaoSocial||null, nomeFantasia||null, cnpj||null, inscricaoMunicipal||null, regimeTributario||"simples_nacional",
       endereco||null, numero||null, complemento||null, bairro||null, cidade||null, estado||null, cep||null,
       emailFiscal||null, telefone||null, codigoServico||null, aliquota||5.00, cnae||null,
       serieNota||"1", ambiente||"homologacao", provedor||"manual", apiUrl||null, apiToken||null]
    );
    return res.json(mapSettings(rows[0]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Invoice Stats ─────────────────────────────────────────────────────────────

router.get("/invoices/stats", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const today = todayStr();
    const startOfMonth = today.slice(0, 7) + "-01";
    const f = from || startOfMonth;
    const t = to || today;
    const { rows } = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'emitida') as emitidas,
        COUNT(*) FILTER (WHERE status = 'pendente') as pendentes,
        COUNT(*) FILTER (WHERE status = 'cancelada') as canceladas,
        COUNT(*) FILTER (WHERE status = 'erro') as erros,
        COALESCE(SUM(valor_servico) FILTER (WHERE status = 'emitida'), 0) as total_faturado,
        COALESCE(SUM(valor_iss) FILTER (WHERE status = 'emitida'), 0) as total_iss,
        COUNT(*) as total
       FROM invoices
       WHERE data_servico >= $1 AND data_servico <= $2`,
      [f, t]
    );
    return res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Invoice Reports ───────────────────────────────────────────────────────────

router.get("/invoices/report", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const today = todayStr();
    const startOfMonth = today.slice(0, 7) + "-01";
    const f = from || startOfMonth;
    const t = to || today;

    const [byProfessional, byService] = await Promise.all([
      pool.query(
        `SELECT profissional, COUNT(*) as total_notas,
           COALESCE(SUM(valor_servico), 0) as total_valor
         FROM invoices WHERE status = 'emitida' AND data_servico >= $1 AND data_servico <= $2
         GROUP BY profissional ORDER BY total_valor DESC`,
        [f, t]
      ),
      pool.query(
        `SELECT descricao_servico, codigo_servico, COUNT(*) as total_notas,
           COALESCE(SUM(valor_servico), 0) as total_valor
         FROM invoices WHERE status = 'emitida' AND data_servico >= $1 AND data_servico <= $2
         GROUP BY descricao_servico, codigo_servico ORDER BY total_valor DESC`,
        [f, t]
      ),
    ]);

    return res.json({
      byProfessional: byProfessional.rows,
      byService: byService.rows,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Invoices CRUD ─────────────────────────────────────────────────────────────

router.get("/invoices", requireAuth, async (req, res) => {
  try {
    const { from, to, status, pacienteId, profissional, search } = req.query;
    let q = "SELECT * FROM invoices WHERE 1=1";
    const p: any[] = [];
    if (from) { p.push(from); q += ` AND data_servico >= $${p.length}`; }
    if (to) { p.push(to); q += ` AND data_servico <= $${p.length}`; }
    if (status && status !== "all") { p.push(status); q += ` AND status = $${p.length}`; }
    if (pacienteId) { p.push(parseInt(pacienteId as string)); q += ` AND paciente_id = $${p.length}`; }
    if (profissional) { p.push(`%${profissional}%`); q += ` AND profissional ILIKE $${p.length}`; }
    if (search) { p.push(`%${search}%`); q += ` AND (paciente_nome ILIKE $${p.length} OR numero ILIKE $${p.length} OR numero_nota_prefeitura ILIKE $${p.length})`; }
    q += " ORDER BY created_at DESC LIMIT 200";
    const { rows } = await pool.query(q, p);
    return res.json(rows.map(mapInvoice));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/invoices", requireAuth, async (req, res) => {
  try {
    const {
      pacienteId, pacienteNome, pacienteCpf, pacienteEmail, pacienteEndereco,
      receitaId, descricaoServico, codigoServico, aliquota, valorServico,
      profissional, formaPagamento, dataServico, observacoes, ambiente,
    } = req.body;

    if (!pacienteNome || !valorServico || !dataServico) {
      return res.status(400).json({ error: "Paciente, valor e data do serviço são obrigatórios" });
    }

    const al = parseFloat(aliquota) || 5;
    const vs = parseFloat(valorServico) || 0;
    const iss = parseFloat(((vs * al) / 100).toFixed(2));

    const { rows } = await pool.query(
      `INSERT INTO invoices (paciente_id, paciente_nome, paciente_cpf, paciente_email, paciente_endereco,
         receita_id, descricao_servico, codigo_servico, aliquota, valor_servico, valor_iss,
         profissional, forma_pagamento, data_servico, observacoes, ambiente, status, emitido_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pendente',$17) RETURNING *`,
      [pacienteId||null, pacienteNome, pacienteCpf||null, pacienteEmail||null, pacienteEndereco||null,
       receitaId||null, descricaoServico||"Serviço de Fisioterapia", codigoServico||null, al, vs, iss,
       profissional||null, formaPagamento||null, dataServico, observacoes||null,
       ambiente||"homologacao", (req as any).session?.username||null]
    );
    await pool.query("INSERT INTO invoice_logs (invoice_id, action, performed_by) VALUES ($1,'created',$2)", [rows[0].id, (req as any).session?.username]);
    return res.status(201).json(mapInvoice(rows[0]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/invoices/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM invoices WHERE id = $1", [parseInt(req.params.id)]);
    if (!rows.length) return res.status(404).json({ error: "Nota não encontrada" });
    return res.json(mapInvoice(rows[0]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/invoices/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      pacienteNome, pacienteCpf, pacienteEmail, pacienteEndereco,
      descricaoServico, codigoServico, aliquota, valorServico,
      profissional, formaPagamento, dataServico, observacoes,
    } = req.body;
    const al = parseFloat(aliquota) || 5;
    const vs = parseFloat(valorServico) || 0;
    const iss = parseFloat(((vs * al) / 100).toFixed(2));
    const { rows } = await pool.query(
      `UPDATE invoices SET paciente_nome=$1, paciente_cpf=$2, paciente_email=$3, paciente_endereco=$4,
         descricao_servico=$5, codigo_servico=$6, aliquota=$7, valor_servico=$8, valor_iss=$9,
         profissional=$10, forma_pagamento=$11, data_servico=$12, observacoes=$13, updated_at=NOW()
       WHERE id=$14 AND status='pendente' RETURNING *`,
      [pacienteNome, pacienteCpf||null, pacienteEmail||null, pacienteEndereco||null,
       descricaoServico, codigoServico||null, al, vs, iss, profissional||null,
       formaPagamento||null, dataServico, observacoes||null, id]
    );
    if (!rows.length) return res.status(404).json({ error: "Nota não encontrada ou já emitida" });
    await pool.query("INSERT INTO invoice_logs (invoice_id, action, performed_by) VALUES ($1,'updated',$2)", [id, (req as any).session?.username]);
    return res.json(mapInvoice(rows[0]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Emit (manual mode) ────────────────────────────────────────────────────────

router.post("/invoices/:id/emit", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { rows: inv } = await pool.query("SELECT * FROM invoices WHERE id = $1", [id]);
    if (!inv.length) return res.status(404).json({ error: "Nota não encontrada" });
    if (inv[0].status === "emitida") return res.status(400).json({ error: "Nota já emitida" });
    if (inv[0].status === "cancelada") return res.status(400).json({ error: "Nota cancelada não pode ser emitida" });

    // Get fiscal settings to check completeness
    const { rows: settings } = await pool.query("SELECT * FROM fiscal_settings WHERE id = 1");
    const s = settings[0];
    if (!s || !s.razao_social || !s.cnpj) {
      return res.status(400).json({ error: "Configure os dados fiscais da clínica antes de emitir notas" });
    }

    // Generate sequential number
    const { rows: lastNote } = await pool.query(
      "SELECT numero FROM invoices WHERE status='emitida' ORDER BY emitido_em DESC LIMIT 1"
    );
    const serie = s.serie_nota || "1";
    let seq = 1;
    if (lastNote.length && lastNote[0].numero) {
      const parts = lastNote[0].numero.split("/");
      const lastSeq = parseInt(parts[parts.length - 1]) || 0;
      seq = lastSeq + 1;
    } else {
      const { rows: countRows } = await pool.query("SELECT COUNT(*) as c FROM invoices WHERE status='emitida'");
      seq = parseInt(countRows[0].c) + 1;
    }
    const numero = `${serie}/${String(seq).padStart(6, "0")}`;
    const codVerif = Math.random().toString(36).substring(2, 10).toUpperCase();

    const { rows } = await pool.query(
      `UPDATE invoices SET status='emitida', numero=$1, numero_nota_prefeitura=$1,
         codigo_verificacao=$2, ambiente=$3, emitido_por=$4, emitido_em=NOW(), updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [numero, codVerif, s.ambiente, (req as any).session?.username, id]
    );

    // If receipt linked, mark as faturada
    if (inv[0].receita_id) {
      await pool.query("UPDATE financial_entries SET notes=CONCAT(COALESCE(notes,''),' [NF: ',$1,']') WHERE id=$2", [numero, inv[0].receita_id]);
    }

    await pool.query(
      "INSERT INTO invoice_logs (invoice_id, action, details, performed_by) VALUES ($1,'emitida',$2,$3)",
      [id, `Nota emitida: ${numero}`, (req as any).session?.username]
    );

    return res.json({ ...mapInvoice(rows[0]), fiscalSettings: mapSettings(s) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Cancel ─────────────────────────────────────────────────────────────────────

router.post("/invoices/:id/cancel", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { motivoCancelamento } = req.body;
    if (!motivoCancelamento) return res.status(400).json({ error: "Informe o motivo do cancelamento" });
    const { rows } = await pool.query(
      `UPDATE invoices SET status='cancelada', cancelado_por=$1, motivo_cancelamento=$2, cancelado_em=NOW(), updated_at=NOW()
       WHERE id=$3 AND status='emitida' RETURNING *`,
      [(req as any).session?.username, motivoCancelamento, id]
    );
    if (!rows.length) return res.status(400).json({ error: "Nota não encontrada ou não está emitida" });
    await pool.query(
      "INSERT INTO invoice_logs (invoice_id, action, details, performed_by) VALUES ($1,'cancelada',$2,$3)",
      [id, motivoCancelamento, (req as any).session?.username]
    );
    return res.json(mapInvoice(rows[0]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Mark email sent ────────────────────────────────────────────────────────────

router.post("/invoices/:id/email-sent", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { rows } = await pool.query(
      "UPDATE invoices SET email_enviado=true, email_enviado_em=NOW() WHERE id=$1 RETURNING *",
      [id]
    );
    await pool.query("INSERT INTO invoice_logs (invoice_id, action, performed_by) VALUES ($1,'email_sent',$2)", [id, (req as any).session?.username]);
    return res.json(mapInvoice(rows[0]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Invoice logs ───────────────────────────────────────────────────────────────

router.get("/invoices/:id/logs", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM invoice_logs WHERE invoice_id = $1 ORDER BY created_at DESC",
      [parseInt(req.params.id)]
    );
    return res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
