import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  MessageCircle, Phone, CheckCircle2, AlertTriangle, Clock, Calendar, UserRound,
  RefreshCw, TrendingDown, Users, X, BarChart2, Zap, ChevronDown, ChevronUp, Send, AlarmClock,
  Loader2, Wifi, WifiOff, Settings, Save, Eye, RotateCcw
} from "lucide-react";
import { PrintButton } from "@/components/print/PrintButton";
import { PrintHeader } from "@/components/print/PrintHeader";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAppName } from "@/contexts/AppSettingsContext";

type Appointment = {
  id: number; patientId: number; therapistId: number; date: string; time: string;
  status: string; notes?: string | null; patientName: string; patientPhone: string;
  therapistName: string; therapistSpecialty: string;
};

type Contact = {
  id: number; appointmentId: number; type: string; content: string | null;
  performedBy: string | null; createdAt: string;
};

type PatientHistory = { id: number; status: string; date: string };
type EligiblePatient = { id: number; name: string; phone: string; remainingSessions: number };
type EncaixeOpps = {
  freeSlots: Array<{ date: string; time: string }>;
  eligiblePatients: EligiblePatient[];
  requestingReschedule: Appointment[];
};

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado", mensagem_enviada: "Msg. Enviada",
  aguardando_confirmacao: "Ag. Confirmação", confirmado: "Confirmado",
  confirmado_recepcao: "Conf. Recepção", solicitou_remarcacao: "Sol. Remarcação",
  nao_respondeu: "Não Respondeu", presente: "Presente", falta: "Falta",
  cancelado: "Cancelado", remarcado: "Remarcado", encaixe: "Encaixe", encaixe_preenchido: "Encaixe Preen.",
};

const STATUS_COLORS: Record<string, string> = {
  agendado: "bg-blue-100 text-blue-800 border-blue-200",
  mensagem_enviada: "bg-sky-100 text-sky-800 border-sky-200",
  aguardando_confirmacao: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmado: "bg-teal-100 text-teal-800 border-teal-200",
  confirmado_recepcao: "bg-cyan-100 text-cyan-800 border-cyan-200",
  solicitou_remarcacao: "bg-red-100 text-red-800 border-red-200",
  nao_respondeu: "bg-gray-100 text-gray-700 border-gray-300",
  presente: "bg-green-100 text-green-800 border-green-200",
  falta: "bg-orange-100 text-orange-800 border-orange-200",
  cancelado: "bg-slate-100 text-slate-700 border-slate-300",
  remarcado: "bg-purple-100 text-purple-800 border-purple-200",
  encaixe: "bg-amber-100 text-amber-800 border-amber-200",
  encaixe_preenchido: "bg-violet-100 text-violet-800 border-violet-200",
};

const fmtDate = (s: string) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const fmtPhone = (p: string) => p.replace(/\D/g, "");
const todayStr = () => new Date().toISOString().split("T")[0];
const tomorrowStr = () => new Date(Date.now() + 86400000).toISOString().split("T")[0];

function buildWhatsApp24h(phone: string, name: string, date: string, time: string, therapist: string, clinic = "VitalFisio") {
  const d = fmtDate(date);
  const msg = `Olá, ${name}! Aqui é da clínica ${clinic}. Sua sessão está agendada para ${d} às ${time} com ${therapist}.\n\nPara facilitar seu atendimento, responda:\n1 - Confirmar presença\n2 - Remarcar horário`;
  return `https://wa.me/55${fmtPhone(phone)}?text=${encodeURIComponent(msg)}`;
}

function buildWhatsApp12h(phone: string, name: string, date: string, time: string) {
  const d = fmtDate(date);
  const msg = `Olá, ${name}! Não identificamos sua confirmação para a sessão de ${d} às ${time}. Responda:\n1 - Confirmar presença\n2 - Remarcar horário`;
  return `https://wa.me/55${fmtPhone(phone)}?text=${encodeURIComponent(msg)}`;
}

function buildWhatsAppEncaixe(phone: string, name: string, date: string, time: string, clinic = "VitalFisio") {
  const d = fmtDate(date);
  const msg = `Olá, ${name}! Surgiu um horário disponível na clínica ${clinic} para ${d} às ${time}. Caso tenha interesse, responda esta mensagem para agendarmos.`;
  return `https://wa.me/55${fmtPhone(phone)}?text=${encodeURIComponent(msg)}`;
}

