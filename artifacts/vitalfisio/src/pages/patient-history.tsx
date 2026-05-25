import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, UserRound, Activity, Phone, ClipboardList, CalendarDays, Plus, Pencil,
  Trash2, FileText, Mail, MapPin, Printer, Search, ChevronDown, ChevronUp,
  Stethoscope, Zap, Target, CheckCircle2, StickyNote, LayoutTemplate, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAppSettings } from "@/contexts/AppSettingsContext";

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado", confirmado: "Confirmado", presente: "Presente",
  falta: "Falta", cancelado: "Cancelado", remarcado: "Remarcado", encaixe: "Encaixe",
};
const STATUS_COLORS: Record<string, string> = {
  agendado: "bg-blue-100 text-blue-800 border-blue-200",
  confirmado: "bg-teal-100 text-teal-800 border-teal-200",
  presente: "bg-green-100 text-green-800 border-green-200",
  falta: "bg-orange-100 text-orange-800 border-orange-200",
  cancelado: "bg-red-100 text-red-800 border-red-200",
  remarcado: "bg-purple-100 text-purple-800 border-purple-200",
  encaixe: "bg-amber-100 text-amber-800 border-amber-200",
};

type EvolutionRecord = {
  id: number; patientId: number; therapistId: number; appointmentId: number | null;
  date: string; content: string; therapistName: string; therapistSpecialty: string; createdAt: string;
};
type TherapistType = { id: number; name: string; specialty: string };

const fmtDate = (s: string) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };

// ── Structured evolution helpers ─────────────────────────────────────────────
const SECTION_KEYS = ["queixa", "dor", "exame", "procedimentos", "resposta", "conduta", "obs"] as const;
type SectionKey = typeof SECTION_KEYS[number];
const SECTION_LABELS: Record<SectionKey, string> = {
  queixa: "Queixa Principal",
  dor: "Intensidade da Dor (0–10)",
  exame: "Exame Físico / Observações",
  procedimentos: "Procedimentos Realizados",
  resposta: "Resposta ao Tratamento",
  conduta: "Conduta / Plano",
  obs: "Observações Gerais",
};
const SECTION_ICONS: Record<SectionKey, React.ReactNode> = {
  queixa: <StickyNote className="h-3.5 w-3.5" />,
  dor: <Zap className="h-3.5 w-3.5" />,
  exame: <Stethoscope className="h-3.5 w-3.5" />,
  procedimentos: <Activity className="h-3.5 w-3.5" />,
  resposta: <CheckCircle2 className="h-3.5 w-3.5" />,
  conduta: <Target className="h-3.5 w-3.5" />,
  obs: <FileText className="h-3.5 w-3.5" />,
};

function parseEvolution(content: string): Record<SectionKey, string> | null {
  if (!content.includes("**Queixa:**") && !content.includes("**queixa:**")) return null;
  const result: Record<SectionKey, string> = { queixa: "", dor: "", exame: "", procedimentos: "", resposta: "", conduta: "", obs: "" };
  const patterns: [SectionKey, RegExp][] = [
    ["queixa", /\*\*Queixa:\*\*\s*([\s\S]*?)(?=\*\*|$)/i],
    ["dor", /\*\*Dor:\*\*\s*([\s\S]*?)(?=\*\*|$)/i],
    ["exame", /\*\*Exame Físico:\*\*\s*([\s\S]*?)(?=\*\*|$)/i],
    ["procedimentos", /\*\*Procedimentos:\*\*\s*([\s\S]*?)(?=\*\*|$)/i],
    ["resposta", /\*\*Resposta:\*\*\s*([\s\S]*?)(?=\*\*|$)/i],
    ["conduta", /\*\*Conduta:\*\*\s*([\s\S]*?)(?=\*\*|$)/i],
    ["obs", /\*\*Observações:\*\*\s*([\s\S]*?)(?=\*\*|$)/i],
  ];
  for (const [key, regex] of patterns) {
    const m = content.match(regex);
    if (m) result[key] = m[1].trim();
  }
  return result;
}

