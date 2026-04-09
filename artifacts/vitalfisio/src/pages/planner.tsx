import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutGrid, Calendar, List, BarChart3, Plus, Edit2, Trash2, Copy,
  Sparkles, Send, ChevronLeft, ChevronRight, X, Download, Printer,
  Lightbulb, BookTemplate, MessageSquare, Filter, CheckCircle2, Clock,
  AlertCircle, Zap, ArrowRight, RefreshCw, Bot,
} from "lucide-react";
import { format, addDays, addWeeks, addMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday,
  isBefore, parseISO, getMonth, getYear, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const TIPOS = ["reels","story","carrossel","post_estatico","video","texto","campanha","anuncio","outro"] as const;
const TIPOS_LABELS: Record<string, string> = {
  reels:"Reels", story:"Story", carrossel:"Carrossel", post_estatico:"Post Estático",
  video:"Vídeo", texto:"Texto", campanha:"Campanha", anuncio:"Anúncio", outro:"Outro",
};
const OBJETIVOS = ["engajamento","autoridade","conversao","relacionamento","venda","captacao_leads"] as const;
const OBJ_LABELS: Record<string, string> = {
  engajamento:"Engajamento", autoridade:"Autoridade", conversao:"Conversão",
  relacionamento:"Relacionamento", venda:"Venda", captacao_leads:"Captação de Leads",
};
const STATUSES = ["pendente","em_criacao","em_revisao","aprovado","agendado","publicado","cancelado"] as const;
const STATUS_LABELS: Record<string, string> = {
  pendente:"Pendente", em_criacao:"Em Criação", em_revisao:"Em Revisão",
  aprovado:"Aprovado", agendado:"Agendado", publicado:"Publicado", cancelado:"Cancelado",
};
const STATUS_COLORS: Record<string, string> = {
  pendente:"bg-gray-100 text-gray-700 border-gray-300",
  em_criacao:"bg-blue-100 text-blue-800 border-blue-300",
  em_revisao:"bg-yellow-100 text-yellow-800 border-yellow-300",
  aprovado:"bg-teal-100 text-teal-800 border-teal-300",
  agendado:"bg-purple-100 text-purple-800 border-purple-300",
  publicado:"bg-green-100 text-green-800 border-green-300",
  cancelado:"bg-red-100 text-red-700 border-red-300",
};
const PRIORIDADES = ["baixa","media","alta","urgente"] as const;
const PRIO_LABELS: Record<string, string> = { baixa:"Baixa", media:"Média", alta:"Alta", urgente:"Urgente" };
const PRIO_COLORS: Record<string, string> = {
  baixa:"text-gray-500", media:"text-blue-500", alta:"text-orange-500", urgente:"text-red-600 font-bold",
};
const CANAIS = ["instagram","whatsapp","facebook","tiktok","blog","email","outro"] as const;
const CANAL_LABELS: Record<string, string> = {
  instagram:"Instagram", whatsapp:"WhatsApp", facebook:"Facebook", tiktok:"TikTok",
  blog:"Blog", email:"E-mail", outro:"Outro",
};

const QUICK_PROMPTS = [
  "Criar roteiro para Reels de fisioterapia",
  "Criar legenda para post de autoridade",
  "Criar carrossel educativo (10 slides)",
  "Criar sequência de 5 Stories",
  "Criar campanha promocional",
  "Criar conteúdo para engajamento",
  "Criar conteúdo de autoridade médica",
  "Criar conteúdo para vendas de pacotes",
  "Melhorar este texto",
  "Resumir e simplificar ideia",
  "Transformar ideia em calendário semanal",
  "Gerar ideias para datas comemorativas",
];

const TEMPLATES = [
  { id:"reels-autoridade", title:"Reels de Autoridade", tipo:"reels", objetivo:"autoridade",
    descricao:"Mostre seu conhecimento sobre um tema específico de fisioterapia em até 60 segundos.",
    estrutura:"1. Hook de impacto (3s)\n2. Problema comum do paciente (10s)\n3. Solução/conhecimento (30s)\n4. CTA (5s)" },
  { id:"reels-conexao", title:"Reels de Conexão", tipo:"reels", objetivo:"relacionamento",
    descricao:"Humanize a clínica mostrando equipe, bastidores ou resultados de pacientes.",
    estrutura:"1. Apresentação (5s)\n2. História real (40s)\n3. Mensagem emocional (10s)\n4. CTA (5s)" },
  { id:"reels-vendas", title:"Reels de Vendas", tipo:"reels", objetivo:"venda",
    descricao:"Apresente um serviço ou pacote de tratamento de forma atrativa.",
    estrutura:"1. Dor do paciente (10s)\n2. Solução da clínica (25s)\n3. Prova social (15s)\n4. Oferta + CTA (10s)" },
  { id:"story-bastidor", title:"Story de Bastidor", tipo:"story", objetivo:"relacionamento",
    descricao:"Mostre o dia a dia da clínica para criar proximidade com o público.",
    estrutura:"Story 1: Chegada equipe\nStory 2: Preparação sala\nStory 3: Atendimento (sem mostrar rosto sem autorização)\nStory 4: Resultado/depoimento" },
  { id:"story-enquete", title:"Story com Enquete", tipo:"story", objetivo:"engajamento",
    descricao:"Gere interação com o público através de perguntas e enquetes.",
    estrutura:"Story 1: Pergunta provocativa\nStory 2: Enquete Sim/Não\nStory 3: Resposta/revelação\nStory 4: CTA para contato" },
  { id:"carrossel-educativo", title:"Carrossel Educativo", tipo:"carrossel", objetivo:"autoridade",
    descricao:"Ensine algo valioso sobre saúde e fisioterapia de forma visual e didática.",
    estrutura:"Slide 1: Capa chamativa\nSlide 2-9: Conteúdo em tópicos\nSlide 10: CTA" },
  { id:"post-prova-social", title:"Post de Prova Social", tipo:"post_estatico", objetivo:"conversao",
    descricao:"Compartilhe depoimentos e resultados de pacientes (com autorização).",
    estrutura:"Imagem: Foto do paciente (ou texto)\nLegenda: Depoimento + contexto + CTA" },
  { id:"post-oferta", title:"Post de Oferta", tipo:"post_estatico", objetivo:"venda",
    descricao:"Divulgue uma promoção ou pacote especial da clínica.",
    estrutura:"Visual: Oferta em destaque\nLegenda: Benefícios + urgência + CTA direto" },
];

type Task = {
  id: number; title: string; tipo: string; objetivo: string; descricao?: string;
  data: string; hora: string; responsavel?: string; status: string; prioridade: string;
  canal: string; tema?: string; publico_alvo?: string; cta?: string; observacoes?: string;
  roteiro?: string; legenda?: string; cta_gerado?: string; ideia_visual?: string;
  hashtags?: string; obs_estrategicas?: string; recorrente?: boolean;
  criado_por?: string; created_at: string;
};

type Idea = { id: number; title: string; tema?: string; objetivo?: string; canal?: string; observacao?: string; convertida?: boolean; created_at: string; };
type ChatMsg = { role: "user" | "assistant"; content: string; };
type ViewMode = "mes" | "semana" | "dia" | "ano";

const EMPTY_TASK: Partial<Task> = {
  title: "", tipo: "post_estatico", objetivo: "engajamento", descricao: "",
  data: format(new Date(), "yyyy-MM-dd"), hora: "09:00", responsavel: "",
  status: "pendente", prioridade: "media", canal: "instagram", tema: "",
  publico_alvo: "", cta: "", observacoes: "", roteiro: "", legenda: "",
  cta_gerado: "", ideia_visual: "", hashtags: "", obs_estrategicas: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtDate = (s: string) => { if (!s) return ""; const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };

function TaskCard({ task, onEdit, onDelete, onStatusChange, onDuplicate, onAI, isSelected, onSelect }: {
  task: Task; onEdit: () => void; onDelete: () => void;
  onStatusChange: (s: string) => void; onDuplicate: () => void;
  onAI: () => void; isSelected: boolean; onSelect: () => void;
}) {
  const isLate = isBefore(parseISO(task.data), new Date()) && !["publicado","cancelado"].includes(task.status);
  return (
    <div className={cn(
      "group relative p-2.5 rounded-lg border text-xs cursor-pointer transition-all hover:shadow-sm",
      STATUS_COLORS[task.status] || "bg-gray-100",
      isLate ? "ring-1 ring-orange-400" : "",
      isSelected ? "ring-2 ring-primary" : "",
    )} onClick={onSelect}>
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          <input type="checkbox" className="h-3 w-3 shrink-0" checked={isSelected}
            onChange={e => { e.stopPropagation(); onSelect(); }} onClick={e => e.stopPropagation()} />
          <span className="font-semibold truncate text-xs">{task.title}</span>
          {isLate && <AlertCircle className="h-3 w-3 text-orange-500 shrink-0" />}
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 shrink-0">
          <button title="IA" onClick={e => { e.stopPropagation(); onAI(); }} className="p-0.5 hover:text-purple-600"><Sparkles className="h-3 w-3" /></button>
          <button title="Editar" onClick={e => { e.stopPropagation(); onEdit(); }} className="p-0.5 hover:text-blue-600"><Edit2 className="h-3 w-3" /></button>
          <button title="Duplicar" onClick={e => { e.stopPropagation(); onDuplicate(); }} className="p-0.5 hover:text-teal-600"><Copy className="h-3 w-3" /></button>
          <button title="Excluir" onClick={e => { e.stopPropagation(); onDelete(); }} className="p-0.5 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        <span className="opacity-60">{TIPOS_LABELS[task.tipo] || task.tipo}</span>
        <span className="opacity-40">·</span>
        <span className={cn("font-medium", PRIO_COLORS[task.prioridade])}>{PRIO_LABELS[task.prioridade]}</span>
      </div>
      <select
        value={task.status}
        onChange={e => { e.stopPropagation(); onStatusChange(e.target.value); }}
        onClick={e => e.stopPropagation()}
        className="mt-1.5 w-full text-[10px] rounded border-0 bg-white/50 px-1 py-0.5 focus:outline-none cursor-pointer"
      >
        {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
      </select>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────

export default function Planner() {
  const [tab, setTab] = useState<"calendario" | "ideias" | "modelos" | "dashboard">("calendario");
  const [viewMode, setViewMode] = useState<ViewMode>("mes");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [taskOpen, setTaskOpen] = useState(false);
  const [editTask, setEditTask] = useState<Partial<Task>>(EMPTY_TASK);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiContext, setAiContext] = useState("");
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [newIdea, setNewIdea] = useState({ title: "", tema: "", objetivo: "engajamento", canal: "instagram", observacao: "" });
  const [ideaSearch, setIdeaSearch] = useState("");
  const [filters, setFilters] = useState({ status: "all", tipo: "all", canal: "all", prioridade: "all" });
  const [showFilters, setShowFilters] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Date range for queries
  const { from, to } = useMemo(() => {
    if (viewMode === "mes") {
      return { from: format(startOfMonth(currentDate), "yyyy-MM-dd"), to: format(endOfMonth(currentDate), "yyyy-MM-dd") };
    }
    if (viewMode === "semana") {
      return { from: format(startOfWeek(currentDate, { weekStartsOn: 0 }), "yyyy-MM-dd"), to: format(endOfWeek(currentDate, { weekStartsOn: 0 }), "yyyy-MM-dd") };
    }
    if (viewMode === "ano") {
      return { from: `${getYear(currentDate)}-01-01`, to: `${getYear(currentDate)}-12-31` };
    }
    return { from: format(currentDate, "yyyy-MM-dd"), to: format(currentDate, "yyyy-MM-dd") };
  }, [viewMode, currentDate]);

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["content-tasks", from, to, filters],
    queryFn: () => {
      const p = new URLSearchParams({ from, to });
      if (filters.status !== "all") p.set("status", filters.status);
      if (filters.tipo !== "all") p.set("tipo", filters.tipo);
      if (filters.canal !== "all") p.set("canal", filters.canal);
      if (filters.prioridade !== "all") p.set("prioridade", filters.prioridade);
      return apiFetch(`/api/content-tasks?${p}`);
    },
  });

  const { data: ideas = [] } = useQuery<Idea[]>({
    queryKey: ["content-ideas"],
    queryFn: () => apiFetch("/api/content-ideas"),
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["content-stats"],
    queryFn: () => apiFetch("/api/content-tasks/stats"),
    refetchInterval: 60000,
  });

  const createMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/content-tasks", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-tasks"] }); qc.invalidateQueries({ queryKey: ["content-stats"] }); toast({ title: "Tarefa criada!" }); setTaskOpen(false); },
    onError: (e: any) => toast({ title: e.message || "Erro", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => apiFetch(`/api/content-tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-tasks"] }); toast({ title: "Tarefa atualizada!" }); setTaskOpen(false); },
    onError: (e: any) => toast({ title: e.message || "Erro", variant: "destructive" }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: any) => apiFetch(`/api/content-tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-tasks"] }); qc.invalidateQueries({ queryKey: ["content-stats"] }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/content-tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-tasks"] }); qc.invalidateQueries({ queryKey: ["content-stats"] }); toast({ title: "Tarefa excluída" }); setDeleteId(null); },
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: number[]) => apiFetch("/api/content-tasks", { method: "DELETE", body: JSON.stringify({ ids }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-tasks"] }); qc.invalidateQueries({ queryKey: ["content-stats"] });
      toast({ title: `${selectedIds.size} tarefas excluídas` });
      setSelectedIds(new Set()); setBulkDeleteOpen(false);
    },
  });

  const dupMut = useMutation({
    mutationFn: ({ id, newDate }: any) => apiFetch(`/api/content-tasks/${id}/duplicate`, { method: "POST", body: JSON.stringify({ newDate }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-tasks"] }); toast({ title: "Tarefa duplicada!" }); },
  });

  const createIdeaMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/content-ideas", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-ideas"] }); toast({ title: "Ideia salva!" }); setIdeaOpen(false); setNewIdea({ title: "", tema: "", objetivo: "engajamento", canal: "instagram", observacao: "" }); },
  });

  const deleteIdeaMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/content-ideas/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-ideas"] }); toast({ title: "Ideia removida" }); },
  });

  const ideaToTaskMut = useMutation({
    mutationFn: ({ id, data }: any) => apiFetch(`/api/content-ideas/${id}/to-task`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-ideas"] }); qc.invalidateQueries({ queryKey: ["content-tasks"] }); toast({ title: "Ideia convertida em tarefa!" }); },
  });

  // Navigate
  const navigate = (dir: 1 | -1) => {
    if (viewMode === "mes") setCurrentDate(d => addMonths(d, dir));
    else if (viewMode === "semana") setCurrentDate(d => addWeeks(d, dir));
    else if (viewMode === "dia") setCurrentDate(d => addDays(d, dir));
    else setCurrentDate(d => new Date(d.getFullYear() + dir, 0, 1));
  };

  const openCreate = (date?: string) => {
    setEditTask({ ...EMPTY_TASK, data: date || format(new Date(), "yyyy-MM-dd") });
    setIsEditing(false);
    setTaskOpen(true);
  };

  const openEdit = (t: Task) => { setEditTask({ ...t }); setIsEditing(true); setTaskOpen(true); };

  const openAI = (task?: Task) => {
    if (task) {
      setAiContext(`Tarefa: "${task.title}"\nTipo: ${TIPOS_LABELS[task.tipo]}\nObjetivo: ${OBJ_LABELS[task.objetivo]}\nCanal: ${CANAL_LABELS[task.canal]}\nDescrição: ${task.descricao || "—"}\nTema: ${task.tema || "—"}`);
    } else {
      setAiContext("");
    }
    setAiOpen(true);
  };

  const handleSaveTask = () => {
    if (!editTask.title?.trim() || !editTask.data) {
      toast({ title: "Título e data são obrigatórios", variant: "destructive" }); return;
    }
    if (isEditing && editTask.id) {
      updateMut.mutate({ id: editTask.id, data: editTask });
    } else {
      createMut.mutate(editTask);
    }
  };

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setEditTask(prev => ({ ...prev, tipo: t.tipo, objetivo: t.objetivo, descricao: t.descricao + "\n\nEstrutura:\n" + t.estrutura }));
    toast({ title: `Template "${t.title}" aplicado!` });
  };

  // Chat with AI (streaming)
  const sendChat = async (msg?: string) => {
    const message = msg || chatInput.trim();
    if (!message || chatLoading) return;
    setChatInput("");
    setChatMsgs(prev => [...prev, { role: "user", content: message }]);
    setChatLoading(true);
    let fullResp = "";
    setChatMsgs(prev => [...prev, { role: "assistant", content: "▋" }]);

    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const response = await fetch(`${base}/api/content-ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, taskContext: aiContext, history: chatMsgs.slice(-10) }),
        credentials: "include",
      });
      if (!response.ok || !response.body) throw new Error("Falha na resposta");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const data = JSON.parse(line.slice(5).trim());
            if (data.content) {
              fullResp += data.content;
              setChatMsgs(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullResp + "▋" };
                return updated;
              });
            }
            if (data.done) {
              setChatMsgs(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullResp };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (e: any) {
      toast({ title: "Erro ao conectar com a IA", variant: "destructive" });
      setChatMsgs(prev => { const u = [...prev]; u[u.length - 1] = { role: "assistant", content: "❌ Erro ao gerar resposta. Tente novamente." }; return u; });
    } finally { setChatLoading(false); }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);

  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  // ── Calendar helpers ──────────────────────────────────────────────────────

  const tasksByDate = useMemo(() => {
    const m: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (!m[t.data]) m[t.data] = [];
      m[t.data].push(t);
    }
    return m;
  }, [tasks]);

  const navLabel = useMemo(() => {
    if (viewMode === "mes") return format(currentDate, "MMMM yyyy", { locale: ptBR });
    if (viewMode === "semana") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(start, "d MMM", { locale: ptBR })} – ${format(end, "d MMM yyyy", { locale: ptBR })}`;
    }
    if (viewMode === "dia") return format(currentDate, "d 'de' MMMM yyyy", { locale: ptBR });
    return format(currentDate, "yyyy");
  }, [viewMode, currentDate]);

  // ── Views ─────────────────────────────────────────────────────────────────

  const MonthView = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: startOfWeek(start, { weekStartsOn: 0 }), end: endOfWeek(end, { weekStartsOn: 0 }) });
    const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return (
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {WEEK_DAYS.map(d => <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: "minmax(90px,1fr)" }}>
          {days.map(day => {
            const key = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate[key] || [];
            const isCurrentMonth = getMonth(day) === getMonth(currentDate);
            const isLate = dayTasks.some(t => !["publicado","cancelado"].includes(t.status));
            return (
              <div key={key}
                className={cn("border-b border-r p-1 min-h-[90px] relative group cursor-pointer",
                  !isCurrentMonth ? "bg-muted/20 opacity-50" : "",
                  isToday(day) ? "bg-primary/5" : "",
                )}>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    isToday(day) ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                    {format(day, "d")}
                  </span>
                  <button className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-primary/10 rounded"
                    onClick={() => openCreate(key)}>
                    <Plus className="h-3 w-3 text-primary" />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map(t => (
                    <TaskCard key={t.id} task={t}
                      onEdit={() => openEdit(t)} onDelete={() => setDeleteId(t.id)}
                      onStatusChange={s => statusMut.mutate({ id: t.id, status: s })}
                      onDuplicate={() => dupMut.mutate({ id: t.id, newDate: key })}
                      onAI={() => openAI(t)}
                      isSelected={selectedIds.has(t.id)} onSelect={() => toggleSelect(t.id)}
                    />
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-[10px] text-muted-foreground pl-1">+{dayTasks.length - 3} mais</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const WeekView = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const hours = Array.from({ length: 12 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);
    return (
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-8 border-b bg-muted/30 sticky top-0 z-10">
          <div className="p-2 text-xs text-muted-foreground" />
          {days.map(d => (
            <div key={d.toString()} className={cn("p-2 text-center", isToday(d) ? "bg-primary/10" : "")}>
              <div className="text-xs text-muted-foreground">{format(d, "EEE", { locale: ptBR })}</div>
              <div className={cn("text-sm font-bold mt-0.5", isToday(d) ? "text-primary" : "")}>{format(d, "d")}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-8">
          <div>
            {hours.map(h => <div key={h} className="h-20 border-b px-1 pt-1 text-[10px] text-muted-foreground">{h}</div>)}
          </div>
          {days.map(day => {
            const key = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate[key] || [];
            return (
              <div key={key} className={cn("border-l", isToday(day) ? "bg-primary/5" : "")}>
                {hours.map(h => {
                  const slotTasks = dayTasks.filter(t => t.hora?.startsWith(h.slice(0, 2)));
                  return (
                    <div key={h} className="h-20 border-b p-0.5 group relative cursor-pointer"
                      onClick={() => openCreate(key)}>
                      {slotTasks.map(t => (
                        <TaskCard key={t.id} task={t}
                          onEdit={() => openEdit(t)} onDelete={() => setDeleteId(t.id)}
                          onStatusChange={s => statusMut.mutate({ id: t.id, status: s })}
                          onDuplicate={() => dupMut.mutate({ id: t.id, newDate: key })}
                          onAI={() => openAI(t)}
                          isSelected={selectedIds.has(t.id)} onSelect={() => toggleSelect(t.id)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const DayView = () => {
    const key = format(currentDate, "yyyy-MM-dd");
    const dayTasks = tasksByDate[key] || [];
    return (
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}</h3>
          <Button size="sm" onClick={() => openCreate(key)} className="gap-1"><Plus className="h-4 w-4" /> Nova Tarefa</Button>
        </div>
        {dayTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Calendar className="h-12 w-12 opacity-10" />
            <p>Nenhuma tarefa neste dia</p>
            <Button variant="outline" size="sm" onClick={() => openCreate(key)}>Criar primeira tarefa</Button>
          </div>
        ) : (
          dayTasks.map(t => (
            <Card key={t.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="shrink-0">
                    <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[t.status])}>{STATUS_LABELS[t.status]}</Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                      <span>{TIPOS_LABELS[t.tipo]}</span>
                      <span>· {CANAL_LABELS[t.canal]}</span>
                      <span>· {OBJ_LABELS[t.objetivo]}</span>
                      <span>· {t.hora}</span>
                      <span className={PRIO_COLORS[t.prioridade]}>· {PRIO_LABELS[t.prioridade]}</span>
                    </div>
                    {t.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.descricao}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAI(t)}><Sparkles className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  };

  const YearView = () => {
    const year = getYear(currentDate);
    return (
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }, (_, mi) => {
            const monthStart = new Date(year, mi, 1);
            const monthStr = format(monthStart, "yyyy-MM");
            const monthTasks = tasks.filter(t => t.data.startsWith(monthStr));
            const daysInMonth = getDaysInMonth(monthStart);
            return (
              <Card key={mi} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => { setCurrentDate(monthStart); setViewMode("mes"); }}>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm capitalize">{format(monthStart, "MMMM", { locale: ptBR })}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="grid grid-cols-7 gap-0.5">
                    {Array.from({ length: daysInMonth }, (_, d) => {
                      const dateStr = `${year}-${String(mi + 1).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`;
                      const hasTasks = !!tasksByDate[dateStr]?.length;
                      return (
                        <div key={d} className={cn("h-3 w-3 rounded-sm", hasTasks ? "bg-primary" : "bg-muted")} title={hasTasks ? `${dateStr}: ${tasksByDate[dateStr].length} tarefa(s)` : ""} />
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{monthTasks.length} tarefa{monthTasks.length !== 1 ? "s" : ""}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  const filteredIdeas = useMemo(() => {
    if (!ideaSearch.trim()) return ideas;
    return ideas.filter(i => i.title.toLowerCase().includes(ideaSearch.toLowerCase()) || (i.tema || "").toLowerCase().includes(ideaSearch.toLowerCase()));
  }, [ideas, ideaSearch]);

  return (
    <div className="flex flex-col h-full space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <LayoutGrid className="h-8 w-8 text-primary" /> Planner de Conteúdo
          </h1>
          <p className="text-muted-foreground mt-1">Planejamento e produção de conteúdo para a clínica</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { window.print(); }}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100" onClick={() => openAI()}>
            <Bot className="h-4 w-4" /> Assistente IA
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => openCreate()}>
            <Plus className="h-4 w-4" /> Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 no-print">
          {[
            { label: "Hoje", value: stats.today, color: "text-primary" },
            { label: "Semana", value: stats.week, color: "text-blue-600" },
            { label: "Mês", value: stats.month, color: "text-teal-600" },
            { label: "Pendentes", value: stats.pendentes, color: "text-gray-600" },
            { label: "Em Criação", value: stats.em_criacao, color: "text-blue-700" },
            { label: "Publicados", value: stats.publicados, color: "text-green-600" },
            { label: "Atrasados", value: stats.atrasados, color: stats.atrasados > 0 ? "text-red-600 font-bold" : "text-gray-400" },
          ].map(s => (
            <Card key={s.label} className="border shadow-none py-0">
              <CardContent className="p-2 text-center">
                <div className={cn("text-xl font-bold", s.color)}>{s.value || 0}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col no-print">
        <TabsList className="grid w-full sm:w-auto grid-cols-4">
          <TabsTrigger value="calendario" className="gap-1.5"><Calendar className="h-3.5 w-3.5" /> Calendário</TabsTrigger>
          <TabsTrigger value="ideias" className="gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> Banco de Ideias</TabsTrigger>
          <TabsTrigger value="modelos" className="gap-1.5"><BookTemplate className="h-3.5 w-3.5" /> Modelos</TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Dashboard</TabsTrigger>
        </TabsList>

        {/* ── CALENDÁRIO ──────────────────────────────────────────────────── */}
        <TabsContent value="calendario" className="flex-1 flex flex-col mt-4">
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {/* View mode */}
            <div className="flex rounded-lg border overflow-hidden">
              {(["dia","semana","mes","ano"] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={cn("px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                    viewMode === v ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
              <span className="text-sm font-medium capitalize ml-2">{navLabel}</span>
            </div>

            <div className="flex-1" />

            {/* Filters & bulk actions */}
            {selectedIds.size > 0 && (
              <Button variant="destructive" size="sm" className="gap-1 h-8" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Excluir {selectedIds.size} selecionadas
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1 h-8" onClick={() => setShowFilters(f => !f)}>
              <Filter className="h-3.5 w-3.5" /> Filtros {showFilters ? "▲" : "▼"}
            </Button>
          </div>

          {/* Filters row */}
          {showFilters && (
            <div className="flex flex-wrap gap-2 mb-3 p-3 bg-muted/30 rounded-lg border">
              {[
                { key: "status", label: "Status", options: STATUSES.map(s => ({ v: s, l: STATUS_LABELS[s] })) },
                { key: "tipo", label: "Tipo", options: TIPOS.map(t => ({ v: t, l: TIPOS_LABELS[t] })) },
                { key: "canal", label: "Canal", options: CANAIS.map(c => ({ v: c, l: CANAL_LABELS[c] })) },
                { key: "prioridade", label: "Prioridade", options: PRIORIDADES.map(p => ({ v: p, l: PRIO_LABELS[p] })) },
              ].map(f => (
                <Select key={f.key} value={(filters as any)[f.key]} onValueChange={v => setFilters(prev => ({ ...prev, [f.key]: v }))}>
                  <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder={f.label} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {f.options.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              ))}
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setFilters({ status: "all", tipo: "all", canal: "all", prioridade: "all" })}>
                <X className="h-3 w-3 mr-1" /> Limpar
              </Button>
            </div>
          )}

          {/* Calendar views */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Carregando...
            </div>
          ) : (
            <div className="flex-1 border rounded-lg overflow-hidden bg-background flex flex-col">
              {viewMode === "mes" && <MonthView />}
              {viewMode === "semana" && <WeekView />}
              {viewMode === "dia" && <DayView />}
              {viewMode === "ano" && <YearView />}
            </div>
          )}
        </TabsContent>

        {/* ── BANCO DE IDEIAS ─────────────────────────────────────────────── */}
        <TabsContent value="ideias" className="mt-4">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar ideias..." value={ideaSearch} onChange={e => setIdeaSearch(e.target.value)} />
            </div>
            <Button onClick={() => setIdeaOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Nova Ideia</Button>
          </div>

          {filteredIdeas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Lightbulb className="h-16 w-16 opacity-10" />
              <p className="font-medium">Nenhuma ideia salva ainda</p>
              <Button variant="outline" onClick={() => setIdeaOpen(true)}>Adicionar primeira ideia</Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredIdeas.map(idea => (
                <Card key={idea.id} className={cn("border", idea.convertida ? "opacity-60" : "")}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm">{idea.title}</h3>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {idea.tema && <Badge variant="outline" className="text-xs">{idea.tema}</Badge>}
                          {idea.objetivo && <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">{OBJ_LABELS[idea.objetivo] || idea.objetivo}</Badge>}
                          {idea.canal && <Badge variant="outline" className="text-xs">{CANAL_LABELS[idea.canal] || idea.canal}</Badge>}
                          {idea.convertida && <Badge className="text-xs bg-green-100 text-green-800">Convertida</Badge>}
                        </div>
                        {idea.observacao && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{idea.observacao}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteIdeaMut.mutate(idea.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {!idea.convertida && (
                      <Button variant="outline" size="sm" className="w-full mt-3 gap-1.5 text-xs"
                        onClick={() => ideaToTaskMut.mutate({ id: idea.id, data: { data: format(new Date(), "yyyy-MM-dd") } })}>
                        <ArrowRight className="h-3.5 w-3.5" /> Transformar em Tarefa
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── MODELOS ────────────────────────────────────────────────────── */}
        <TabsContent value="modelos" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {TEMPLATES.map(tmpl => (
              <Card key={tmpl.id} className="border hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{TIPOS_LABELS[tmpl.tipo]}</Badge>
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">{OBJ_LABELS[tmpl.objetivo]}</Badge>
                  </div>
                  <CardTitle className="text-sm mt-2">{tmpl.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground mb-3">{tmpl.descricao}</p>
                  <div className="text-xs bg-muted/50 p-2 rounded font-mono whitespace-pre-line text-muted-foreground leading-relaxed">
                    {tmpl.estrutura}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="flex-1 gap-1 text-xs" onClick={() => {
                      openCreate(); setTimeout(() => applyTemplate(tmpl), 100);
                    }}>
                      <Plus className="h-3 w-3" /> Usar template
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => {
                      openAI();
                      setTimeout(() => sendChat(`Crie um conteúdo usando o template: ${tmpl.title}\nTipo: ${TIPOS_LABELS[tmpl.tipo]}\nObjetivo: ${OBJ_LABELS[tmpl.objetivo]}\nEstrutura:\n${tmpl.estrutura}`), 300);
                    }}>
                      <Sparkles className="h-3 w-3" /> IA
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Status distribution */}
            <Card className="col-span-full sm:col-span-2">
              <CardHeader><CardTitle className="text-base">Distribuição por Status</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {STATUSES.map(s => {
                    const count = tasks.filter(t => t.status === s).length;
                    const pct = tasks.length ? Math.round((count / tasks.length) * 100) : 0;
                    return (
                      <div key={s} className="flex items-center gap-3">
                        <span className="text-xs w-24 shrink-0">{STATUS_LABELS[s]}</span>
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div className={cn("h-2 rounded-full", STATUS_COLORS[s]?.split(" ")[0] || "bg-gray-300")} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-medium w-8 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Canal distribution */}
            <Card>
              <CardHeader><CardTitle className="text-base">Por Canal</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {CANAIS.map(c => {
                    const count = tasks.filter(t => t.canal === c).length;
                    if (!count) return null;
                    return (
                      <div key={c} className="flex items-center justify-between">
                        <span className="text-xs">{CANAL_LABELS[c]}</span>
                        <Badge variant="outline" className="text-xs">{count}</Badge>
                      </div>
                    );
                  })}
                  {!tasks.length && <p className="text-xs text-muted-foreground">Nenhuma tarefa no período</p>}
                </div>
              </CardContent>
            </Card>

            {/* Tipo distribution */}
            <Card>
              <CardHeader><CardTitle className="text-base">Por Tipo</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {TIPOS.map(t => {
                    const count = tasks.filter(task => task.tipo === t).length;
                    if (!count) return null;
                    return (
                      <div key={t} className="flex items-center justify-between">
                        <span className="text-xs">{TIPOS_LABELS[t]}</span>
                        <Badge variant="outline" className="text-xs">{count}</Badge>
                      </div>
                    );
                  })}
                  {!tasks.length && <p className="text-xs text-muted-foreground">Nenhuma tarefa no período</p>}
                </div>
              </CardContent>
            </Card>

            {/* Objetivo distribution */}
            <Card>
              <CardHeader><CardTitle className="text-base">Por Objetivo</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {OBJETIVOS.map(o => {
                    const count = tasks.filter(t => t.objetivo === o).length;
                    if (!count) return null;
                    return (
                      <div key={o} className="flex items-center justify-between">
                        <span className="text-xs">{OBJ_LABELS[o]}</span>
                        <Badge variant="outline" className="text-xs">{count}</Badge>
                      </div>
                    );
                  })}
                  {!tasks.length && <p className="text-xs text-muted-foreground">Nenhuma tarefa no período</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Task Form Dialog ───────────────────────────────────────────────── */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditing ? <Edit2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {isEditing ? "Editar Tarefa" : "Nova Tarefa de Conteúdo"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            {/* Title */}
            <div className="col-span-full">
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Título *</Label>
              <Input placeholder="Ex: Post sobre dor lombar" value={editTask.title || ""}
                onChange={e => setEditTask(p => ({ ...p, title: e.target.value }))} />
            </div>

            {/* Tipo + Objetivo */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo de Conteúdo</Label>
              <Select value={editTask.tipo || "post_estatico"} onValueChange={v => setEditTask(p => ({ ...p, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{TIPOS_LABELS[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Objetivo</Label>
              <Select value={editTask.objetivo || "engajamento"} onValueChange={v => setEditTask(p => ({ ...p, objetivo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OBJETIVOS.map(o => <SelectItem key={o} value={o}>{OBJ_LABELS[o]}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Data + Hora */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Data *</Label>
              <Input type="date" value={editTask.data || ""} onChange={e => setEditTask(p => ({ ...p, data: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Hora</Label>
              <Input type="time" value={editTask.hora || "09:00"} onChange={e => setEditTask(p => ({ ...p, hora: e.target.value }))} />
            </div>

            {/* Status + Prioridade */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</Label>
              <Select value={editTask.status || "pendente"} onValueChange={v => setEditTask(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Prioridade</Label>
              <Select value={editTask.prioridade || "media"} onValueChange={v => setEditTask(p => ({ ...p, prioridade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p} value={p}>{PRIO_LABELS[p]}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Canal + Responsável */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Canal</Label>
              <Select value={editTask.canal || "instagram"} onValueChange={v => setEditTask(p => ({ ...p, canal: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CANAIS.map(c => <SelectItem key={c} value={c}>{CANAL_LABELS[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Responsável</Label>
              <Input placeholder="Nome do responsável" value={editTask.responsavel || ""} onChange={e => setEditTask(p => ({ ...p, responsavel: e.target.value }))} />
            </div>

            {/* Tema + Público-alvo */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tema</Label>
              <Input placeholder="Ex: Dor lombar, Gestantes, Lesões esportivas" value={editTask.tema || ""} onChange={e => setEditTask(p => ({ ...p, tema: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Público-alvo</Label>
              <Input placeholder="Ex: Mulheres 30-50 anos" value={editTask.publico_alvo || ""} onChange={e => setEditTask(p => ({ ...p, publico_alvo: e.target.value }))} />
            </div>

            {/* CTA + Descrição */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">CTA (chamada para ação)</Label>
              <Input placeholder="Ex: Agende sua avaliação gratuita!" value={editTask.cta || ""} onChange={e => setEditTask(p => ({ ...p, cta: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Hashtags</Label>
              <Input placeholder="Ex: #fisioterapia #saude #vitafisio" value={editTask.hashtags || ""} onChange={e => setEditTask(p => ({ ...p, hashtags: e.target.value }))} />
            </div>

            {/* Briefing */}
            <div className="col-span-full">
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Briefing / Descrição</Label>
              <Textarea rows={3} placeholder="Descreva o conteúdo, referências, dados importantes..." value={editTask.descricao || ""} onChange={e => setEditTask(p => ({ ...p, descricao: e.target.value }))} />
            </div>

            {/* Legenda gerada */}
            <div className="col-span-full">
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Legenda</Label>
              <div className="flex gap-2">
                <Textarea rows={3} placeholder="Legenda pronta para publicar..." value={editTask.legenda || ""} onChange={e => setEditTask(p => ({ ...p, legenda: e.target.value }))} className="flex-1" />
                <Button variant="outline" size="sm" className="shrink-0 h-auto flex flex-col gap-1 px-2 py-2"
                  onClick={() => { openAI(editTask as Task); setTimeout(() => sendChat(`Gere uma legenda para Instagram para a tarefa "${editTask.title}" com objetivo de ${OBJ_LABELS[editTask.objetivo || "engajamento"]}. Tema: ${editTask.tema || "fisioterapia"}`), 300); }}>
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="text-[10px]">IA</span>
                </Button>
              </div>
            </div>

            {/* Roteiro */}
            <div className="col-span-full">
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Roteiro</Label>
              <Textarea rows={3} placeholder="Roteiro do vídeo ou estrutura do conteúdo..." value={editTask.roteiro || ""} onChange={e => setEditTask(p => ({ ...p, roteiro: e.target.value }))} />
            </div>

            {/* Ideia Visual + Observações */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Ideia Visual</Label>
              <Textarea rows={2} placeholder="Descrição da imagem, cenário, cores..." value={editTask.ideia_visual || ""} onChange={e => setEditTask(p => ({ ...p, ideia_visual: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Observações Estratégicas</Label>
              <Textarea rows={2} placeholder="Notas para a equipe de marketing..." value={editTask.obs_estrategicas || ""} onChange={e => setEditTask(p => ({ ...p, obs_estrategicas: e.target.value }))} />
            </div>

            <div className="col-span-full">
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Observações gerais</Label>
              <Textarea rows={2} placeholder="Observações adicionais..." value={editTask.observacoes || ""} onChange={e => setEditTask(p => ({ ...p, observacoes: e.target.value }))} />
            </div>
          </div>

          <div className="flex gap-2 mt-4 border-t pt-4">
            <Button onClick={handleSaveTask} disabled={createMut.isPending || updateMut.isPending} className="flex-1 gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {createMut.isPending || updateMut.isPending ? "Salvando..." : isEditing ? "Atualizar Tarefa" : "Criar Tarefa"}
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => { openAI(editTask as Task); }}>
              <Sparkles className="h-4 w-4 text-purple-500" /> Gerar com IA
            </Button>
            <Button variant="ghost" onClick={() => setTaskOpen(false)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── New Idea Dialog ──────────────────────────────────────────────── */}
      <Dialog open={ideaOpen} onOpenChange={setIdeaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-yellow-500" /> Nova Ideia de Conteúdo</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Título *</Label>
              <Input placeholder="Título da ideia" value={newIdea.title} onChange={e => setNewIdea(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Tema</Label>
                <Input placeholder="Ex: Dor nas costas" value={newIdea.tema} onChange={e => setNewIdea(p => ({ ...p, tema: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Objetivo</Label>
                <Select value={newIdea.objetivo} onValueChange={v => setNewIdea(p => ({ ...p, objetivo: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{OBJETIVOS.map(o => <SelectItem key={o} value={o}>{OBJ_LABELS[o]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Canal</Label>
              <Select value={newIdea.canal} onValueChange={v => setNewIdea(p => ({ ...p, canal: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{CANAIS.map(c => <SelectItem key={c} value={c}>{CANAL_LABELS[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Observação</Label>
              <Textarea rows={2} placeholder="Detalhes, referências, inspirações..." value={newIdea.observacao} onChange={e => setNewIdea(p => ({ ...p, observacao: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => { if (!newIdea.title) { toast({ title: "Título é obrigatório", variant: "destructive" }); return; } createIdeaMut.mutate(newIdea); }}>Salvar Ideia</Button>
              <Button variant="ghost" onClick={() => setIdeaOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. A tarefa será removida permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white" onClick={() => deleteId && deleteMut.mutate(deleteId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk delete confirmation ─────────────────────────────────────── */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} tarefas?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. Todas as tarefas selecionadas serão removidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white" onClick={() => bulkDeleteMut.mutate(Array.from(selectedIds))}>Excluir todas</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── AI Chat Drawer ─────────────────────────────────────────────────── */}
      {aiOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-background border-l shadow-2xl flex flex-col">
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <div>
                <h3 className="font-semibold text-sm">Assistente IA de Conteúdo</h3>
                <p className="text-[10px] text-purple-200">Powered by Replit AI Integrations (OpenAI)</p>
              </div>
            </div>
            <button onClick={() => setAiOpen(false)} className="hover:bg-white/20 rounded p-1"><X className="h-4 w-4" /></button>
          </div>

          {aiContext && (
            <div className="px-3 py-2 bg-purple-50 border-b text-xs text-purple-700">
              <strong>Contexto:</strong> {aiContext.split("\n")[0]}
            </div>
          )}

          {/* Quick prompts */}
          <div className="p-3 border-b">
            <p className="text-xs font-medium text-muted-foreground mb-2">Prompts rápidos:</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map(p => (
                <button key={p} onClick={() => sendChat(p)}
                  className="text-[10px] px-2 py-1 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors border border-purple-200">
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {chatMsgs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                <Sparkles className="h-10 w-10 opacity-20" />
                <p className="text-sm text-center">Olá! Sou seu assistente de conteúdo.<br />Como posso ajudar hoje?</p>
              </div>
            ) : (
              <div className="space-y-4">
                {chatMsgs.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-purple-600 text-white rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm border"
                    )}>
                      {m.content}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t">
            <div className="flex gap-2">
              <Textarea
                rows={2}
                placeholder="Digite sua mensagem ou use um prompt rápido acima..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                className="resize-none flex-1 text-sm"
              />
              <Button size="icon" className="h-auto bg-purple-600 hover:bg-purple-700 shrink-0"
                disabled={!chatInput.trim() || chatLoading}
                onClick={() => sendChat()}>
                {chatLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Enter para enviar · Shift+Enter para nova linha</p>
          </div>
        </div>
      )}
    </div>
  );
}