function usePatientRisk(patientId: number) {
  const { data: history = [] } = useQuery<PatientHistory[]>({
    queryKey: ["patient-history", patientId],
    queryFn: () => apiFetch(`/api/patients/${patientId}/history`),
    staleTime: 120000,
  });
  return useMemo(() => {
    const faltas = history.filter(h => h.status === "falta").length;
    const cancelados = history.filter(h => h.status === "cancelado").length;
    const total = history.length;
    if (total === 0) return "baixo" as const;
    const bad = faltas + cancelados;
    const rate = bad / total;
    if (faltas >= 3 || rate >= 0.4) return "alto" as const;
    if (faltas >= 1 || rate >= 0.2) return "medio" as const;
    return "baixo" as const;
  }, [history]);
}

function RiskBadge({ risk }: { risk: "baixo" | "medio" | "alto" }) {
  if (risk === "alto") return <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">⚠ Alto Risco</Badge>;
  if (risk === "medio") return <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">⚡ Risco Médio</Badge>;
  return <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">✓ Baixo Risco</Badge>;
}

function useStatusMutation(queryKeys: string[][]) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, status, performedBy }: { id: number; status: string; performedBy?: string }) =>
      apiFetch(`/api/appointments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, performedBy: performedBy || "recepcao" }) }),
    onSuccess: () => {
      queryKeys.forEach(k => queryClient.invalidateQueries({ queryKey: k }));
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao atualizar status", variant: "destructive" }),
  });
}

function useContactMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, type, content, performedBy }: { id: number; type: string; content?: string; performedBy?: string }) =>
      apiFetch(`/api/appointments/${id}/contacts`, { method: "POST", body: JSON.stringify({ type, content, performedBy: performedBy || "recepcao" }) }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["contacts", vars.id] });
    },
  });
}

function ContactHistory({ appointmentId }: { appointmentId: number }) {
  const [expanded, setExpanded] = useState(false);
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["contacts", appointmentId],
    queryFn: () => apiFetch(`/api/appointments/${appointmentId}/contacts`),
    enabled: expanded,
  });
  const typeLabels: Record<string, string> = {
    status_change: "Mudança de status", whatsapp_24h: "WhatsApp (24h)", whatsapp_12h: "WhatsApp (12h)",
    manual: "Contato manual", observacao: "Observação", encaixe: "Encaixe",
  };
  return (
    <div className="mt-2">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Histórico de contatos {contacts.length > 0 && `(${contacts.length})`}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1 pl-2 border-l-2 border-muted">
          {contacts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sem registros ainda</p>
          ) : contacts.map(c => (
            <div key={c.id} className="text-xs">
              <span className="text-muted-foreground">{format(new Date(c.createdAt), "dd/MM HH:mm")}</span>
              {" · "}
              <span className="font-medium">{typeLabels[c.type] || c.type}</span>
              {c.content && <span className="text-muted-foreground"> — {c.content}</span>}
              {c.performedBy && c.performedBy !== "sistema" && <span className="text-muted-foreground/60"> ({c.performedBy})</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type ObsDialogState = { open: boolean; appointmentId: number | null; patientName: string };

function useZapiSend() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, second }: { id: number; second?: boolean }) =>
      apiFetch<{ success: boolean; token: string; confirmLink: string; whatsappSent: boolean; whatsappError?: string }>(
        `/api/whatsapp/send/${id}`, { method: "POST", body: JSON.stringify({ second: !!second, performedBy: "recepcao" }) }
      ),
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["appointments-upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["contacts", vars.id] });
      if (data.whatsappSent) {
        toast({ title: "✅ Mensagem enviada via WhatsApp!" });
      } else {
        toast({
          title: "Link gerado, mas envio automático falhou",
          description: data.whatsappError || "Verifique a conexão Z-API",
          variant: "destructive",
        });
      }
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao enviar", variant: "destructive" }),
  });
}

function AppointmentCard({ apt, onAction, isPending }: {
  apt: Appointment;
  onAction: (action: string, apt: Appointment) => void;
  isPending: boolean;
}) {
  const risk = usePatientRisk(apt.patientId);
  const isToday = apt.date === todayStr();
  const isTomorrow = apt.date === tomorrowStr();
  const zapiSend = useZapiSend();
  const isSending = zapiSend.isPending;

  return (
    <div className={`p-4 rounded-lg border transition-colors ${risk === "alto" ? "border-red-200 bg-red-50/20" : risk === "medio" ? "border-orange-200 bg-orange-50/10" : "border-border bg-background"}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm">{apt.patientName}</span>
            <RiskBadge risk={risk} />
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${STATUS_COLORS[apt.status] || "bg-gray-100 text-gray-600 border-gray-300"}`}>
              {STATUS_LABELS[apt.status] || apt.status}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {isToday ? <strong className="text-primary">Hoje</strong> : isTomorrow ? <strong className="text-orange-600">Amanhã</strong> : fmtDate(apt.date)} às {apt.time}
            </span>
            <span className="flex items-center gap-1"><UserRound className="h-3 w-3" /> {apt.therapistName}</span>
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {apt.patientPhone}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-green-500 hover:bg-green-600 text-white"
            disabled={isSending}
            onClick={() => zapiSend.mutate({ id: apt.id, second: false })}
          >
            {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
            {isSending ? "Enviando..." : "WhatsApp"}
          </Button>
          {(apt.status === "mensagem_enviada" || apt.status === "aguardando_confirmacao") && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 text-amber-700 bg-amber-100 hover:bg-amber-200 border-amber-200"
              disabled={isSending}
              onClick={() => zapiSend.mutate({ id: apt.id, second: true })}
            >
              {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlarmClock className="h-3 w-3" />}
              2ª Tentativa
            </Button>
          )}
          <a href={`tel:${fmtPhone(apt.patientPhone)}`}
            className="flex items-center gap-1 text-xs border border-border bg-background hover:bg-muted px-2.5 py-1.5 rounded-md transition-colors">
            <Phone className="h-3 w-3" /> Ligar
          </a>
          {!["confirmado","confirmado_recepcao","presente"].includes(apt.status) && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-teal-700 border-teal-300 hover:bg-teal-50"
              onClick={() => onAction("confirmar_recepcao", apt)} disabled={isPending}>
              <CheckCircle2 className="h-3 w-3" /> Confirmar
            </Button>
          )}
          {!["nao_respondeu","confirmado","confirmado_recepcao","presente","cancelado"].includes(apt.status) && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-gray-600 border-gray-300 hover:bg-gray-50"
              onClick={() => onAction("nao_respondeu", apt)} disabled={isPending}>
              Não respondeu
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground"
            onClick={() => onAction("observacao", apt)}>
            Obs.
          </Button>
        </div>
      </div>
      <ContactHistory appointmentId={apt.id} />
    </div>
  );
}

function DaySection({ label, apts, onAction, isPending, isUrgent }: {
  label: string; apts: Appointment[]; onAction: (action: string, apt: Appointment) => void; isPending: boolean; isUrgent?: boolean;
}) {
  if (apts.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 ${isUrgent ? "text-orange-600" : "text-foreground"}`}>
        <h3 className="font-semibold text-sm uppercase tracking-wide">{label}</h3>
        <Badge variant="outline" className={`text-xs ${isUrgent ? "border-orange-300 text-orange-600" : ""}`}>{apts.length}</Badge>
      </div>
      <div className="space-y-2">
        {apts.map(apt => <AppointmentCard key={apt.id} apt={apt} onAction={onAction} isPending={isPending} />)}
      </div>
    </div>
  );
}