function buildContent(fields: Record<SectionKey, string>): string {
  const lines: string[] = [];
  if (fields.queixa) lines.push(`**Queixa:** ${fields.queixa}`);
  if (fields.dor) lines.push(`**Dor:** ${fields.dor}`);
  if (fields.exame) lines.push(`**Exame Físico:** ${fields.exame}`);
  if (fields.procedimentos) lines.push(`**Procedimentos:** ${fields.procedimentos}`);
  if (fields.resposta) lines.push(`**Resposta:** ${fields.resposta}`);
  if (fields.conduta) lines.push(`**Conduta:** ${fields.conduta}`);
  if (fields.obs) lines.push(`**Observações:** ${fields.obs}`);
  return lines.join("\n");
}

// ── Templates ─────────────────────────────────────────────────────────────────
const TEMPLATES: { label: string; fields: Partial<Record<SectionKey, string>> }[] = [
  {
    label: "Sessão Padrão",
    fields: {
      queixa: "",
      dor: "",
      exame: "ADM preservada / limitação em ",
      procedimentos: "Cinesioterapia, ",
      resposta: "Boa tolerância ao tratamento",
      conduta: "Manter protocolo vigente",
    },
  },
  {
    label: "Avaliação Inicial",
    fields: {
      queixa: "",
      dor: "",
      exame: "Inspeção: \nPalpação: \nADM: \nTestes especiais: ",
      procedimentos: "Avaliação fisioterapêutica completa",
      resposta: "—",
      conduta: "Iniciar protocolo de tratamento conforme diagnóstico clínico",
      obs: "Paciente orientado sobre diagnóstico e plano terapêutico",
    },
  },
  {
    label: "Alta Fisioterapêutica",
    fields: {
      queixa: "Paciente refere melhora significativa do quadro inicial",
      dor: "0/10",
      exame: "Objetivos terapêuticos atingidos",
      procedimentos: "Sessão de alta com orientações domiciliares",
      resposta: "Excelente evolução durante o tratamento",
      conduta: "Alta fisioterapêutica. Manter exercícios em domicílio.",
      obs: "Paciente orientado a retornar em caso de recidiva",
    },
  },
  {
    label: "Reavaliação",
    fields: {
      queixa: "",
      dor: "",
      exame: "Reavaliação: \nComparado à avaliação inicial: ",
      procedimentos: "Reavaliação e ajuste de protocolo",
      resposta: "",
      conduta: "",
    },
  },
];

// ── Pain scale component ───────────────────────────────────────────────────────
function PainScale({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const num = parseInt(value) || 0;
  const colors = ["bg-green-500", "bg-green-400", "bg-lime-400", "bg-yellow-400", "bg-yellow-500",
    "bg-orange-400", "bg-orange-500", "bg-red-400", "bg-red-500", "bg-red-600", "bg-red-700"];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: 11 }, (_, i) => (
          <button key={i} type="button"
            onClick={() => onChange(i.toString())}
            className={`h-7 flex-1 rounded text-xs font-bold transition-all border-2 ${i === num
              ? `${colors[i]} text-white border-transparent scale-110 shadow`
              : "bg-muted border-border text-muted-foreground hover:bg-muted/80"}`}>
            {i}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground px-0.5">
        <span>Sem dor</span>
        <span>Moderada</span>
        <span>Insuportável</span>
      </div>
    </div>
  );
}

