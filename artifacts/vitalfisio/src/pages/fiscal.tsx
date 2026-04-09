import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { useAppName } from "@/contexts/AppSettingsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  FileText, Plus, Settings2, Search, Filter, Download, Mail, XCircle,
  CheckCircle2, AlertCircle, Clock, RefreshCw, Eye, Printer, BarChart3,
  TrendingUp, Building2, FileDown, ChevronRight, Info, Zap, Lock,
  User, Hash, Calendar, DollarSign, Percent, CreditCard, Send,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type FiscalSettings = {
  id: number; razaoSocial?: string; nomeFantasia?: string; cnpj?: string;
  inscricaoMunicipal?: string; regimeTributario?: string;
  endereco?: string; numero?: string; complemento?: string; bairro?: string;
  cidade?: string; estado?: string; cep?: string; emailFiscal?: string; telefone?: string;
  codigoServico?: string; aliquota?: number; cnae?: string; serieNota?: string;
  ambiente?: string; provedor?: string; apiUrl?: string; apiToken?: string;
};

type Invoice = {
  id: number; numero?: string; pacienteId?: number; pacienteNome: string;
  pacienteCpf?: string; pacienteEmail?: string; pacienteEndereco?: string;
  receitaId?: number; descricaoServico: string; codigoServico?: string;
  aliquota: number; valorServico: number; valorIss: number; valorDeducoes?: number;
  profissional?: string; formaPagamento?: string; dataServico: string; observacoes?: string;
  status: "pendente" | "emitida" | "cancelada" | "erro"; ambiente: string;
  numeroNotaPrefeitura?: string; codigoVerificacao?: string;
  emitidoPor?: string; canceladoPor?: string; motivoCancelamento?: string;
  emitidoEm?: string; canceladoEm?: string; emailEnviado?: boolean; emailEnviadoEm?: string;
  createdAt: string;
};

type Stats = {
  emitidas: number; pendentes: number; canceladas: number; erros: number;
  total_faturado: number; total_iss: number; total: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (s?: string) => { if (!s) return "-"; const [y, m, d] = s.split("T")[0].split("-"); return `${d}/${m}/${y}`; };
const fmtCurrency = (v: any) => { const n = parseFloat(String(v || 0)); return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); };
const fmtCNPJ = (v: string) => v.replace(/\D/g,"").replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,"$1.$2.$3/$4-$5").slice(0,18);
const fmtCPF = (v: string) => v.replace(/\D/g,"").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,"$1.$2.$3-$4").slice(0,14);
const fmtCEP = (v: string) => v.replace(/\D/g,"").replace(/(\d{5})(\d{3})/,"$1-$2").slice(0,9);

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
}

const statusConfig = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: Clock },
  emitida:  { label: "Emitida",  color: "bg-green-100 text-green-800 border-green-300",   icon: CheckCircle2 },
  cancelada:{ label: "Cancelada",color: "bg-red-100 text-red-800 border-red-300",         icon: XCircle },
  erro:     { label: "Erro",     color: "bg-orange-100 text-orange-800 border-orange-300",icon: AlertCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status as keyof typeof statusConfig] || statusConfig.pendente;
  const Icon = cfg.icon;
  return (
    <Badge className={cn("border text-xs gap-1 font-normal", cfg.color)}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </Badge>
  );
}

function isSettingsComplete(s?: FiscalSettings) {
  if (!s) return false;
  return !!(s.razaoSocial && s.cnpj && s.inscricaoMunicipal && s.cidade);
}

// ── Invoice Print ──────────────────────────────────────────────────────────────