type WaSettings = {
  clinic_name: string;
  message_template_1: string;
  message_template_2: string;
  message_encaixe: string;
  auto_send_enabled: boolean;
  auto_send_time: string;
};

const DEFAULT_TEMPLATE_1 = `Olá, {nome}! 👋

Sua sessão de fisioterapia está marcada para *{data}* às *{hora}* com *{terapeuta}*.

Por favor, confirme ou cancele sua presença neste link:
{link}

Obrigado! — {clinica}`;

const DEFAULT_TEMPLATE_2 = `⚠️ *Lembrete importante*, {nome}!

Ainda não recebemos sua confirmação para a sessão de *{data}* às *{hora}* com *{terapeuta}*.

Sua vaga pode ser liberada se não confirmar. Por favor, confirme agora:
{link}

— {clinica}`;

const DEFAULT_ENCAIXE = `Olá, {nome}! Surgiu um horário disponível na clínica {clinica} para *{data}* às *{hora}*. Caso tenha interesse, responda esta mensagem para agendarmos.`;

export default function Confirmacoes() {
  const { toast } = useToast();
  const appName = useAppName();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(3);
  const [obsDialog, setObsDialog] = useState<ObsDialogState>({ open: false, appointmentId: null, patientName: "" });
  const [obsText, setObsText] = useState("");
  const [waForm, setWaForm] = useState<WaSettings | null>(null);
  const [previewField, setPreviewField] = useState<"template1" | "template2" | "encaixe" | null>(null);

  const zapiStatusQuery = useQuery<{ connected: boolean; error?: string }>({
    queryKey: ["zapi-status"],
    queryFn: () => apiFetch("/api/whatsapp/status"),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const waSettingsQuery = useQuery<WaSettings>({
    queryKey: ["wa-settings"],
    queryFn: () => apiFetch("/api/whatsapp/settings"),
    staleTime: 60000,
  });

  const waSettingsMut = useMutation({
    mutationFn: (data: WaSettings) => apiFetch("/api/whatsapp/settings", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-settings"] });
      toast({ title: "Configurações salvas com sucesso!" });
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao salvar", variant: "destructive" }),
  });

  const upcomingQuery = useQuery<Appointment[]>({
    queryKey: ["appointments-upcoming", days],
    queryFn: () => apiFetch(`/api/appointments/upcoming?days=${days}`),
    refetchInterval: 30000,
  });
  const upcoming = upcomingQuery.data ?? [];

  const encaixeQuery = useQuery<EncaixeOpps>({
    queryKey: ["encaixe-opp"],
    queryFn: () => apiFetch("/api/appointments/encaixe-opportunities"),
    refetchInterval: 60000,
  });
  const encaixeOpp = encaixeQuery.data;

  const QUERY_KEYS = [["appointments-upcoming", days], ["appointments-upcoming"], ["encaixe-opp"]];

  const statusMut = useStatusMutation(QUERY_KEYS);
  const contactMut = useContactMutation();

  const today = todayStr();
  const tomorrow = tomorrowStr();
  const todayApts = upcoming.filter(a => a.date === today);
  const tomorrowApts = upcoming.filter(a => a.date === tomorrow);
  const otherApts = upcoming.filter(a => a.date !== today && a.date !== tomorrow);

  const pendentes = upcoming.filter(a => !["confirmado","confirmado_recepcao","presente"].includes(a.status));
  const confirmados = upcoming.filter(a => ["confirmado","confirmado_recepcao"].includes(a.status));
  const aguardando = upcoming.filter(a => ["agendado","mensagem_enviada","aguardando_confirmacao"].includes(a.status));
  const semResposta = upcoming.filter(a => a.status === "nao_respondeu");
  const solicitouRemarcar = upcoming.filter(a => a.status === "solicitou_remarcacao");
  const taxaConfirmacao = upcoming.length ? Math.round(confirmados.length / upcoming.length * 100) : 0;

  const handleAction = (action: string, apt: Appointment) => {
    if (action === "confirmar_recepcao") {
      statusMut.mutate({ id: apt.id, status: "confirmado_recepcao" }, {
        onSuccess: () => toast({ title: `${apt.patientName} confirmado pela recepção` }),
      });
    } else if (action === "nao_respondeu") {
      statusMut.mutate({ id: apt.id, status: "nao_respondeu" }, {
        onSuccess: () => toast({ title: `${apt.patientName} marcado como não respondeu` }),
      });
    } else if (action === "whatsapp_24h") {
      Promise.all([
        statusMut.mutateAsync({ id: apt.id, status: "mensagem_enviada" }),
        contactMut.mutateAsync({ id: apt.id, type: "whatsapp_24h", content: "Mensagem de confirmação enviada (24h antes)" }),
      ]).catch(() => {});
    } else if (action === "whatsapp_12h") {
      contactMut.mutate({ id: apt.id, type: "whatsapp_12h", content: "Segunda tentativa de confirmação enviada (12h antes)" });
    } else if (action === "observacao") {
      setObsDialog({ open: true, appointmentId: apt.id, patientName: apt.patientName });
      setObsText("");
    }
  };

  const saveObservation = () => {
    if (!obsDialog.appointmentId || !obsText.trim()) return;
    contactMut.mutate({ id: obsDialog.appointmentId, type: "observacao", content: obsText.trim() }, {
      onSuccess: () => {
        toast({ title: "Observação registrada" });
        setObsDialog({ open: false, appointmentId: null, patientName: "" });
        setObsText("");
      },
    });
  };

  const stats = [
    { label: "Total no período", value: upcoming.length, icon: Users, color: "text-foreground" },
    { label: "Confirmados", value: confirmados.length, icon: CheckCircle2, color: "text-teal-600" },
    { label: "Aguardando", value: aguardando.length, icon: Clock, color: "text-yellow-600" },
    { label: "Taxa de confirmação", value: `${taxaConfirmacao}%`, icon: TrendingDown, color: taxaConfirmacao >= 70 ? "text-teal-600" : "text-orange-600" },
  ];

  const FunilContent = () => (
    <div className="space-y-4">
      {upcomingQuery.isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : upcoming.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="h-14 w-14 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">Nenhuma sessão nos próximos {days} dia(s)</p>
        </div>
      ) : (
        <div className="space-y-6">
          <DaySection label="Hoje" apts={todayApts} onAction={handleAction} isPending={statusMut.isPending} isUrgent />
          <DaySection label="Amanhã" apts={tomorrowApts} onAction={handleAction} isPending={statusMut.isPending} isUrgent />
          {[...new Set(otherApts.map(a => a.date))].sort().map(date => (
            <DaySection key={date}
              label={format(new Date(date + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              apts={otherApts.filter(a => a.date === date)}
              onAction={handleAction} isPending={statusMut.isPending} />
          ))}
        </div>
      )}
    </div>
  );

  const AlertasContent = () => {
    const groups = [
      { title: "Solicitaram Remarcação", icon: AlertTriangle, color: "text-red-600 border-red-200 bg-red-50/30", apts: solicitouRemarcar, badge: "bg-red-100 text-red-700 border-red-200" },
      { title: "Não Responderam", icon: Clock, color: "text-gray-600 border-gray-200 bg-gray-50/30", apts: semResposta, badge: "bg-gray-100 text-gray-700 border-gray-300" },
      { title: "Aguardando Confirmação", icon: Send, color: "text-yellow-700 border-yellow-200 bg-yellow-50/20", apts: aguardando, badge: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    ];
    return (
      <div className="space-y-5">
        {groups.map(g => g.apts.length > 0 && (
          <Card key={g.title} className={`border ${g.color}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <g.icon className="h-4 w-4" />
                {g.title}
                <Badge variant="outline" className={`text-xs ml-1 ${g.badge}`}>{g.apts.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {g.apts.map(apt => <AppointmentCard key={apt.id} apt={apt} onAction={handleAction} isPending={statusMut.isPending} />)}
              </div>
            </CardContent>
          </Card>
        ))}
        {solicitouRemarcar.length === 0 && semResposta.length === 0 && aguardando.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <CheckCircle2 className="h-14 w-14 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium">Nenhum alerta ativo para os próximos {days} dias</p>
          </div>
        )}
      </div>
    );
  };

  const EncaixesContent = () => {
    if (encaixeQuery.isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>;
    const { freeSlots = [], eligiblePatients = [], requestingReschedule = [] } = encaixeOpp ?? {};
    const todaySlots = freeSlots.filter(s => s.date === today);
    const tomorrowSlots = freeSlots.filter(s => s.date === tomorrow);
    return (
      <div className="space-y-6">
        {/* Free slots */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-violet-600" /> Horários Vagos
          </h3>
          {todaySlots.length > 0 && (
            <div>
              <p className="text-xs font-medium text-orange-600 mb-2">Hoje — {fmtDate(today)}</p>
              <div className="flex flex-wrap gap-2">
                {todaySlots.map(s => (
                  <span key={s.time} className="text-xs px-3 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 font-medium">{s.time}</span>
                ))}
              </div>
            </div>
          )}
          {tomorrowSlots.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Amanhã — {fmtDate(tomorrow)}</p>
              <div className="flex flex-wrap gap-2">
                {tomorrowSlots.map(s => (
                  <span key={s.time} className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted text-muted-foreground font-medium">{s.time}</span>
                ))}
              </div>
            </div>
          )}
          {freeSlots.length === 0 && <p className="text-sm text-muted-foreground">Agenda cheia! Nenhum horário vago hoje ou amanhã.</p>}
        </div>

        {/* Requesting reschedule */}
        {requestingReschedule.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Pacientes Solicitando Remarcação
            </h3>
            {requestingReschedule.map(apt => (
              <div key={apt.id} className="p-3 rounded-lg border border-red-200 bg-red-50/20 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{apt.patientName}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(apt.date)} às {apt.time} · {apt.therapistName}</p>
                </div>
                <a href={buildWhatsApp24h(apt.patientPhone, apt.patientName, apt.date, apt.time, apt.therapistName, appName)}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-white bg-green-500 hover:bg-green-600 px-2.5 py-1.5 rounded-md transition-colors">
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Eligible patients */}
        {eligiblePatients.length > 0 && freeSlots.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" /> Pacientes Elegíveis para Encaixe
            </h3>
            <p className="text-xs text-muted-foreground">Pacientes com sessões restantes que podem ser encaixados nos horários vagos</p>
            <div className="space-y-2">
              {eligiblePatients.map(p => {
                const firstFreeSlot = freeSlots[0];
                return (
                  <div key={p.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50/20 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.remainingSessions} sessão(ões) restante(s) · {p.phone}</p>
                    </div>
                    {firstFreeSlot && (
                      <a href={buildWhatsAppEncaixe(p.phone, p.name, firstFreeSlot.date, firstFreeSlot.time, appName)}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-white bg-amber-500 hover:bg-amber-600 px-2.5 py-1.5 rounded-md transition-colors">
                        <MessageCircle className="h-3 w-3" /> Oferecer {fmtDate(firstFreeSlot.date)} {firstFreeSlot.time}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const DashboardContent = () => {
    const totalToday = todayApts.length;
    const confirmedToday = todayApts.filter(a => ["confirmado","confirmado_recepcao","presente"].includes(a.status)).length;
    const pendingToday = todayApts.filter(a => ["agendado","mensagem_enviada","aguardando_confirmacao"].includes(a.status)).length;
    const noResponseToday = todayApts.filter(a => a.status === "nao_respondeu").length;
    const rescheduleToday = todayApts.filter(a => a.status === "solicitou_remarcacao").length;
    const faltaToday = todayApts.filter(a => a.status === "falta").length;
    const totalWeek = upcoming.length;
    const confirmedWeek = confirmados.length;
    const taxaWeek = totalWeek ? Math.round(confirmedWeek / totalWeek * 100) : 0;
    const freeToday = (encaixeOpp?.freeSlots ?? []).filter(s => s.date === today).length;

    const metrics = [
      { label: "Sessões hoje", value: totalToday, sub: `${confirmedToday} confirmadas`, color: "text-foreground", bg: "bg-background" },
      { label: "Confirmados (período)", value: confirmedWeek, sub: `de ${totalWeek} agendadas`, color: "text-teal-600", bg: "bg-teal-50" },
      { label: "Aguardando hoje", value: pendingToday, sub: "sem confirmação", color: "text-yellow-700", bg: "bg-yellow-50" },
      { label: "Não responderam", value: semResposta.length, sub: "no período selecionado", color: "text-gray-600", bg: "bg-gray-50" },
      { label: "Pediram remarcação", value: solicitouRemarcar.length, sub: "no período selecionado", color: "text-red-600", bg: "bg-red-50" },
      { label: "Faltas esperadas", value: faltaToday, sub: "registradas hoje", color: "text-orange-600", bg: "bg-orange-50" },
      { label: "Taxa confirmação", value: `${taxaWeek}%`, sub: taxaWeek >= 70 ? "boa adesão" : "atenção necessária", color: taxaWeek >= 70 ? "text-teal-600" : "text-orange-600", bg: taxaWeek >= 70 ? "bg-teal-50" : "bg-orange-50" },
      { label: "Horários vagos hoje", value: freeToday, sub: "oportunidades de encaixe", color: "text-violet-600", bg: "bg-violet-50" },
    ];

    return (
      <div className="space-y-5">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {metrics.map(m => (
            <Card key={m.label} className={`border ${m.bg}`}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Status breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="h-4 w-4" /> Distribuição por Status (próximos {days} dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(STATUS_LABELS).map(([status, label]) => {
                const count = upcoming.filter(a => a.status === status).length;
                if (count === 0) return null;
                const pct = Math.round(count / upcoming.length * 100);
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded border w-40 text-center ${STATUS_COLORS[status]}`}>{label}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all`}
                        style={{ width: `${pct}%`, background: "currentColor" }}
                        role="progressbar" />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Guide */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Fluxo de Confirmação</p>
            <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
              {["agendado","mensagem_enviada","aguardando_confirmacao","confirmado","presente"].map((s, i, arr) => (
                <span key={s} className="flex items-center gap-1">
                  <span className={`px-2 py-0.5 rounded border ${STATUS_COLORS[s]}`}>{STATUS_LABELS[s]}</span>
                  {i < arr.length - 1 && <span>→</span>}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  function renderPreview(template: string) {
    return template
      .replace(/\{nome\}/g, "Maria Silva")
      .replace(/\{terapeuta\}/g, "Dr. João")
      .replace(/\{data\}/g, "15/05/2026")
      .replace(/\{hora\}/g, "10:00")
      .replace(/\{clinica\}/g, waForm?.clinic_name || "VitalFisio")
      .replace(/\{link\}/g, "https://clinica.com.br/confirmar?token=abc123");
  }

  const ConfiguracoesContent = () => {
    const settings = waSettingsQuery.data;
    const form = waForm ?? settings;

    if (waSettingsQuery.isLoading) {
      return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>;
    }
    if (!form) return null;

    const handleChange = (field: keyof WaSettings, value: string | boolean) => {
      const base = waForm ?? settings!;
      setWaForm({ ...base, [field]: value });
    };

    const handleSave = () => waSettingsMut.mutate(form as WaSettings);

    const hasChanges = waForm !== null && JSON.stringify(waForm) !== JSON.stringify(settings);

    const VARS_HELP = (
      <p className="text-[11px] text-muted-foreground mt-1">
        Variáveis disponíveis: <code className="bg-muted px-1 rounded">{"{nome}"}</code>{" "}
        <code className="bg-muted px-1 rounded">{"{data}"}</code>{" "}
        <code className="bg-muted px-1 rounded">{"{hora}"}</code>{" "}
        <code className="bg-muted px-1 rounded">{"{terapeuta}"}</code>{" "}
        <code className="bg-muted px-1 rounded">{"{clinica}"}</code>{" "}
        <code className="bg-muted px-1 rounded">{"{link}"}</code>
      </p>
    );

    return (
      <div className="space-y-6 max-w-2xl">
        {/* Identidade */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Settings className="h-4 w-4" /> Identidade da Clínica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Nome da Clínica (usado nas mensagens)</Label>
              <Input className="mt-1 h-8 text-sm" value={form.clinic_name} onChange={e => handleChange("clinic_name", e.target.value)} placeholder="Ex: VitalFisio" />
            </div>
          </CardContent>
        </Card>

        {/* Templates de mensagem */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><MessageCircle className="h-4 w-4 text-green-600" /> Mensagens WhatsApp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Template 1 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold">1ª Mensagem — Lembrete 24h antes</Label>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => setPreviewField(previewField === "template1" ? null : "template1")}>
                    <Eye className="h-3 w-3" /> {previewField === "template1" ? "Fechar" : "Prévia"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2 text-muted-foreground" onClick={() => handleChange("message_template_1", DEFAULT_TEMPLATE_1)}>
                    <RotateCcw className="h-3 w-3" /> Padrão
                  </Button>
                </div>
              </div>
              <Textarea rows={7} className="text-xs font-mono" value={form.message_template_1} onChange={e => handleChange("message_template_1", e.target.value)} />
              {VARS_HELP}
              {previewField === "template1" && (
                <div className="mt-2 p-3 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-[10px] text-green-700 font-semibold mb-1 uppercase">Prévia com dados de exemplo</p>
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-sans">{renderPreview(form.message_template_1)}</pre>
                </div>
              )}
            </div>

            <div className="border-t" />

            {/* Template 2 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold">2ª Mensagem — Lembrete urgente (12h / sem resposta)</Label>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => setPreviewField(previewField === "template2" ? null : "template2")}>
                    <Eye className="h-3 w-3" /> {previewField === "template2" ? "Fechar" : "Prévia"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2 text-muted-foreground" onClick={() => handleChange("message_template_2", DEFAULT_TEMPLATE_2)}>
                    <RotateCcw className="h-3 w-3" /> Padrão
                  </Button>
                </div>
              </div>
              <Textarea rows={7} className="text-xs font-mono" value={form.message_template_2} onChange={e => handleChange("message_template_2", e.target.value)} />
              {VARS_HELP}
              {previewField === "template2" && (
                <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-[10px] text-amber-700 font-semibold mb-1 uppercase">Prévia com dados de exemplo</p>
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-sans">{renderPreview(form.message_template_2)}</pre>
                </div>
              )}
            </div>

            <div className="border-t" />

            {/* Encaixe */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold">Mensagem de Encaixe (oferta de horário vago)</Label>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => setPreviewField(previewField === "encaixe" ? null : "encaixe")}>
                    <Eye className="h-3 w-3" /> {previewField === "encaixe" ? "Fechar" : "Prévia"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2 text-muted-foreground" onClick={() => handleChange("message_encaixe", DEFAULT_ENCAIXE)}>
                    <RotateCcw className="h-3 w-3" /> Padrão
                  </Button>
                </div>
              </div>
              <Textarea rows={3} className="text-xs font-mono" value={form.message_encaixe} onChange={e => handleChange("message_encaixe", e.target.value)} />
              {VARS_HELP}
              {previewField === "encaixe" && (
                <div className="mt-2 p-3 rounded-lg bg-violet-50 border border-violet-200">
                  <p className="text-[10px] text-violet-700 font-semibold mb-1 uppercase">Prévia com dados de exemplo</p>
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-sans">{renderPreview(form.message_encaixe)}</pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Auto-envio */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><AlarmClock className="h-4 w-4 text-blue-600" /> Envio Automático</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Ativar envio automático diário</p>
                <p className="text-xs text-muted-foreground">Envia lembretes automaticamente para agendamentos das próximas 24h</p>
              </div>
              <Switch checked={form.auto_send_enabled} onCheckedChange={v => handleChange("auto_send_enabled", v)} />
            </div>
            {form.auto_send_enabled && (
              <div>
                <Label className="text-xs">Horário do disparo automático</Label>
                <Input type="time" className="mt-1 h-8 text-sm w-32" value={form.auto_send_time} onChange={e => handleChange("auto_send_time", e.target.value)} />
                <p className="text-[11px] text-muted-foreground mt-1">O sistema verificará agendamentos neste horário todos os dias</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Salvar */}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={!hasChanges || waSettingsMut.isPending} className="gap-2">
            {waSettingsMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {waSettingsMut.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
          {hasChanges && (
            <Button variant="outline" onClick={() => setWaForm(null)} className="gap-2 text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" /> Descartar alterações
            </Button>
          )}
          {!hasChanges && !waSettingsMut.isPending && (
            <p className="text-xs text-muted-foreground">Nenhuma alteração pendente</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <PrintHeader title="Funil de Confirmações" subtitle={`Próximos ${days} dias`} />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Funil de Confirmações</h1>
          <p className="text-muted-foreground mt-1">Acompanhe, confirme e otimize a agenda da clínica</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Z-API Status Badge */}
          {zapiStatusQuery.data && (
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium no-print ${
              zapiStatusQuery.data.connected
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}>
              {zapiStatusQuery.data.connected
                ? <><Wifi className="h-3 w-3" /> WhatsApp Conectado</>
                : <><WifiOff className="h-3 w-3" /> WhatsApp Desconectado</>
              }
            </div>
          )}
          <span className="text-sm text-muted-foreground no-print">Próximos:</span>
          {[1, 2, 3, 5, 7].map(d => (
            <Button key={d} size="sm" variant={days === d ? "default" : "outline"}
              className="h-8 w-8 p-0 text-xs no-print" onClick={() => setDays(d)}>{d}d</Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => { upcomingQuery.refetch(); encaixeQuery.refetch(); }} className="gap-1 h-8 no-print">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
          <PrintButton title={`Confirmações — ${days} dias`} filename={`confirmacoes-${format(new Date(), "yyyy-MM-dd")}.pdf`} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="funil">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="funil" className="text-xs">
            Funil {pendentes.length > 0 && <Badge className="ml-1 h-4 px-1 text-[10px]">{pendentes.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="alertas" className="text-xs">
            Alertas {(solicitouRemarcar.length + semResposta.length) > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">{solicitouRemarcar.length + semResposta.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="encaixes" className="text-xs">
            Encaixes {(encaixeOpp?.freeSlots.length ?? 0) > 0 && <Badge className="ml-1 h-4 px-1 text-[10px] bg-violet-600">{encaixeOpp!.freeSlots.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="text-xs">Dashboard</TabsTrigger>
          <TabsTrigger value="configuracoes" className="text-xs flex items-center gap-1">
            <Settings className="h-3 w-3" /> Config.
          </TabsTrigger>
        </TabsList>
        <TabsContent value="funil" className="mt-4"><FunilContent /></TabsContent>
        <TabsContent value="alertas" className="mt-4"><AlertasContent /></TabsContent>
        <TabsContent value="encaixes" className="mt-4"><EncaixesContent /></TabsContent>
        <TabsContent value="dashboard" className="mt-4"><DashboardContent /></TabsContent>
        <TabsContent value="configuracoes" className="mt-4"><ConfiguracoesContent /></TabsContent>
      </Tabs>

      {/* Observation Dialog */}
      <Dialog open={obsDialog.open} onOpenChange={open => setObsDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Registrar Observação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Paciente: <strong>{obsDialog.patientName}</strong></p>
            <div>
              <Label>Observação</Label>
              <Textarea placeholder="Ex: Paciente ligou confirmando, disse que pode atrasar 10min..." rows={3} className="mt-1"
                value={obsText} onChange={e => setObsText(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObsDialog(prev => ({ ...prev, open: false }))}>Cancelar</Button>
            <Button onClick={saveObservation} disabled={!obsText.trim() || contactMut.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