// ── Structured card content renderer ─────────────────────────────────────────
function EvolutionContent({ content, expanded }: { content: string; expanded: boolean }) {
  const parsed = parseEvolution(content);
  if (!parsed) {
    const text = expanded ? content : content.slice(0, 280) + (content.length > 280 ? "…" : "");
    return <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{text}</p>;
  }
  const fields = SECTION_KEYS.filter(k => parsed[k]);
  const visible = expanded ? fields : fields.slice(0, 4);
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {visible.map(k => (
        <div key={k} className={`rounded-lg p-2.5 bg-muted/40 border border-border/60 ${k === "exame" || k === "procedimentos" || k === "obs" ? "sm:col-span-2" : ""}`}>
          <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {SECTION_ICONS[k]} {SECTION_LABELS[k]}
          </div>
          {k === "dor" ? (
            <DorDisplay value={parsed[k]} />
          ) : (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{parsed[k]}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function DorDisplay({ value }: { value: string }) {
  const num = parseInt(value);
  if (isNaN(num)) return <p className="text-sm">{value}</p>;
  const color = num <= 2 ? "bg-green-500" : num <= 4 ? "bg-yellow-400" : num <= 6 ? "bg-orange-400" : "bg-red-500";
  const label = num === 0 ? "Sem dor" : num <= 3 ? "Leve" : num <= 6 ? "Moderada" : num <= 8 ? "Intensa" : "Insuportável";
  return (
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${color}`}>{num}</div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <div className="flex gap-0.5 mt-0.5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className={`h-1.5 w-3 rounded-sm ${i < num ? color : "bg-muted"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Print-formatted content ───────────────────────────────────────────────────
function PrintContent({ content }: { content: string }) {
  const parsed = parseEvolution(content);
  if (!parsed) return <p style={{ fontSize: "13px", lineHeight: "1.8", whiteSpace: "pre-wrap" }}>{content}</p>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
      {SECTION_KEYS.filter(k => parsed[k]).map(k => (
        <div key={k} style={{
          gridColumn: k === "exame" || k === "procedimentos" || k === "obs" ? "span 2" : undefined,
          border: "1px solid #e5e5e5", borderRadius: "6px", padding: "8px 10px",
        }}>
          <div style={{ fontSize: "10px", fontWeight: "bold", color: "#777", textTransform: "uppercase", marginBottom: "3px" }}>{SECTION_LABELS[k]}</div>
          <div style={{ fontSize: "13px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{parsed[k]}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
type FormMode = "structured" | "free";

export default function PatientHistory() {
  const [, params] = useRoute("/patients/:id/history");
  const patientId = params?.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { systemName } = useAppSettings();

  const [isEvolutionOpen, setIsEvolutionOpen] = useState(false);
  const [editingEvolution, setEditingEvolution] = useState<EvolutionRecord | null>(null);
  const [deletingEvolution, setDeletingEvolution] = useState<EvolutionRecord | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("structured");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  const emptyFields: Record<SectionKey, string> = { queixa: "", dor: "", exame: "", procedimentos: "", resposta: "", conduta: "", obs: "" };
  const [evFields, setEvFields] = useState<Record<SectionKey, string>>(emptyFields);
  const [evDate, setEvDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [evTherapistId, setEvTherapistId] = useState("");
  const [freeContent, setFreeContent] = useState("");

  const { data: patient, isLoading: isLoadingPatient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => apiFetch(`/api/patients/${patientId}`),
    enabled: !!patientId,
  });
  const { data: historyData = [], isLoading: isLoadingHistory } = useQuery<any[]>({
    queryKey: ["patient-history", patientId],
    queryFn: () => apiFetch(`/api/patients/${patientId}/history`),
    enabled: !!patientId,
  });
  const { data: evolutions = [], isLoading: isLoadingEvolutions } = useQuery<EvolutionRecord[]>({
    queryKey: ["evolutions", patientId],
    queryFn: () => apiFetch(`/api/evolutions/patient/${patientId}`),
    enabled: !!patientId,
  });
  const { data: therapists = [] } = useQuery<TherapistType[]>({
    queryKey: ["therapists"],
    queryFn: () => apiFetch("/api/therapists"),
  });

  const createEvolution = useMutation({
    mutationFn: (data: any) => apiFetch("/api/evolutions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Evolução registrada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["evolutions", patientId] });
      closeDialog();
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao salvar", variant: "destructive" }),
  });

  const updateEvolution = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiFetch(`/api/evolutions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Evolução atualizada" });
      queryClient.invalidateQueries({ queryKey: ["evolutions", patientId] });
      closeDialog();
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteEvolution = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/evolutions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Evolução removida" });
      queryClient.invalidateQueries({ queryKey: ["evolutions", patientId] });
      setDeletingEvolution(null);
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao remover", variant: "destructive" }),
  });

  function closeDialog() {
    setIsEvolutionOpen(false);
    setEditingEvolution(null);
    setSelectedAppointmentId(null);
    setEvFields(emptyFields);
    setEvDate(format(new Date(), "yyyy-MM-dd"));
    setEvTherapistId("");
    setFreeContent("");
    setSelectedTemplate("");
    setFormMode("structured");
  }

  function openNew(apt?: any) {
    setEditingEvolution(null);
    setSelectedAppointmentId(apt?.id ?? null);
    setEvDate(apt?.date ?? format(new Date(), "yyyy-MM-dd"));
    setEvTherapistId(apt?.therapistId?.toString() ?? "");
    setEvFields(emptyFields);
    setFreeContent("");
    setFormMode("structured");
    setIsEvolutionOpen(true);
  }

  function openEdit(ev: EvolutionRecord) {
    setEditingEvolution(ev);
    setEvDate(ev.date);
    setEvTherapistId(ev.therapistId.toString());
    const parsed = parseEvolution(ev.content);
    if (parsed) {
      setEvFields(parsed);
      setFreeContent("");
      setFormMode("structured");
    } else {
      setFreeContent(ev.content);
      setEvFields(emptyFields);
      setFormMode("free");
    }
    setIsEvolutionOpen(true);
  }

  function applyTemplate(templateLabel: string) {
    const tpl = TEMPLATES.find(t => t.label === templateLabel);
    if (!tpl) return;
    setEvFields(f => ({ ...f, ...tpl.fields }));
    setSelectedTemplate(templateLabel);
  }

  function handleSubmit() {
    const content = formMode === "structured" ? buildContent(evFields) : freeContent.trim();
    if (!content) {
      toast({ title: "Preencha pelo menos um campo da evolução", variant: "destructive" });
      return;
    }
    if (!evTherapistId && !editingEvolution) {
      toast({ title: "Selecione o fisioterapeuta", variant: "destructive" });
      return;
    }
    if (editingEvolution) {
      updateEvolution.mutate({ id: editingEvolution.id, data: { content, date: evDate } });
    } else {
      createEvolution.mutate({ patientId, therapistId: parseInt(evTherapistId), date: evDate, content, appointmentId: selectedAppointmentId });
    }
  }

  function toggleExpand(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const history = historyData as any[];
  const isLoading = isLoadingPatient || isLoadingHistory;
  const stats = {
    total: history.length,
    presente: history.filter(a => a.status === "presente").length,
    falta: history.filter(a => a.status === "falta").length,
    cancelado: history.filter(a => a.status === "cancelado").length,
  };

  const filteredEvolutions = useMemo(() => {
    const list = evolutions as EvolutionRecord[];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(ev =>
      ev.content.toLowerCase().includes(q) ||
      ev.therapistName.toLowerCase().includes(q) ||
      fmtDate(ev.date).includes(q)
    );
  }, [evolutions, searchQuery]);

  const sortedEvolutions = useMemo(() =>
    [...(evolutions as EvolutionRecord[])].sort((a, b) => a.date.localeCompare(b.date)),
    [evolutions]
  );

  const p = patient as any;

  function handlePrint() {
    const originalTitle = document.title;
    document.title = `Prontuário-${p?.name || "paciente"}-${format(new Date(), "yyyy-MM-dd")}`;
    window.print();
    document.title = originalTitle;
  }

  return (
    <div className="space-y-6">
      {/* ── Print only ──────────────────────────────────────────── */}
      <div className="hidden print:block">
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #prontuario-print, #prontuario-print * { visibility: visible; }
            #prontuario-print { position: absolute; left: 0; top: 0; width: 100%; }
            .evolution-block { page-break-inside: avoid; }
          }
        `}</style>
        <div id="prontuario-print" style={{ fontFamily: "Georgia, serif", padding: "32px", maxWidth: "800px", margin: "0 auto" }}>
          <div style={{ borderBottom: "2px solid #1a1a1a", paddingBottom: "16px", marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ fontSize: "20px", fontWeight: "bold", margin: 0 }}>{systemName}</h1>
                <h2 style={{ fontSize: "14px", fontWeight: "normal", color: "#555", margin: "4px 0 0" }}>Prontuário Clínico — Registro de Evoluções</h2>
              </div>
              <div style={{ textAlign: "right", fontSize: "12px", color: "#555" }}>
                <div>Emitido em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
              </div>
            </div>
          </div>
          {p && (
            <div style={{ backgroundColor: "#f8f8f8", border: "1px solid #ddd", borderRadius: "6px", padding: "16px", marginBottom: "24px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: "0 0 8px" }}>{p.name}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", fontSize: "13px", color: "#444" }}>
                {p.phone && <span>Telefone: {p.phone}</span>}
                {p.email && <span>E-mail: {p.email}</span>}
                {p.birthDate && <span>Data de nasc.: {fmtDate(p.birthDate)}</span>}
                <span>Convênio: {p.insuranceType === "convenio" ? (p.insuranceName || "Convênio") : "Particular"}</span>
                <span>Sessões restantes: {p.remainingSessions} / {p.totalSessions}</span>
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px", marginBottom: "28px" }}>
            {[{ label: "Total", value: stats.total }, { label: "Presentes", value: stats.presente }, { label: "Faltas", value: stats.falta }, { label: "Cancelados", value: stats.cancelado }].map(s => (
              <div key={s.label} style={{ border: "1px solid #ddd", borderRadius: "6px", padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: "bold" }}>{s.value}</div>
                <div style={{ fontSize: "11px", color: "#666" }}>{s.label}</div>
              </div>
            ))}
          </div>
          <h3 style={{ fontSize: "16px", fontWeight: "bold", borderBottom: "1px solid #ccc", paddingBottom: "8px", marginBottom: "16px" }}>
            Registro de Evoluções ({sortedEvolutions.length})
          </h3>
          {sortedEvolutions.length === 0
            ? <p style={{ color: "#999", textAlign: "center", padding: "32px 0" }}>Nenhuma evolução registrada.</p>
            : sortedEvolutions.map((ev, idx) => (
              <div key={ev.id} className="evolution-block" style={{ marginBottom: "20px", border: "1px solid #e0e0e0", borderRadius: "6px", overflow: "hidden" }}>
                <div style={{ backgroundColor: "#f3f3f3", borderBottom: "1px solid #e0e0e0", padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: "bold", fontSize: "13px" }}>#{idx + 1} — {fmtDate(ev.date)}</div>
                  <div style={{ fontSize: "12px", color: "#555" }}>{ev.therapistName}{ev.therapistSpecialty ? ` · ${ev.therapistSpecialty}` : ""}</div>
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <PrintContent content={ev.content} />
                </div>
              </div>
            ))}
          <div style={{ marginTop: "48px", borderTop: "1px solid #ccc", paddingTop: "12px", textAlign: "center", fontSize: "11px", color: "#999" }}>
            Documento gerado por {systemName} — {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        </div>
      </div>

      {/* ── Screen ──────────────────────────────────────────────── */}
      <div className="print:hidden space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/patients")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Histórico do Paciente</h1>
            <p className="text-muted-foreground mt-1">Atendimentos e evoluções clínicas</p>
          </div>
        </div>

        {isLoading ? (
          <Card className="animate-pulse"><CardContent className="p-6 space-y-3"><div className="h-6 w-1/3 bg-muted rounded" /><div className="h-4 w-1/4 bg-muted rounded" /></CardContent></Card>
        ) : p ? (
          <>
            {/* Patient card */}
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-6">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <UserRound className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{p.name}</h2>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5"><Phone className="h-3.5 w-3.5" /> {p.phone}</div>
                      {p.email && <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5"><Mail className="h-3.5 w-3.5" /> {p.email}</div>}
                      {(p.city || p.state) && <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><MapPin className="h-3 w-3" /> {[p.city, p.state].filter(Boolean).join(", ")}</div>}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className={p.insuranceType === "convenio" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-50 text-gray-600 border-gray-200"}>
                          {p.insuranceType === "convenio" ? p.insuranceName || "Convênio" : "Particular"}
                        </Badge>
                        {p.paymentMethod && <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">{p.paymentMethod}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-4 py-3">
                      <Activity className="h-4 w-4 text-primary" />
                      <span className="text-sm">
                        <span className="font-bold text-primary">{p.remainingSessions}</span>
                        <span className="text-muted-foreground"> / {p.totalSessions} sessões restantes</span>
                      </span>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
                      <Printer className="h-4 w-4" /> Imprimir Prontuário
                    </Button>
                  </div>
                </div>
                {p.notes && <p className="mt-4 text-sm text-muted-foreground italic border-t pt-3">{p.notes}</p>}
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="evolutions">
              <TabsList className="grid w-full sm:w-auto grid-cols-2">
                <TabsTrigger value="appointments" className="gap-2">
                  <CalendarDays className="h-3.5 w-3.5" /> Atendimentos
                </TabsTrigger>
                <TabsTrigger value="evolutions" className="gap-2">
                  <FileText className="h-3.5 w-3.5" /> Evoluções
                  {(evolutions as EvolutionRecord[]).length > 0 && (
                    <span className="ml-1 bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5">{(evolutions as EvolutionRecord[]).length}</span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* ── Appointments tab ─────────────────────────────── */}
              <TabsContent value="appointments" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Total", value: stats.total, color: "text-foreground" },
                    { label: "Presentes", value: stats.presente, color: "text-green-600" },
                    { label: "Faltas", value: stats.falta, color: "text-orange-600" },
                    { label: "Cancelados", value: stats.cancelado, color: "text-red-600" },
                  ].map(stat => (
                    <Card key={stat.label}>
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-primary" /> Registro de Atendimentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {history.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground"><p>Nenhum atendimento registrado.</p></div>
                    ) : (
                      <div className="space-y-2">
                        {history.map((apt: any) => {
                          const hasEvolution = (evolutions as EvolutionRecord[]).some(ev => ev.appointmentId === apt.id);
                          return (
                            <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="text-center min-w-[52px]">
                                  <p className="text-sm font-bold">{fmtDate(apt.date)}</p>
                                  <p className="text-xs text-muted-foreground">{apt.time}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{apt.therapistName}</p>
                                  <p className="text-xs text-muted-foreground">{apt.therapistSpecialty}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {hasEvolution && (
                                  <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">✓ Evolução</span>
                                )}
                                <Badge variant="outline" className={STATUS_COLORS[apt.status] || "bg-gray-100 text-gray-700"}>
                                  {STATUS_LABELS[apt.status] || apt.status}
                                </Badge>
                                {apt.status === "presente" && !hasEvolution && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                                    onClick={() => openNew(apt)}>
                                    <Plus className="h-3 w-3" /> Evolução
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Evolutions tab ───────────────────────────────── */}
              <TabsContent value="evolutions" className="space-y-4 mt-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar nas evoluções..." className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {(evolutions as EvolutionRecord[]).length > 0 && (
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
                        <Printer className="h-4 w-4" /> Imprimir
                      </Button>
                    )}
                    <Button onClick={() => openNew()} className="gap-2" size="sm">
                      <Plus className="h-4 w-4" /> Nova Evolução
                    </Button>
                  </div>
                </div>

                {/* Summary bar */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground px-1">
                  <span>{(evolutions as EvolutionRecord[]).length} evolução(ões) total</span>
                  {searchQuery && <span className="text-primary font-medium">· {filteredEvolutions.length} resultado(s)</span>}
                </div>

                {isLoadingEvolutions ? (
                  <div className="space-y-3">{[1, 2].map(i => (
                    <Card key={i} className="animate-pulse"><CardContent className="p-5 space-y-2"><div className="h-4 w-1/3 bg-muted rounded" /><div className="h-16 w-full bg-muted rounded" /></CardContent></Card>
                  ))}</div>
                ) : filteredEvolutions.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="h-14 w-14 mx-auto mb-4 opacity-20" />
                    <p className="text-base font-medium">{searchQuery ? "Nenhum resultado encontrado" : "Nenhuma evolução registrada"}</p>
                    <p className="text-sm mt-1">{searchQuery ? "Tente um termo diferente" : "Clique em \"Nova Evolução\" para registrar"}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredEvolutions.map((ev, idx) => {
                      const expanded = expandedIds.has(ev.id);
                      const parsed = parseEvolution(ev.content);
                      const hasMore = parsed
                        ? SECTION_KEYS.filter(k => parsed[k]).length > 4
                        : ev.content.length > 280;
                      return (
                        <Card key={ev.id} className="border border-border hover:shadow-md transition-all">
                          <CardContent className="p-0">
                            {/* Card header */}
                            <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 bg-muted/20 rounded-t-xl">
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                    {filteredEvolutions.length - idx}
                                  </div>
                                  <span className="font-semibold text-sm text-primary">{fmtDate(ev.date)}</span>
                                </div>
                                <Separator orientation="vertical" className="h-4" />
                                <div className="flex items-center gap-1.5 text-sm">
                                  <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="font-medium">{ev.therapistName}</span>
                                  {ev.therapistSpecialty && <span className="text-muted-foreground text-xs">· {ev.therapistSpecialty}</span>}
                                </div>
                                {ev.appointmentId && (
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Sessão vinculada
                                  </Badge>
                                )}
                                {parsed && (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Estruturada</Badge>
                                )}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ev)} title="Editar">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingEvolution(ev)} title="Remover">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Card content */}
                            <div className="p-5">
                              <EvolutionContent content={ev.content} expanded={expanded} />
                              {hasMore && (
                                <button
                                  className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
                                  onClick={() => toggleExpand(ev.id)}>
                                  {expanded ? <><ChevronUp className="h-3.5 w-3.5" /> Ver menos</> : <><ChevronDown className="h-3.5 w-3.5" /> Ver completo</>}
                                </button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <UserRound className="h-14 w-14 mx-auto mb-4 opacity-20" />
            <p>Paciente não encontrado.</p>
          </div>
        )}

        {/* ── Evolution Dialog ────────────────────────────────────── */}
        <Dialog open={isEvolutionOpen} onOpenChange={open => !open && closeDialog()}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {editingEvolution ? "Editar Evolução" : "Registrar Evolução Clínica"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Therapist + date */}
              <div className="grid grid-cols-2 gap-3">
                {!editingEvolution && (
                  <div className="col-span-2 sm:col-span-1">
                    <Label>Fisioterapeuta *</Label>
                    <Select value={evTherapistId} onValueChange={setEvTherapistId}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {(therapists as TherapistType[]).map(t => (
                          <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className={editingEvolution ? "col-span-2 sm:col-span-1" : "col-span-2 sm:col-span-1"}>
                  <Label>Data da sessão *</Label>
                  <Input type="date" value={evDate} onChange={e => setEvDate(e.target.value)} />
                </div>
              </div>

              {selectedAppointmentId && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Esta evolução será vinculada à sessão selecionada.
                </p>
              )}

              {/* Mode toggle */}
              <div className="flex items-center justify-between border border-border rounded-lg p-1 bg-muted/30">
                <button
                  type="button"
                  onClick={() => setFormMode("structured")}
                  className={`flex-1 flex items-center justify-center gap-2 text-sm py-1.5 px-3 rounded-md transition-all ${formMode === "structured" ? "bg-background shadow font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
                  <LayoutTemplate className="h-4 w-4" /> Formulário Estruturado
                </button>
                <button
                  type="button"
                  onClick={() => setFormMode("free")}
                  className={`flex-1 flex items-center justify-center gap-2 text-sm py-1.5 px-3 rounded-md transition-all ${formMode === "free" ? "bg-background shadow font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
                  <FileText className="h-4 w-4" /> Texto Livre
                </button>
              </div>

              {formMode === "structured" ? (
                <>
                  {/* Templates */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Templates rápidos</Label>
                    <div className="flex flex-wrap gap-2">
                      {TEMPLATES.map(tpl => (
                        <button key={tpl.label} type="button"
                          onClick={() => applyTemplate(tpl.label)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedTemplate === tpl.label ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Structured fields */}
                  <div className="space-y-3">
                    <div>
                      <Label className="flex items-center gap-1.5 mb-1.5">
                        {SECTION_ICONS.queixa} {SECTION_LABELS.queixa}
                      </Label>
                      <Textarea rows={2} className="resize-none" placeholder="Descreva a queixa principal do paciente nesta sessão..."
                        value={evFields.queixa} onChange={e => setEvFields(f => ({ ...f, queixa: e.target.value }))} />
                    </div>

                    <div>
                      <Label className="flex items-center gap-1.5 mb-1.5">
                        {SECTION_ICONS.dor} {SECTION_LABELS.dor}
                      </Label>
                      <PainScale value={evFields.dor} onChange={v => setEvFields(f => ({ ...f, dor: v }))} />
                    </div>

                    <div>
                      <Label className="flex items-center gap-1.5 mb-1.5">
                        {SECTION_ICONS.exame} {SECTION_LABELS.exame}
                      </Label>
                      <Textarea rows={3} className="resize-none" placeholder="ADM, força muscular, palpação, testes especiais..."
                        value={evFields.exame} onChange={e => setEvFields(f => ({ ...f, exame: e.target.value }))} />
                    </div>

                    <div>
                      <Label className="flex items-center gap-1.5 mb-1.5">
                        {SECTION_ICONS.procedimentos} {SECTION_LABELS.procedimentos}
                      </Label>
                      <Textarea rows={2} className="resize-none" placeholder="Cinesioterapia, eletroterapia, mobilização, exercícios..."
                        value={evFields.procedimentos} onChange={e => setEvFields(f => ({ ...f, procedimentos: e.target.value }))} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="flex items-center gap-1.5 mb-1.5">
                          {SECTION_ICONS.resposta} {SECTION_LABELS.resposta}
                        </Label>
                        <Textarea rows={2} className="resize-none" placeholder="Boa tolerância, melhora parcial..."
                          value={evFields.resposta} onChange={e => setEvFields(f => ({ ...f, resposta: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="flex items-center gap-1.5 mb-1.5">
                          {SECTION_ICONS.conduta} {SECTION_LABELS.conduta}
                        </Label>
                        <Textarea rows={2} className="resize-none" placeholder="Manter protocolo, ajustar carga..."
                          value={evFields.conduta} onChange={e => setEvFields(f => ({ ...f, conduta: e.target.value }))} />
                      </div>
                    </div>

                    <div>
                      <Label className="flex items-center gap-1.5 mb-1.5">
                        {SECTION_ICONS.obs} {SECTION_LABELS.obs} <span className="text-muted-foreground text-xs">(opcional)</span>
                      </Label>
                      <Textarea rows={2} className="resize-none" placeholder="Observações adicionais, orientações ao paciente..."
                        value={evFields.obs} onChange={e => setEvFields(f => ({ ...f, obs: e.target.value }))} />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <Label>Evolução Clínica</Label>
                  <Textarea rows={10} className="resize-none mt-1.5" placeholder="Descreva o progresso do paciente, técnicas utilizadas, observações clínicas, resposta ao tratamento..."
                    value={freeContent} onChange={e => setFreeContent(e.target.value)} />
                </div>
              )}
            </div>

            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createEvolution.isPending || updateEvolution.isPending} className="gap-2">
                <FileText className="h-4 w-4" />
                {editingEvolution ? "Salvar Alterações" : "Registrar Evolução"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete dialog */}
        <AlertDialog open={!!deletingEvolution} onOpenChange={open => !open && setDeletingEvolution(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover Evolução</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover a evolução do dia <strong>{deletingEvolution ? fmtDate(deletingEvolution.date) : ""}</strong>? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deletingEvolution && deleteEvolution.mutate(deletingEvolution.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
