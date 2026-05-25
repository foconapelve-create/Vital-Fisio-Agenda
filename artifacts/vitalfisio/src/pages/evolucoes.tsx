import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Search, X, ChevronDown, ChevronUp,
  UserRound, Stethoscope, Activity, Zap, Target,
  CheckCircle2, StickyNote, ExternalLink, Calendar,
  Plus, LayoutTemplate,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
type EvolutionRecord = {
  id: number; patientId: number; therapistId: number; appointmentId: number | null;
  date: string; content: string; therapistName: string; therapistSpecialty: string;
  patientName: string; createdAt: string;
};
type Patient = { id: number; name: string; phone?: string };
type Therapist = { id: number; name: string; specialty: string };

const fmtDate = (s: string) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };

// ── Structured evolution helpers ──────────────────────────────────────────────
const SECTION_KEYS = ["queixa", "dor", "exame", "procedimentos", "resposta", "conduta", "obs"] as const;
type SectionKey = typeof SECTION_KEYS[number];
const SECTION_LABELS: Record<SectionKey, string> = {
  queixa: "Queixa Principal", dor: "Dor (0–10)", exame: "Exame Físico",
  procedimentos: "Procedimentos", resposta: "Resposta", conduta: "Conduta", obs: "Observações",
};
const SECTION_ICONS: Record<SectionKey, React.ReactNode> = {
  queixa: <StickyNote className="h-3.5 w-3.5" />, dor: <Zap className="h-3.5 w-3.5" />,
  exame: <Stethoscope className="h-3.5 w-3.5" />, procedimentos: <Activity className="h-3.5 w-3.5" />,
  resposta: <CheckCircle2 className="h-3.5 w-3.5" />, conduta: <Target className="h-3.5 w-3.5" />,
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

const TEMPLATES = [
  { label: "Sessão Padrão", fields: { queixa: "", dor: "", exame: "ADM preservada / limitação em ", procedimentos: "Cinesioterapia, ", resposta: "Boa tolerância ao tratamento", conduta: "Manter protocolo vigente", obs: "" } },
  { label: "Avaliação Inicial", fields: { queixa: "", dor: "", exame: "Inspeção: \nPalpação: \nADM: \nTestes especiais: ", procedimentos: "Avaliação fisioterapêutica completa", resposta: "—", conduta: "Iniciar protocolo de tratamento conforme diagnóstico clínico", obs: "Paciente orientado sobre diagnóstico e plano terapêutico" } },
  { label: "Alta Fisioterapêutica", fields: { queixa: "Paciente refere melhora significativa do quadro inicial", dor: "0", exame: "Objetivos terapêuticos atingidos", procedimentos: "Sessão de alta com orientações domiciliares", resposta: "Excelente evolução durante o tratamento", conduta: "Alta fisioterapêutica. Manter exercícios em domicílio.", obs: "Paciente orientado a retornar em caso de recidiva" } },
  { label: "Reavaliação", fields: { queixa: "", dor: "", exame: "Reavaliação: \nComparado à avaliação inicial: ", procedimentos: "Reavaliação e ajuste de protocolo", resposta: "", conduta: "", obs: "" } },
];

// ── Pain scale ────────────────────────────────────────────────────────────────
function PainScale({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const num = parseInt(value) || 0;
  const colors = ["bg-green-500","bg-green-400","bg-lime-400","bg-yellow-400","bg-yellow-500","bg-orange-400","bg-orange-500","bg-red-400","bg-red-500","bg-red-600","bg-red-700"];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: 11 }, (_, i) => (
          <button key={i} type="button" onClick={() => onChange(i.toString())}
            className={`h-7 flex-1 rounded text-xs font-bold transition-all border-2 ${i === num ? `${colors[i]} text-white border-transparent scale-110 shadow` : "bg-muted border-border text-muted-foreground hover:bg-muted/80"}`}>
            {i}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground px-0.5">
        <span>Sem dor</span><span>Moderada</span><span>Insuportável</span>
      </div>
    </div>
  );
}

// ── Card display helpers ──────────────────────────────────────────────────────
function DorBadge({ value }: { value: string }) {
  const num = parseInt(value);
  if (isNaN(num)) return <span className="text-sm">{value}</span>;
  const color = num <= 2 ? "bg-green-500" : num <= 4 ? "bg-yellow-400" : num <= 6 ? "bg-orange-400" : "bg-red-500";
  return <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold ${color}`}>{num}</div>;
}

function EvolutionContent({ content, expanded }: { content: string; expanded: boolean }) {
  const parsed = parseEvolution(content);
  if (!parsed) {
    const text = expanded ? content : content.slice(0, 240) + (content.length > 240 ? "…" : "");
    return <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">{text}</p>;
  }
  const fields = SECTION_KEYS.filter(k => parsed[k]);
  const visible = expanded ? fields : fields.slice(0, 3);
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {visible.map(k => (
        <div key={k} className={`rounded-lg p-2.5 bg-muted/40 border border-border/60 ${k === "exame" || k === "procedimentos" || k === "obs" ? "sm:col-span-2" : ""}`}>
          <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {SECTION_ICONS[k]} {SECTION_LABELS[k]}
          </div>
          {k === "dor"
            ? <div className="flex items-center gap-2"><DorBadge value={parsed[k]} /><span className="text-sm">{parsed[k]}/10</span></div>
            : <p className="text-sm whitespace-pre-wrap leading-relaxed">{parsed[k]}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Nova Evolução Dialog ──────────────────────────────────────────────────────
type FormMode = "structured" | "free";
const emptyFields: Record<SectionKey, string> = { queixa: "", dor: "", exame: "", procedimentos: "", resposta: "", conduta: "", obs: "" };

function NovaEvolucaoDialog({ open, onClose, onSuccess, patients, therapists }: {
  open: boolean; onClose: () => void; onSuccess: () => void;
  patients: Patient[]; therapists: Therapist[];
}) {
  const { toast } = useToast();
  const [patientSearch, setPatientSearch] = useState("");
  const [patientId, setPatientId] = useState("");
  const [therapistId, setTherapistId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formMode, setFormMode] = useState<FormMode>("structured");
  const [evFields, setEvFields] = useState<Record<SectionKey, string>>(emptyFields);
  const [freeContent, setFreeContent] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients;
    const q = patientSearch.toLowerCase();
    return patients.filter(p => p.name.toLowerCase().includes(q));
  }, [patients, patientSearch]);

  const selectedPatient = patients.find(p => p.id.toString() === patientId);

  const createEvolution = useMutation({
    mutationFn: (data: any) => apiFetch("/api/evolutions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Evolução registrada com sucesso" });
      onSuccess();
      handleClose();
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao salvar", variant: "destructive" }),
  });

  function handleClose() {
    setPatientSearch(""); setPatientId(""); setTherapistId("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setEvFields(emptyFields); setFreeContent("");
    setSelectedTemplate(""); setFormMode("structured");
    onClose();
  }

  function applyTemplate(label: string) {
    const tpl = TEMPLATES.find(t => t.label === label);
    if (!tpl) return;
    setEvFields(f => ({ ...f, ...tpl.fields }));
    setSelectedTemplate(label);
  }

  function handleSubmit() {
    if (!patientId) { toast({ title: "Selecione o paciente", variant: "destructive" }); return; }
    if (!therapistId) { toast({ title: "Selecione o fisioterapeuta", variant: "destructive" }); return; }
    const content = formMode === "structured" ? buildContent(evFields) : freeContent.trim();
    if (!content) { toast({ title: "Preencha pelo menos um campo da evolução", variant: "destructive" }); return; }
    createEvolution.mutate({ patientId: parseInt(patientId), therapistId: parseInt(therapistId), date, content });
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Registrar Nova Evolução
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient selection */}
          <div>
            <Label>Paciente *</Label>
            {selectedPatient ? (
              <div className="mt-1.5 flex items-center justify-between p-3 rounded-lg border border-primary/40 bg-primary/5">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{selectedPatient.name}</span>
                </div>
                <button onClick={() => { setPatientId(""); setPatientSearch(""); }}
                  className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="mt-1.5 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar paciente pelo nome..." className="pl-9"
                    value={patientSearch} onChange={e => setPatientSearch(e.target.value)} />
                </div>
                {patientSearch && (
                  <div className="border border-border rounded-lg max-h-40 overflow-y-auto divide-y divide-border/50">
                    {filteredPatients.length === 0
                      ? <p className="text-sm text-muted-foreground text-center py-3">Nenhum paciente encontrado</p>
                      : filteredPatients.slice(0, 8).map(p => (
                        <button key={p.id} type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                          onClick={() => { setPatientId(p.id.toString()); setPatientSearch(""); }}>
                          <UserRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          {p.name}
                          {p.phone && <span className="text-xs text-muted-foreground ml-auto">{p.phone}</span>}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Therapist + date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fisioterapeuta *</Label>
              <Select value={therapistId} onValueChange={setTherapistId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {therapists.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data da sessão *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1.5" />
            </div>
          </div>

          <Separator />

          {/* Mode toggle */}
          <div className="flex items-center justify-between border border-border rounded-lg p-1 bg-muted/30">
            <button type="button" onClick={() => setFormMode("structured")}
              className={`flex-1 flex items-center justify-center gap-2 text-sm py-1.5 px-3 rounded-md transition-all ${formMode === "structured" ? "bg-background shadow font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
              <LayoutTemplate className="h-4 w-4" /> Formulário Estruturado
            </button>
            <button type="button" onClick={() => setFormMode("free")}
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
                    <button key={tpl.label} type="button" onClick={() => applyTemplate(tpl.label)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedTemplate === tpl.label ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">{SECTION_ICONS.queixa} {SECTION_LABELS.queixa}</Label>
                  <Textarea rows={2} className="resize-none" placeholder="Descreva a queixa principal..."
                    value={evFields.queixa} onChange={e => setEvFields(f => ({ ...f, queixa: e.target.value }))} />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">{SECTION_ICONS.dor} {SECTION_LABELS.dor}</Label>
                  <PainScale value={evFields.dor} onChange={v => setEvFields(f => ({ ...f, dor: v }))} />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">{SECTION_ICONS.exame} {SECTION_LABELS.exame}</Label>
                  <Textarea rows={3} className="resize-none" placeholder="ADM, força muscular, palpação, testes especiais..."
                    value={evFields.exame} onChange={e => setEvFields(f => ({ ...f, exame: e.target.value }))} />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">{SECTION_ICONS.procedimentos} {SECTION_LABELS.procedimentos}</Label>
                  <Textarea rows={2} className="resize-none" placeholder="Cinesioterapia, eletroterapia, mobilização..."
                    value={evFields.procedimentos} onChange={e => setEvFields(f => ({ ...f, procedimentos: e.target.value }))} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="flex items-center gap-1.5 mb-1.5">{SECTION_ICONS.resposta} {SECTION_LABELS.resposta}</Label>
                    <Textarea rows={2} className="resize-none" placeholder="Boa tolerância..."
                      value={evFields.resposta} onChange={e => setEvFields(f => ({ ...f, resposta: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1.5 mb-1.5">{SECTION_ICONS.conduta} {SECTION_LABELS.conduta}</Label>
                    <Textarea rows={2} className="resize-none" placeholder="Manter protocolo..."
                      value={evFields.conduta} onChange={e => setEvFields(f => ({ ...f, conduta: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">{SECTION_ICONS.obs} Observações <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                  <Textarea rows={2} className="resize-none" placeholder="Orientações ao paciente, notas adicionais..."
                    value={evFields.obs} onChange={e => setEvFields(f => ({ ...f, obs: e.target.value }))} />
                </div>
              </div>
            </>
          ) : (
            <div>
              <Label>Evolução Clínica</Label>
              <Textarea rows={10} className="resize-none mt-1.5"
                placeholder="Descreva o progresso do paciente, técnicas utilizadas, observações clínicas..."
                value={freeContent} onChange={e => setFreeContent(e.target.value)} />
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createEvolution.isPending} className="gap-2">
            <FileText className="h-4 w-4" />
            {createEvolution.isPending ? "Salvando..." : "Registrar Evolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Evolucoes() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [isNewOpen, setIsNewOpen] = useState(false);

  const { data: evolutions = [], isLoading } = useQuery<EvolutionRecord[]>({
    queryKey: ["evolutions-all"],
    queryFn: () => apiFetch("/api/evolutions?limit=200"),
    refetchInterval: 60000,
  });

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["patients"],
    queryFn: () => apiFetch("/api/patients"),
  });

  const { data: therapists = [] } = useQuery<Therapist[]>({
    queryKey: ["therapists"],
    queryFn: () => apiFetch("/api/therapists"),
  });

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return evolutions as EvolutionRecord[];
    const q = searchQuery.toLowerCase();
    return (evolutions as EvolutionRecord[]).filter(ev =>
      ev.patientName.toLowerCase().includes(q) ||
      ev.therapistName.toLowerCase().includes(q) ||
      ev.content.toLowerCase().includes(q) ||
      fmtDate(ev.date).includes(q)
    );
  }, [evolutions, searchQuery]);

  function toggleExpand(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const groupedByDate = useMemo(() => {
    const groups: Record<string, EvolutionRecord[]> = {};
    for (const ev of filtered) {
      if (!groups[ev.date]) groups[ev.date] = [];
      groups[ev.date].push(ev);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const uniquePatients = useMemo(() =>
    new Set((evolutions as EvolutionRecord[]).map(e => e.patientId)).size, [evolutions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evoluções Clínicas</h1>
          <p className="text-muted-foreground mt-1">Registro de evoluções de todos os pacientes</p>
        </div>
        <Button onClick={() => setIsNewOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Evolução
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{(evolutions as EvolutionRecord[]).length}</p>
            <p className="text-sm text-muted-foreground mt-0.5">Total de Evoluções</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-teal-600">{uniquePatients}</p>
            <p className="text-sm text-muted-foreground mt-0.5">Pacientes com Evolução</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{groupedByDate.length}</p>
            <p className="text-sm text-muted-foreground mt-0.5">Dias com Registro</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por paciente, fisioterapeuta, data ou conteúdo..."
          className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {searchQuery && (
        <p className="text-sm text-muted-foreground -mt-2">
          {filtered.length} resultado(s) para "<span className="font-medium text-foreground">{searchQuery}</span>"
        </p>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5 space-y-3">
                <div className="h-4 w-1/4 bg-muted rounded" />
                <div className="h-16 w-full bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileText className="h-14 w-14 mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium">{searchQuery ? "Nenhum resultado" : "Nenhuma evolução registrada"}</p>
          <p className="text-sm mt-1">{searchQuery ? "Tente um termo diferente" : "Clique em \"Nova Evolução\" para registrar"}</p>
          <Button className="mt-4 gap-2" onClick={() => setIsNewOpen(true)}>
            <Plus className="h-4 w-4" /> Nova Evolução
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map(([date, evs]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2 bg-muted/60 rounded-full px-3 py-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold">{fmtDate(date)}</span>
                  <span className="text-xs text-muted-foreground">· {evs.length} evolução(ões)</span>
                </div>
                <Separator className="flex-1" />
              </div>

              <div className="space-y-3 pl-1">
                {evs.map(ev => {
                  const expanded = expandedIds.has(ev.id);
                  const parsed = parseEvolution(ev.content);
                  const hasMore = parsed
                    ? SECTION_KEYS.filter(k => parsed[k]).length > 3
                    : ev.content.length > 240;
                  return (
                    <Card key={ev.id} className="border border-border hover:shadow-md transition-all">
                      <CardContent className="p-0">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-muted/20 rounded-t-xl">
                          <div className="flex items-center gap-3 flex-wrap min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <UserRound className="h-4 w-4 text-primary" />
                              </div>
                              <span className="font-semibold text-sm truncate max-w-[160px]">{ev.patientName}</span>
                            </div>
                            <Separator orientation="vertical" className="h-4 shrink-0" />
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                              <Stethoscope className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[120px]">{ev.therapistName}</span>
                              {ev.therapistSpecialty && <span className="hidden sm:inline">· {ev.therapistSpecialty}</span>}
                            </div>
                            {ev.appointmentId && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 gap-1 shrink-0">
                                <CheckCircle2 className="h-3 w-3" /> Sessão
                              </Badge>
                            )}
                            {parsed && <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 shrink-0">Estruturada</Badge>}
                          </div>
                          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-primary hover:text-primary shrink-0 ml-2"
                            onClick={() => setLocation(`/patients/${ev.patientId}/history`)}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Ver Paciente</span>
                          </Button>
                        </div>
                        <div className="p-5">
                          <EvolutionContent content={ev.content} expanded={expanded} />
                          {hasMore && (
                            <button className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
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
            </div>
          ))}
        </div>
      )}

      {/* Nova Evolução Dialog */}
      <NovaEvolucaoDialog
        open={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["evolutions-all"] })}
        patients={patients as Patient[]}
        therapists={therapists as Therapist[]}
      />
    </div>
  );
}