function printInvoice(inv: Invoice, settings?: FiscalSettings, fallbackName = "CliniSmart") {
  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) return;
  const clinicName = settings?.razaoSocial || settings?.nomeFantasia || fallbackName;
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>NFS-e ${inv.numero || inv.id}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 20px; color: #111; }
  .header { text-align:center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; }
  .header h1 { margin:0; font-size:18px; color:#2563eb; }
  .header p { margin:2px 0; color:#555; font-size:11px; }
  .badge { display:inline-block; background:#dcfce7; color:#166534; border:1px solid #86efac; border-radius:4px; padding:2px 8px; font-size:11px; font-weight:bold; }
  .badge.homolog { background:#fef9c3; color:#854d0e; border-color:#fde047; }
  .section { margin-bottom: 14px; }
  .section h3 { font-size:11px; font-weight:bold; text-transform:uppercase; color:#555; margin:0 0 6px 0; border-bottom:1px solid #e5e7eb; padding-bottom:3px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .field label { font-size:10px; color:#6b7280; display:block; }
  .field span { font-size:12px; font-weight:500; }
  .total-row { display:flex; justify-content:space-between; padding:4px 0; }
  .total-row.main { font-size:16px; font-weight:bold; color:#2563eb; border-top:1px solid #e5e7eb; padding-top:8px; margin-top:4px; }
  .footer { margin-top:24px; text-align:center; font-size:10px; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:8px; }
  @media print { body { padding:10px; } }
</style></head><body>
<div class="header">
  <h1>NOTA FISCAL DE SERVIÇOS ELETRÔNICA</h1>
  <p>${clinicName}${settings?.cnpj ? " · CNPJ: " + settings.cnpj : ""}${settings?.inscricaoMunicipal ? " · IM: " + settings.inscricaoMunicipal : ""}</p>
  <p>${[settings?.endereco, settings?.numero, settings?.bairro, settings?.cidade, settings?.estado].filter(Boolean).join(", ")}</p>
  <div style="margin-top:8px">
    <span class="badge ${inv.ambiente === 'homologacao' ? 'homolog' : ''}">
      ${inv.ambiente === 'homologacao' ? '⚠ AMBIENTE DE HOMOLOGAÇÃO' : '✓ PRODUÇÃO'}
    </span>
  </div>
</div>
<div class="section">
  <h3>Dados da Nota</h3>
  <div class="grid">
    <div class="field"><label>Número</label><span>${inv.numero || "—"}</span></div>
    <div class="field"><label>Código de Verificação</label><span>${inv.codigoVerificacao || "—"}</span></div>
    <div class="field"><label>Data de Emissão</label><span>${inv.emitidoEm ? fmtDate(inv.emitidoEm) : "—"}</span></div>
    <div class="field"><label>Data do Serviço</label><span>${fmtDate(inv.dataServico)}</span></div>
    <div class="field"><label>Série</label><span>${settings?.serieNota || "1"}</span></div>
    <div class="field"><label>Regime Tributário</label><span>${settings?.regimeTributario?.replace("_"," ") || "—"}</span></div>
  </div>
</div>
<div class="section">
  <h3>Tomador de Serviços (Paciente)</h3>
  <div class="grid">
    <div class="field"><label>Nome</label><span>${inv.pacienteNome}</span></div>
    <div class="field"><label>CPF</label><span>${inv.pacienteCpf || "—"}</span></div>
    <div class="field" style="grid-column:1/-1"><label>Endereço</label><span>${inv.pacienteEndereco || "—"}</span></div>
    <div class="field"><label>E-mail</label><span>${inv.pacienteEmail || "—"}</span></div>
  </div>
</div>
<div class="section">
  <h3>Serviço Prestado</h3>
  <div class="field" style="margin-bottom:8px"><label>Descrição</label><span>${inv.descricaoServico}</span></div>
  <div class="grid">
    <div class="field"><label>Código do Serviço (ISS)</label><span>${inv.codigoServico || settings?.codigoServico || "—"}</span></div>
    <div class="field"><label>Profissional Responsável</label><span>${inv.profissional || "—"}</span></div>
    <div class="field"><label>Forma de Pagamento</label><span>${inv.formaPagamento || "—"}</span></div>
  </div>
</div>
<div class="section">
  <h3>Valores</h3>
  <div class="total-row"><span>Valor do Serviço:</span><span>${fmtCurrency(inv.valorServico)}</span></div>
  <div class="total-row"><span>Alíquota ISS: ${inv.aliquota}%</span><span>${fmtCurrency(inv.valorIss)}</span></div>
  ${inv.valorDeducoes && parseFloat(String(inv.valorDeducoes)) > 0 ? `<div class="total-row"><span>Deduções:</span><span>(${fmtCurrency(inv.valorDeducoes)})</span></div>` : ""}
  <div class="total-row main"><span>Valor Total:</span><span>${fmtCurrency(inv.valorServico)}</span></div>
</div>
${inv.observacoes ? `<div class="section"><h3>Observações</h3><p>${inv.observacoes}</p></div>` : ""}
<div class="footer">
  Emitido por: ${inv.emitidoPor || "—"} · ${inv.emitidoEm ? new Date(inv.emitidoEm).toLocaleString("pt-BR") : ""}
  ${settings?.emailFiscal ? ` · ${settings.emailFiscal}` : ""}
</div>
<script>window.onload = () => window.print();</script>
</body></html>`);
  w.document.close();
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Fiscal() {
  const appName = useAppName();
  const [tab, setTab] = useState("notas");
  const [filterFrom, setFilterFrom] = useState(startOfMonth());
  const [filterTo, setFilterTo] = useState(today());
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [reportFrom, setReportFrom] = useState(startOfMonth());
  const [reportTo, setReportTo] = useState(today());

  // Dialogs
  const [emitirOpen, setEmitirOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [confirmEmitOpen, setConfirmEmitOpen] = useState(false);
  const [selectedInv, setSelectedInv] = useState<Invoice | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");

  // Form state
  const emptyForm = {
    pacienteId: "", pacienteNome: "", pacienteCpf: "", pacienteEmail: "", pacienteEndereco: "",
    descricaoServico: "Serviço de Fisioterapia", codigoServico: "",
    aliquota: "5", valorServico: "", profissional: "", formaPagamento: "", dataServico: today(), observacoes: "",
  };
  const [form, setForm] = useState({ ...emptyForm });

  // Settings form
  const [settingsForm, setSettingsForm] = useState<Partial<FiscalSettings>>({});

  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: settings, isLoading: loadingSettings } = useQuery<FiscalSettings>({
    queryKey: ["fiscal-settings"],
    queryFn: () => apiFetch("/api/fiscal-settings"),
  });

  const { data: invoices = [], isLoading: loadingInvoices, refetch: refetchInvoices } = useQuery<Invoice[]>({
    queryKey: ["invoices", filterFrom, filterTo, filterStatus, filterSearch],
    queryFn: () => {
      const p = new URLSearchParams({ from: filterFrom, to: filterTo });
      if (filterStatus !== "all") p.set("status", filterStatus);
      if (filterSearch) p.set("search", filterSearch);
      return apiFetch(`/api/invoices?${p.toString()}`);
    },
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["invoice-stats", filterFrom, filterTo],
    queryFn: () => apiFetch(`/api/invoices/stats?from=${filterFrom}&to=${filterTo}`),
    refetchInterval: 30000,
  });

  const { data: report } = useQuery<{ byProfessional: any[]; byService: any[] }>({
    queryKey: ["invoice-report", reportFrom, reportTo],
    queryFn: () => apiFetch(`/api/invoices/report?from=${reportFrom}&to=${reportTo}`),
    enabled: tab === "relatorios",
  });

  const { data: patients = [] } = useQuery<any[]>({
    queryKey: ["patients"],
    queryFn: () => apiFetch("/api/patients"),
  });

  const { data: therapists = [] } = useQuery<any[]>({
    queryKey: ["therapists"],
    queryFn: () => apiFetch("/api/therapists"),
  });

  const { data: me } = useQuery<any>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/auth/me"),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/invoices", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice-stats"] });
      toast({ title: "Nota criada com sucesso!", description: `ID: ${inv.id}` });
      setEmitirOpen(false);
      setForm({ ...emptyForm, codigoServico: settings?.codigoServico || "", aliquota: String(settings?.aliquota || 5) });
      setSelectedInv(inv);
      setConfirmEmitOpen(true);
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao criar nota", variant: "destructive" }),
  });

  const emitMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/invoices/${id}/emit`, { method: "POST", body: "{}" }),
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice-stats"] });
      toast({ title: `✅ Nota ${inv.numero} emitida com sucesso!` });
      setConfirmEmitOpen(false);
      setSelectedInv(inv);
      setViewOpen(true);
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao emitir nota", variant: "destructive" }),
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) =>
      apiFetch(`/api/invoices/${id}/cancel`, { method: "POST", body: JSON.stringify({ motivoCancelamento: motivo }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice-stats"] });
      toast({ title: "Nota cancelada" });
      setCancelOpen(false); setSelectedInv(null); setCancelMotivo("");
    },
    onError: (e: any) => toast({ title: e.message || "Erro", variant: "destructive" }),
  });

  const emailSentMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/invoices/${id}/email-sent`, { method: "POST", body: "{}" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });

  const settingsMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/fiscal-settings", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiscal-settings"] });
      toast({ title: "✅ Configurações fiscais salvas!" });
    },
    onError: (e: any) => toast({ title: e.message || "Erro", variant: "destructive" }),
  });

  // ── Open edit settings ────────────────────────────────────────────────────

  const openSettings = () => {
    setSettingsForm({
      razaoSocial: settings?.razaoSocial || "", nomeFantasia: settings?.nomeFantasia || "",
      cnpj: settings?.cnpj || "", inscricaoMunicipal: settings?.inscricaoMunicipal || "",
      regimeTributario: settings?.regimeTributario || "simples_nacional",
      endereco: settings?.endereco || "", numero: settings?.numero || "",
      complemento: settings?.complemento || "", bairro: settings?.bairro || "",
      cidade: settings?.cidade || "", estado: settings?.estado || "", cep: settings?.cep || "",
      emailFiscal: settings?.emailFiscal || "", telefone: settings?.telefone || "",
      codigoServico: settings?.codigoServico || "", aliquota: settings?.aliquota || 5,
      cnae: settings?.cnae || "", serieNota: settings?.serieNota || "1",
      ambiente: settings?.ambiente || "homologacao", provedor: settings?.provedor || "manual",
      apiUrl: settings?.apiUrl || "", apiToken: settings?.apiToken || "",
    });
    setTab("configuracoes");
  };

  // ── Patient autocomplete ──────────────────────────────────────────────────

  const [patientSearch, setPatientSearch] = useState("");
  const [showPatientList, setShowPatientList] = useState(false);
  const filteredPatients = patients.filter((p: any) =>
    patientSearch.length >= 2 && p.name.toLowerCase().includes(patientSearch.toLowerCase())
  );

  const selectPatient = (p: any) => {
    setForm(f => ({
      ...f, pacienteId: String(p.id), pacienteNome: p.name,
      pacienteCpf: p.cpf || "", pacienteEmail: p.email || "",
      pacienteEndereco: [p.address, p.city, p.state].filter(Boolean).join(", "),
    }));
    setPatientSearch(p.name);
    setShowPatientList(false);
  };

  // ── Computed values ────────────────────────────────────────────────────────

  const valorServico = parseFloat(form.valorServico || "0");
  const aliquota = parseFloat(form.aliquota || "5");
  const valorIss = parseFloat(((valorServico * aliquota) / 100).toFixed(2));

  // ── Open emit form ─────────────────────────────────────────────────────────

  const openEmitir = (inv?: Invoice) => {
    if (inv) {
      // Pre-fill from existing
      setSelectedInv(inv);
      setConfirmEmitOpen(true);
    } else {
      setForm({
        ...emptyForm,
        codigoServico: settings?.codigoServico || "",
        aliquota: String(settings?.aliquota || 5),
      });
      setPatientSearch("");
      setEmitirOpen(true);
    }
  };

  // ── Send email ─────────────────────────────────────────────────────────────

  const sendEmail = (inv: Invoice) => {
    if (!inv.pacienteEmail) {
      toast({ title: "Paciente sem e-mail cadastrado", variant: "destructive" }); return;
    }
    const clinicName = settings?.razaoSocial || settings?.nomeFantasia || appName;
    const subject = `Sua nota fiscal - ${clinicName}`;
    const body = `Olá, ${inv.pacienteNome}!

Segue sua Nota Fiscal de Serviços Eletrônica (NFS-e):

Número da Nota: ${inv.numero || "—"}
Código de Verificação: ${inv.codigoVerificacao || "—"}
Data de Emissão: ${inv.emitidoEm ? fmtDate(inv.emitidoEm) : "—"}
Serviço: ${inv.descricaoServico}
Valor: ${fmtCurrency(inv.valorServico)}

Para visualizar e baixar sua nota, utilize o número e código de verificação no portal da prefeitura.

Atenciosamente,
${clinicName}
${settings?.emailFiscal || ""}`;
    window.open(`mailto:${inv.pacienteEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
    emailSentMut.mutate(inv.id);
    toast({ title: "✅ E-mail da nota fiscal preparado!" });
  };

  // ── Export ─────────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const headers = ["Número","Paciente","CPF","Data Serviço","Profissional","Valor","ISS","Alíquota","Forma Pgto","Status","Emitido Em","Emitido Por","Ambiente"];
    const rows = invoices.map(i => [
      i.numero||"—", i.pacienteNome, i.pacienteCpf||"—", fmtDate(i.dataServico), i.profissional||"—",
      i.valorServico.toString().replace(".",","), i.valorIss.toString().replace(".",","), `${i.aliquota}%`,
      i.formaPagamento||"—", i.status, i.emitidoEm?fmtDate(i.emitidoEm):"—", i.emitidoPor||"—", i.ambiente,
    ]);
    const csv = [headers,...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="notas-fiscais.csv"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exportado com sucesso!" });
  };

  const settingsComplete = isSettingsComplete(settings);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-600" /> Nota Fiscal (NFSe)
          </h1>
          <p className="text-muted-foreground mt-1">
            Emissão e gestão de notas fiscais de serviço · {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openSettings}>
            <Settings2 className="h-4 w-4" /> Configurações Fiscais
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => openEmitir()}
            disabled={!settingsComplete}>
            <Plus className="h-4 w-4" /> Emitir Nota Fiscal
          </Button>
        </div>
      </div>

      {/* Settings incomplete warning */}
      {!loadingSettings && !settingsComplete && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg p-4">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">Configure os dados fiscais antes de emitir notas</p>
            <p className="text-amber-700 text-xs mt-0.5">
              Acesse as Configurações Fiscais e preencha: Razão Social, CNPJ, Inscrição Municipal e Cidade.
            </p>
            <Button variant="link" size="sm" className="text-amber-700 p-0 h-auto mt-1" onClick={openSettings}>
              Configurar agora <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border shadow-none">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats?.emitidas ?? 0}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5"><CheckCircle2 className="h-3 w-3 text-green-600" /> Emitidas</div>
          </CardContent>
        </Card>
        <Card className="border shadow-none">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats?.pendentes ?? 0}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5"><Clock className="h-3 w-3 text-yellow-600" /> Pendentes</div>
          </CardContent>
        </Card>
        <Card className="border shadow-none">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-red-500">{stats?.canceladas ?? 0}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5"><XCircle className="h-3 w-3 text-red-500" /> Canceladas</div>
          </CardContent>
        </Card>
        <Card className="border shadow-none bg-green-50/50">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{fmtCurrency(stats?.total_faturado)}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5"><TrendingUp className="h-3 w-3 text-green-600" /> Total Faturado</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full sm:w-auto grid-cols-3">
          <TabsTrigger value="notas" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Notas Fiscais</TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Relatórios</TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Configurações Fiscais</TabsTrigger>
        </TabsList>

        {/* ── TAB: NOTAS ─────────────────────────────────────────────────── */}
        <TabsContent value="notas" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 p-3 bg-muted/40 rounded-lg border">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">De:</Label>
              <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Até:</Label>
              <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="emitida">Emitidas</SelectItem>
                <SelectItem value="cancelada">Canceladas</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8 h-8 text-sm" placeholder="Buscar nota ou paciente..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
              <FileDown className="h-3.5 w-3.5" /> Excel/CSV
            </Button>
          </div>

          {/* Invoice list */}
          {loadingInvoices ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <FileText className="h-16 w-16 opacity-10" />
              <div className="text-center">
                <p className="font-medium">Nenhuma nota fiscal encontrada</p>
                <p className="text-sm opacity-70">Ajuste os filtros ou emita uma nova nota</p>
              </div>
              {settingsComplete && (
                <Button size="sm" className="gap-1.5 mt-2" onClick={() => openEmitir()}>
                  <Plus className="h-4 w-4" /> Emitir primeira nota
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {invoices.map(inv => (
                <Card key={inv.id} className={cn("border shadow-sm hover:shadow-md transition-all", inv.status === "cancelada" ? "opacity-70" : "")}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 flex-wrap">
                      {/* Left: number + status */}
                      <div className="min-w-[90px]">
                        <div className="font-mono text-sm font-bold text-blue-700">{inv.numero || `#${inv.id}`}</div>
                        <StatusBadge status={inv.status} />
                        {inv.ambiente === "homologacao" && (
                          <div className="text-[10px] text-amber-600 mt-0.5 bg-amber-50 rounded px-1">HOMOLOG.</div>
                        )}
                      </div>

                      {/* Middle: patient + service info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{inv.pacienteNome}</div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 mt-0.5">
                          {inv.pacienteCpf && <span>CPF: {inv.pacienteCpf}</span>}
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {fmtDate(inv.dataServico)}</span>
                          {inv.profissional && <span>Prof.: {inv.profissional}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{inv.descricaoServico}</div>
                        {inv.status === "cancelada" && inv.motivoCancelamento && (
                          <div className="text-xs text-red-600 mt-1 flex items-start gap-1">
                            <XCircle className="h-3 w-3 shrink-0 mt-0.5" /> Cancelamento: {inv.motivoCancelamento}
                          </div>
                        )}
                        {inv.emailEnviado && (
                          <div className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3" /> Nota enviada por e-mail em {fmtDate(inv.emailEnviadoEm)}
                          </div>
                        )}
                      </div>

                      {/* Right: value + actions */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="text-right">
                          <div className="font-bold text-base text-green-700">{fmtCurrency(inv.valorServico)}</div>
                          <div className="text-xs text-muted-foreground">ISS: {fmtCurrency(inv.valorIss)} ({inv.aliquota}%)</div>
                        </div>
                        <div className="flex gap-1.5 flex-wrap justify-end">
                          {/* View */}
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setSelectedInv(inv); setViewOpen(true); }}>
                            <Eye className="h-3 w-3" /> Ver
                          </Button>

                          {/* Emit (pending) */}
                          {inv.status === "pendente" && (
                            <Button size="sm" className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => { setSelectedInv(inv); setConfirmEmitOpen(true); }}>
                              <Zap className="h-3 w-3" /> Emitir
                            </Button>
                          )}

                          {/* Print */}
                          {inv.status === "emitida" && (
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => printInvoice(inv, settings, appName)}>
                              <Printer className="h-3 w-3" /> PDF
                            </Button>
                          )}

                          {/* Email */}
                          {inv.status === "emitida" && inv.pacienteEmail && (
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => sendEmail(inv)}>
                              <Mail className="h-3 w-3" /> E-mail
                            </Button>
                          )}

                          {/* Cancel */}
                          {inv.status === "emitida" && (
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-red-600 border-red-300 hover:bg-red-50" onClick={() => { setSelectedInv(inv); setCancelMotivo(""); setCancelOpen(true); }}>
                              <XCircle className="h-3 w-3" /> Cancelar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── TAB: RELATÓRIOS ──────────────────────────────────────────────── */}
        <TabsContent value="relatorios" className="mt-4 space-y-5">
          {/* Period filter */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/40 rounded-lg border">
            <span className="text-sm font-medium text-muted-foreground">Período:</span>
            <Input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} className="w-36 h-8 text-sm" />
            <span className="text-sm text-muted-foreground">até</span>
            <Input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} className="w-36 h-8 text-sm" />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setFilterFrom(reportFrom); setFilterTo(reportTo); setTab("notas"); exportCSV(); }}>
              <Download className="h-3.5 w-3.5" /> Exportar Relatório
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card className="border shadow-none">
              <CardContent className="p-4 text-center">
                <DollarSign className="h-6 w-6 mx-auto text-green-600 mb-1" />
                <div className="text-2xl font-bold text-green-700">{fmtCurrency(stats?.total_faturado)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Total Faturado</div>
              </CardContent>
            </Card>
            <Card className="border shadow-none">
              <CardContent className="p-4 text-center">
                <Percent className="h-6 w-6 mx-auto text-blue-500 mb-1" />
                <div className="text-2xl font-bold text-blue-700">{fmtCurrency(stats?.total_iss)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Total ISS Retido</div>
              </CardContent>
            </Card>
            <Card className="border shadow-none">
              <CardContent className="p-4 text-center">
                <FileText className="h-6 w-6 mx-auto text-purple-500 mb-1" />
                <div className="text-2xl font-bold text-purple-700">{stats?.emitidas ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Notas Emitidas</div>
              </CardContent>
            </Card>
          </div>

          {/* By professional */}
          {report && report.byProfessional.length > 0 && (
            <Card className="border shadow-none">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-blue-500" /> Faturamento por Profissional</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {report.byProfessional.map((row: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/40 border text-sm">
                      <span className="font-medium">{row.profissional || "Não informado"}</span>
                      <div className="flex gap-4 text-muted-foreground text-xs">
                        <span>{row.total_notas} nota{row.total_notas !== 1 ? "s" : ""}</span>
                        <span className="font-semibold text-green-700">{fmtCurrency(row.total_valor)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* By service */}
          {report && report.byService.length > 0 && (
            <Card className="border shadow-none">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Hash className="h-4 w-4 text-purple-500" /> Faturamento por Tipo de Serviço</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {report.byService.map((row: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/40 border text-sm">
                      <div>
                        <div className="font-medium">{row.descricao_servico}</div>
                        {row.codigo_servico && <div className="text-xs text-muted-foreground">Código: {row.codigo_servico}</div>}
                      </div>
                      <div className="flex gap-4 text-xs">
                        <span className="text-muted-foreground">{row.total_notas} nota{row.total_notas !== 1 ? "s" : ""}</span>
                        <span className="font-semibold text-green-700">{fmtCurrency(row.total_valor)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {(!report || (report.byProfessional.length === 0 && report.byService.length === 0)) && (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
              <BarChart3 className="h-12 w-12 opacity-10" />
              <p className="text-sm">Nenhum dado para o período selecionado</p>
            </div>
          )}
        </TabsContent>

        {/* ── TAB: CONFIGURAÇÕES ──────────────────────────────────────────── */}
        <TabsContent value="configuracoes" className="mt-4">
          <div className="max-w-3xl space-y-6">
            {/* Dados da Empresa */}
            <Card className="border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600" /> Dados da Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Razão Social <span className="text-red-500">*</span></Label>
                    <Input placeholder="Nome Empresarial Ltda" value={settingsForm.razaoSocial||""} onChange={e => setSettingsForm(f => ({...f, razaoSocial: e.target.value}))} />
                  </div>
                  <div>
                    <Label>Nome Fantasia</Label>
                    <Input placeholder={appName} value={settingsForm.nomeFantasia||""} onChange={e => setSettingsForm(f => ({...f, nomeFantasia: e.target.value}))} />
                  </div>
                  <div>
                    <Label>CNPJ <span className="text-red-500">*</span></Label>
                    <Input placeholder="00.000.000/0000-00" value={settingsForm.cnpj||""} onChange={e => setSettingsForm(f => ({...f, cnpj: fmtCNPJ(e.target.value)}))} />
                  </div>
                  <div>
                    <Label>Inscrição Municipal <span className="text-red-500">*</span></Label>
                    <Input placeholder="00000000" value={settingsForm.inscricaoMunicipal||""} onChange={e => setSettingsForm(f => ({...f, inscricaoMunicipal: e.target.value}))} />
                  </div>
                  <div>
                    <Label>Regime Tributário</Label>
                    <Select value={settingsForm.regimeTributario||"simples_nacional"} onValueChange={v => setSettingsForm(f => ({...f, regimeTributario: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                        <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                        <SelectItem value="lucro_real">Lucro Real</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>E-mail Fiscal</Label>
                    <Input type="email" placeholder="fiscal@clinica.com.br" value={settingsForm.emailFiscal||""} onChange={e => setSettingsForm(f => ({...f, emailFiscal: e.target.value}))} />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input placeholder="(00) 00000-0000" value={settingsForm.telefone||""} onChange={e => setSettingsForm(f => ({...f, telefone: e.target.value}))} />
                  </div>
                </div>

                <Separator />
                <p className="text-xs font-semibold text-muted-foreground uppercase">Endereço</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Logradouro</Label>
                    <Input placeholder="Rua, Avenida..." value={settingsForm.endereco||""} onChange={e => setSettingsForm(f => ({...f, endereco: e.target.value}))} />
                  </div>
                  <div>
                    <Label>Número</Label>
                    <Input placeholder="123" value={settingsForm.numero||""} onChange={e => setSettingsForm(f => ({...f, numero: e.target.value}))} />
                  </div>
                  <div>
                    <Label>Complemento</Label>
                    <Input placeholder="Sala 2" value={settingsForm.complemento||""} onChange={e => setSettingsForm(f => ({...f, complemento: e.target.value}))} />
                  </div>
                  <div>
                    <Label>Bairro</Label>
                    <Input placeholder="Centro" value={settingsForm.bairro||""} onChange={e => setSettingsForm(f => ({...f, bairro: e.target.value}))} />
                  </div>
                  <div>
                    <Label>Cidade <span className="text-red-500">*</span></Label>
                    <Input placeholder="São Paulo" value={settingsForm.cidade||""} onChange={e => setSettingsForm(f => ({...f, cidade: e.target.value}))} />
                  </div>
                  <div>
                    <Label>Estado</Label>
                    <Input placeholder="SP" maxLength={2} className="uppercase" value={settingsForm.estado||""} onChange={e => setSettingsForm(f => ({...f, estado: e.target.value.toUpperCase()}))} />
                  </div>
                  <div>
                    <Label>CEP</Label>
                    <Input placeholder="00000-000" value={settingsForm.cep||""} onChange={e => setSettingsForm(f => ({...f, cep: fmtCEP(e.target.value)}))} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dados Fiscais */}
            <Card className="border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Hash className="h-4 w-4 text-purple-600" /> Dados Fiscais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Código do Serviço (ISS)</Label>
                    <Input placeholder="14.01" value={settingsForm.codigoServico||""} onChange={e => setSettingsForm(f => ({...f, codigoServico: e.target.value}))} />
                  </div>
                  <div>
                    <Label>Alíquota ISS (%)</Label>
                    <Input type="number" min="0" max="100" step="0.01" placeholder="5" value={settingsForm.aliquota||""} onChange={e => setSettingsForm(f => ({...f, aliquota: parseFloat(e.target.value)}))} />
                  </div>
                  <div>
                    <Label>CNAE</Label>
                    <Input placeholder="8650-0/04" value={settingsForm.cnae||""} onChange={e => setSettingsForm(f => ({...f, cnae: e.target.value}))} />
                  </div>
                  <div>
                    <Label>Série da Nota</Label>
                    <Input placeholder="1" value={settingsForm.serieNota||""} onChange={e => setSettingsForm(f => ({...f, serieNota: e.target.value}))} />
                  </div>
                  <div>
                    <Label>Ambiente</Label>
                    <Select value={settingsForm.ambiente||"homologacao"} onValueChange={v => setSettingsForm(f => ({...f, ambiente: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="homologacao">⚠ Homologação (testes)</SelectItem>
                        <SelectItem value="producao">✓ Produção</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Integração */}
            <Card className="border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-orange-500" /> Integração com Prefeitura
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Provedor NFSe</Label>
                    <Select value={settingsForm.provedor||"manual"} onValueChange={v => setSettingsForm(f => ({...f, provedor: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual (PDF local)</SelectItem>
                        <SelectItem value="abrasf">ABRASF (padrão nacional)</SelectItem>
                        <SelectItem value="nota_carioca">Nota Carioca (Rio de Janeiro)</SelectItem>
                        <SelectItem value="issnet">ISSNet</SelectItem>
                        <SelectItem value="betha">Betha</SelectItem>
                        <SelectItem value="ginfes">GINFES</SelectItem>
                        <SelectItem value="webiss">WebISS</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    {settingsForm.provedor === "manual" && (
                      <p className="text-xs text-muted-foreground mt-1">No modo manual, o sistema gera e registra a nota localmente e permite imprimir o PDF.</p>
                    )}
                  </div>

                  {settingsForm.provedor && settingsForm.provedor !== "manual" && (
                    <>
                      <div className="col-span-2">
                        <Label>URL da API da Prefeitura</Label>
                        <Input placeholder="https://nfse.prefeitura.gov.br/api" value={settingsForm.apiUrl||""} onChange={e => setSettingsForm(f => ({...f, apiUrl: e.target.value}))} />
                      </div>
                      <div className="col-span-2">
                        <Label>Token / Chave de Acesso</Label>
                        <Input type="password" placeholder="••••••••••••" value={settingsForm.apiToken||""} onChange={e => setSettingsForm(f => ({...f, apiToken: e.target.value}))} />
                      </div>
                      <div className="col-span-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                        <Info className="h-4 w-4 shrink-0" />
                        Upload do certificado A1 (.pfx) disponível após conexão com o provedor. Entre em contato com o suporte para configurar a integração completa.
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                  <Lock className="h-4 w-4 shrink-0" />
                  Dados de acesso criptografados. Nunca compartilhe sua chave de acesso.
                </div>
              </CardContent>
            </Card>

            <Button className="w-full gap-2" onClick={() => settingsMut.mutate(settingsForm)} disabled={settingsMut.isPending}>
              <CheckCircle2 className="h-4 w-4" />
              {settingsMut.isPending ? "Salvando..." : "Salvar Configurações Fiscais"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Emitir Nota Dialog ──────────────────────────────────────────────── */}
      <Dialog open={emitirOpen} onOpenChange={setEmitirOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" /> Nova Nota Fiscal de Serviço
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Tomador */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-2"><User className="h-3.5 w-3.5" /> Tomador de Serviços (Paciente)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 relative">
                  <Label>Paciente <span className="text-red-500">*</span></Label>
                  <Input placeholder="Buscar paciente..." value={patientSearch}
                    onChange={e => { setPatientSearch(e.target.value); setShowPatientList(true); setForm(f => ({...f, pacienteId:"", pacienteNome: e.target.value})); }}
                    onFocus={() => setShowPatientList(true)} />
                  {showPatientList && filteredPatients.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredPatients.map((p: any) => (
                        <button key={p.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-b-0"
                          onMouseDown={() => selectPatient(p)}>
                          <div className="font-medium">{p.name}</div>
                          {p.cpf && <div className="text-xs text-muted-foreground">CPF: {p.cpf}</div>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input placeholder="000.000.000-00" value={form.pacienteCpf} onChange={e => setForm(f => ({...f, pacienteCpf: fmtCPF(e.target.value)}))} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={form.pacienteEmail} onChange={e => setForm(f => ({...f, pacienteEmail: e.target.value}))} />
                </div>
                <div className="col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.pacienteEndereco} onChange={e => setForm(f => ({...f, pacienteEndereco: e.target.value}))} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Serviço */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Serviço Prestado</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Descrição do Serviço <span className="text-red-500">*</span></Label>
                  <Input value={form.descricaoServico} onChange={e => setForm(f => ({...f, descricaoServico: e.target.value}))} />
                </div>
                <div>
                  <Label>Código do Serviço (ISS)</Label>
                  <Input placeholder={settings?.codigoServico||"14.01"} value={form.codigoServico} onChange={e => setForm(f => ({...f, codigoServico: e.target.value}))} />
                </div>
                <div>
                  <Label>Data do Serviço <span className="text-red-500">*</span></Label>
                  <Input type="date" value={form.dataServico} onChange={e => setForm(f => ({...f, dataServico: e.target.value}))} />
                </div>
                <div>
                  <Label>Profissional Responsável</Label>
                  <Select value={form.profissional} onValueChange={v => setForm(f => ({...f, profissional: v}))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não informar</SelectItem>
                      {therapists.map((t: any) => (
                        <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select value={form.formaPagamento} onValueChange={v => setForm(f => ({...f, formaPagamento: v}))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                      <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                      <SelectItem value="convenio">Convênio</SelectItem>
                      <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Valores */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-2"><DollarSign className="h-3.5 w-3.5" /> Valores</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Valor do Serviço (R$) <span className="text-red-500">*</span></Label>
                  <Input type="number" min="0" step="0.01" placeholder="0,00" value={form.valorServico} onChange={e => setForm(f => ({...f, valorServico: e.target.value}))} />
                </div>
                <div>
                  <Label>Alíquota ISS (%)</Label>
                  <Input type="number" min="0" max="100" step="0.01" value={form.aliquota} onChange={e => setForm(f => ({...f, aliquota: e.target.value}))} />
                </div>
                <div>
                  <Label>ISS Calculado</Label>
                  <Input value={fmtCurrency(isNaN(valorIss) ? 0 : valorIss)} disabled className="bg-muted/50 font-mono" />
                </div>
              </div>
              {valorServico > 0 && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-sm">
                  <div className="flex justify-between">
                    <span>Valor do Serviço:</span><span className="font-medium">{fmtCurrency(valorServico)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground text-xs">
                    <span>ISS ({aliquota}%):</span><span>{fmtCurrency(valorIss)}</span>
                  </div>
                  <Separator className="my-1.5" />
                  <div className="flex justify-between font-bold text-green-700">
                    <span>Total a faturar:</span><span>{fmtCurrency(valorServico)}</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea rows={2} placeholder="Informações adicionais..." value={form.observacoes} onChange={e => setForm(f => ({...f, observacoes: e.target.value}))} />
            </div>

            <div className="flex gap-2 border-t pt-4">
              <Button className="flex-1 gap-2" onClick={() => createMut.mutate({
                ...form,
                pacienteId: form.pacienteId ? parseInt(form.pacienteId) : undefined,
                profissional: form.profissional === "none" ? "" : form.profissional,
                ambiente: settings?.ambiente || "homologacao",
                codigoServico: form.codigoServico || settings?.codigoServico || "",
              })} disabled={createMut.isPending}>
                <Plus className="h-4 w-4" />
                {createMut.isPending ? "Criando..." : "Criar Nota Fiscal"}
              </Button>
              <Button variant="ghost" onClick={() => setEmitirOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Emit Dialog ──────────────────────────────────────────────── */}
      <AlertDialog open={confirmEmitOpen} onOpenChange={setConfirmEmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" /> Confirmar Emissão da Nota
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Confirma a emissão da nota fiscal para:</p>
                {selectedInv && (
                  <div className="p-3 bg-muted rounded text-sm space-y-1">
                    <div><strong>Paciente:</strong> {selectedInv.pacienteNome}</div>
                    <div><strong>Serviço:</strong> {selectedInv.descricaoServico}</div>
                    <div><strong>Valor:</strong> {fmtCurrency(selectedInv.valorServico)}</div>
                    <div><strong>ISS ({selectedInv.aliquota}%):</strong> {fmtCurrency(selectedInv.valorIss)}</div>
                    {settings?.ambiente === "homologacao" && (
                      <div className="text-amber-600 text-xs mt-2">⚠ Emissão em ambiente de HOMOLOGAÇÃO (testes)</div>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Esta ação registrará a nota como emitida e gerará o número sequencial.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-blue-600 hover:bg-blue-700"
              onClick={() => selectedInv && emitMut.mutate(selectedInv.id)}
              disabled={emitMut.isPending}>
              {emitMut.isPending ? "Emitindo..." : "Confirmar Emissão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── View Invoice Dialog ──────────────────────────────────────────────── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" /> Nota Fiscal {selectedInv?.numero || `#${selectedInv?.id}`}
            </DialogTitle>
          </DialogHeader>
          {selectedInv && (
            <div className="space-y-4">
              {/* Status + number */}
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded border">
                <StatusBadge status={selectedInv.status} />
                <div className="text-sm">
                  <span className="text-muted-foreground">Número: </span>
                  <span className="font-mono font-bold">{selectedInv.numero || "—"}</span>
                </div>
                {selectedInv.codigoVerificacao && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Cód. Verificação: </span>
                    <span className="font-mono font-bold">{selectedInv.codigoVerificacao}</span>
                  </div>
                )}
                {selectedInv.ambiente === "homologacao" && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 border text-xs">HOMOLOGAÇÃO</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><span className="text-muted-foreground text-xs">Paciente</span><div className="font-medium">{selectedInv.pacienteNome}</div></div>
                <div><span className="text-muted-foreground text-xs">CPF</span><div className="font-medium">{selectedInv.pacienteCpf || "—"}</div></div>
                <div><span className="text-muted-foreground text-xs">E-mail</span><div className="font-medium">{selectedInv.pacienteEmail || "—"}</div></div>
                <div><span className="text-muted-foreground text-xs">Data do Serviço</span><div className="font-medium">{fmtDate(selectedInv.dataServico)}</div></div>
                <div className="col-span-2"><span className="text-muted-foreground text-xs">Endereço</span><div className="font-medium">{selectedInv.pacienteEndereco || "—"}</div></div>
                <div className="col-span-2"><span className="text-muted-foreground text-xs">Serviço</span><div className="font-medium">{selectedInv.descricaoServico}</div></div>
                <div><span className="text-muted-foreground text-xs">Código ISS</span><div className="font-medium">{selectedInv.codigoServico || "—"}</div></div>
                <div><span className="text-muted-foreground text-xs">Profissional</span><div className="font-medium">{selectedInv.profissional || "—"}</div></div>
                <div><span className="text-muted-foreground text-xs">Forma de Pagamento</span><div className="font-medium capitalize">{selectedInv.formaPagamento?.replace("_"," ") || "—"}</div></div>
              </div>

              <div className="p-3 bg-green-50 border border-green-200 rounded space-y-1 text-sm">
                <div className="flex justify-between"><span>Valor do Serviço:</span><span className="font-bold">{fmtCurrency(selectedInv.valorServico)}</span></div>
                <div className="flex justify-between text-muted-foreground text-xs"><span>ISS ({selectedInv.aliquota}%):</span><span>{fmtCurrency(selectedInv.valorIss)}</span></div>
              </div>

              {selectedInv.observacoes && (
                <div><span className="text-xs text-muted-foreground">Observações</span><p className="text-sm mt-0.5">{selectedInv.observacoes}</p></div>
              )}
              {selectedInv.status === "cancelada" && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  <strong>Motivo do cancelamento:</strong> {selectedInv.motivoCancelamento || "—"}
                  <div className="text-xs mt-0.5">Por: {selectedInv.canceladoPor} · {selectedInv.canceladoEm ? fmtDate(selectedInv.canceladoEm) : "—"}</div>
                </div>
              )}

              <div className="flex gap-2 border-t pt-4 flex-wrap">
                {selectedInv.status === "emitida" && (
                  <>
                    <Button className="gap-1.5 flex-1" onClick={() => printInvoice(selectedInv, settings, appName)}>
                      <Printer className="h-4 w-4" /> Imprimir / PDF
                    </Button>
                    {selectedInv.pacienteEmail && (
                      <Button variant="outline" className="gap-1.5" onClick={() => { sendEmail(selectedInv); setViewOpen(false); }}>
                        <Mail className="h-4 w-4" /> Enviar por E-mail
                      </Button>
                    )}
                    <Button variant="outline" className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50" onClick={() => { setViewOpen(false); setCancelOpen(true); }}>
                      <XCircle className="h-4 w-4" /> Cancelar
                    </Button>
                  </>
                )}
                {selectedInv.status === "pendente" && (
                  <Button className="gap-1.5 flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => { setViewOpen(false); setConfirmEmitOpen(true); }}>
                    <Zap className="h-4 w-4" /> Emitir Nota
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setViewOpen(false)}>Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Cancel Dialog ────────────────────────────────────────────────────── */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700 flex items-center gap-2">
              <XCircle className="h-5 w-5" /> Cancelar Nota Fiscal
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Esta ação cancela a nota fiscal <strong>{selectedInv?.numero}</strong> de {selectedInv?.pacienteNome}. Esta operação não pode ser desfeita.</p>
                <div>
                  <Label>Motivo do Cancelamento <span className="text-red-500">*</span></Label>
                  <Textarea className="mt-1" rows={3} placeholder="Descreva o motivo do cancelamento..." value={cancelMotivo} onChange={e => setCancelMotivo(e.target.value)} />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700"
              onClick={() => selectedInv && cancelMut.mutate({ id: selectedInv.id, motivo: cancelMotivo })}
              disabled={!cancelMotivo.trim() || cancelMut.isPending}>
              {cancelMut.isPending ? "Cancelando..." : "Confirmar Cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
