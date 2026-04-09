import { useState, useMemo } from "react";
import {
  useListAppointments, useListTherapists, useCreateAppointment,
  useUpdateAppointmentStatus, useRescheduleAppointment, useDeleteAppointment,
  getListAppointmentsQueryKey, getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListPatients } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiFetch } from "@/lib/apiFetch";
import { useAppName } from "@/contexts/AppSettingsContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Plus, X, RefreshCw, MessageCircle, Check, UserX, Ban, Search, Filter } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PrintButton } from "@/components/print/PrintButton";
import { PrintHeader } from "@/components/print/PrintHeader";

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado",
  mensagem_enviada: "Msg. Enviada",
  aguardando_confirmacao: "Ag. Confirmação",
  confirmado: "Confirmado",
  confirmado_recepcao: "Conf. Recepção",
  solicitou_remarcacao: "Sol. Remarcação",
  nao_respondeu: "Não Respondeu",
  presente: "Presente",
  falta: "Falta",
  cancelado: "Cancelado",
  remarcado: "Remarcado",
  encaixe: "Encaixe",
  encaixe_preenchido: "Encaixe Preen.",
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

const STATUS_BG_COLORS: Record<string, string> = {
  agendado: "bg-blue-50 border-blue-200 hover:bg-blue-100",
  mensagem_enviada: "bg-sky-50 border-sky-200 hover:bg-sky-100",
  aguardando_confirmacao: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100",
  confirmado: "bg-teal-50 border-teal-200 hover:bg-teal-100",
  confirmado_recepcao: "bg-cyan-50 border-cyan-200 hover:bg-cyan-100",
  solicitou_remarcacao: "bg-red-50 border-red-200 hover:bg-red-100",
  nao_respondeu: "bg-gray-50 border-gray-300 hover:bg-gray-100",
  presente: "bg-green-50 border-green-200 hover:bg-green-100",
  falta: "bg-orange-50 border-orange-200 hover:bg-orange-100",
  cancelado: "bg-slate-50 border-slate-300 hover:bg-slate-100",
  remarcado: "bg-purple-50 border-purple-200 hover:bg-purple-100",
  encaixe: "bg-amber-50 border-amber-200 hover:bg-amber-100",
  encaixe_preenchido: "bg-violet-50 border-violet-200 hover:bg-violet-100",
};

const MORNING_SLOTS = ["08:00", "08:40", "09:20", "10:00", "10:40", "11:20"];
const AFTERNOON_SLOTS = ["13:30", "14:10", "14:50", "15:30", "16:10", "16:50"];
const ALL_SLOTS = [...MORNING_SLOTS, ...AFTERNOON_SLOTS];

const WEEK_DAYS = [
  { value: 1, label: "Seg" }, { value: 2, label: "Ter" }, { value: 3, label: "Qua" },
  { value: 4, label: "Qui" }, { value: 5, label: "Sex" }, { value: 6, label: "Sáb" },
];

type AppointmentType = {
  id: number; patientId: number; therapistId: number; date: string; time: string;
  status: string; notes?: string | null; originalAppointmentId?: number | null;
  recurringGroupId?: string | null; patientName: string; patientPhone: string;
  therapistName: string; therapistSpecialty: string; createdAt: string; updatedAt: string;
};

type TherapistType = { id: number; name: string; specialty: string; phone: string };
type PatientType = { id: number; name: string; phone: string };

const ALL_STATUSES_LIST = [
  "agendado","mensagem_enviada","aguardando_confirmacao","confirmado","confirmado_recepcao",
  "solicitou_remarcacao","nao_respondeu","presente","falta","cancelado","remarcado","encaixe","encaixe_preenchido"
] as const;

const newApptSchema = z.object({
  patientId: z.number().min(1, "Selecione um paciente"),
  therapistId: z.number().min(1, "Selecione um fisioterapeuta"),
  date: z.string().min(1, "Data é obrigatória"),
  time: z.string().min(1, "Horário é obrigatório"),
  status: z.enum(ALL_STATUSES_LIST),
  notes: z.string().optional().nullable(),
});

type NewApptFormData = z.infer<typeof newApptSchema>;

const rescheduleSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  time: z.string().min(1, "Horário é obrigatório"),
  therapistId: z.number().optional().nullable(),
});

type RescheduleFormData = z.infer<typeof rescheduleSchema>;

const MAX_SLOT_CAPACITY = 40;

export default function Agenda() {
  const appName = useAppName();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedTherapistId, setSelectedTherapistId] = useState<number | undefined>(undefined);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentType | null>(null);
  const [isNewApptOpen, setIsNewApptOpen] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"single" | "recurring">("single");
  const [viewMode, setViewMode] = useState<"semanal" | "diaria">("semanal");
  const [dailyDate, setDailyDate] = useState<Date>(new Date());
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPatient, setFilterPatient] = useState<string>("");

  // Recurrence state
  const [recForm, setRecForm] = useState({
    patientId: "", therapistId: "", startDate: format(new Date(), "yyyy-MM-dd"),
    time: "08:00", recurrenceType: "semanal", weekDays: [] as number[],
    totalCount: "12", endDate: "", notes: "",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const weekStartStr = format(currentWeekStart, "yyyy-MM-dd");
  const weekDays = Array.from({ length: 6 }, (_, i) => addDays(currentWeekStart, i));
  const dailyDateStr = format(dailyDate, "yyyy-MM-dd");
  const queryParams: Record<string, string | number> = viewMode === "semanal"
    ? { weekStart: weekStartStr }
    : { date: dailyDateStr };
  if (selectedTherapistId) queryParams.therapistId = selectedTherapistId;

  const { data: appointments = [], isLoading: isLoadingAppts } = useListAppointments(queryParams, {
    query: { queryKey: getListAppointmentsQueryKey(queryParams) },
  });
  const { data: therapists = [] } = useListTherapists();
  const { data: patients = [] } = useListPatients({});

  const updateStatus = useUpdateAppointmentStatus();
  const reschedule = useRescheduleAppointment();
  const deleteAppt = useDeleteAppointment();
  const createAppt = useCreateAppointment();

  const recurringMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/appointments/recurring", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (data: any) => {
      toast({ title: `${data.created} agendamentos criados com sucesso!` });
      setIsNewApptOpen(false);
      invalidate();
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao criar recorrência", variant: "destructive" }),
  });

  const newApptForm = useForm<NewApptFormData>({
    resolver: zodResolver(newApptSchema),
    defaultValues: { patientId: 0, therapistId: 0, date: format(new Date(), "yyyy-MM-dd"), time: "08:00", status: "agendado", notes: null },
  });

  const rescheduleForm = useForm<RescheduleFormData>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: { date: format(new Date(), "yyyy-MM-dd"), time: "08:00", therapistId: null },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey(queryParams) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    queryClient.invalidateQueries({ queryKey: ["appointments-upcoming"] });
    queryClient.invalidateQueries({ queryKey: ["patients"] });
  }

  const allAppts = appointments as AppointmentType[];

  // All appointments mapped by date+time (for capacity display — no filter)
  const allApptsByDateAndTime = useMemo(() => {
    const map = new Map<string, AppointmentType[]>();
    for (const apt of allAppts) {
      const key = `${apt.date}|${apt.time}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(apt);
    }
    return map;
  }, [allAppts]);

  // Filtered appointments for display
  const filteredAppts = useMemo(() => {
    let list = allAppts;
    if (filterStatus !== "all") list = list.filter(a => a.status === filterStatus);
    if (filterPatient.trim()) {
      const term = filterPatient.toLowerCase();
      list = list.filter(a => a.patientName.toLowerCase().includes(term));
    }
    return list;
  }, [allAppts, filterStatus, filterPatient]);

  const apptsByDateAndTime = useMemo(() => {
    const map = new Map<string, AppointmentType[]>();
    for (const apt of filteredAppts) {
      const key = `${apt.date}|${apt.time}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(apt);
    }
    return map;
  }, [filteredAppts]);

  // Day totals for weekly header (use filtered)
  const dayTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const apt of filteredAppts) {
      map.set(apt.date, (map.get(apt.date) ?? 0) + 1);
    }
    return map;
  }, [filteredAppts]);

  const handleStatusChange = (status: string) => {
    if (!selectedAppointment) return;
    updateStatus.mutate(
      { id: selectedAppointment.id, data: { status: status as any } },
      {
        onSuccess: (updated) => {
          toast({ title: `Status: ${STATUS_LABELS[status]}` });
          setSelectedAppointment(updated as AppointmentType);
          invalidate();
        },
        onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
      }
    );
  };

  const handleReschedule = (data: RescheduleFormData) => {
    if (!selectedAppointment) return;
    reschedule.mutate(
      { id: selectedAppointment.id, data: { date: data.date, time: data.time, therapistId: data.therapistId ?? null } },
      {
        onSuccess: () => {
          toast({ title: "Sessão remarcada com sucesso!" });
          setIsRescheduleOpen(false);
          setSelectedAppointment(null);
          invalidate();
        },
        onError: (err: any) => {
          const msg = err?.message || err?.data?.error || "Erro ao remarcar sessão";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!selectedAppointment) return;
    deleteAppt.mutate(
      { id: selectedAppointment.id },
      {
        onSuccess: () => { toast({ title: "Agendamento removido" }); setSelectedAppointment(null); invalidate(); },
        onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
      }
    );
  };

  const onCreateAppt = (data: NewApptFormData) => {
    createAppt.mutate(
      { data: { ...data, notes: data.notes || null } },
      {
        onSuccess: () => { toast({ title: "Agendamento criado com sucesso!" }); setIsNewApptOpen(false); invalidate(); },
        onError: (err: any) => {
          const msg = err?.message || err?.data?.error || "Erro ao criar agendamento";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const onCreateRecurring = () => {
    if (!recForm.patientId || !recForm.therapistId || !recForm.startDate || !recForm.time) {
      toast({ title: "Preencha paciente, fisioterapeuta, data de início e horário", variant: "destructive" });
      return;
    }
    if (recForm.recurrenceType === "dias_semana" && recForm.weekDays.length === 0) {
      toast({ title: "Selecione pelo menos um dia da semana", variant: "destructive" });
      return;
    }
    if (recForm.totalCount && parseInt(recForm.totalCount) < 1) {
      toast({ title: "A quantidade de sessões deve ser pelo menos 1", variant: "destructive" });
      return;
    }
    const payload: any = {
      patientId: parseInt(recForm.patientId), therapistId: parseInt(recForm.therapistId),
      startDate: recForm.startDate, time: recForm.time,
      recurrenceType: recForm.recurrenceType, notes: recForm.notes || null,
    };
    if (recForm.recurrenceType === "dias_semana") payload.weekDays = recForm.weekDays;
    if (recForm.totalCount) payload.totalCount = parseInt(recForm.totalCount);
    if (recForm.endDate) payload.endDate = recForm.endDate;
    recurringMut.mutate(payload);
  };

  const whatsappLink = (phone: string, name: string, date: string, time: string, therapist: string) => {
    const d = date ? (() => { const [y, m, day] = date.split("-"); return `${day}/${m}/${y}`; })() : "";
    const msg = encodeURIComponent(`Olá ${name}! Lembrando sua sessão de fisioterapia dia ${d} às ${time} com ${therapist}. Confirme sua presença respondendo esta mensagem. ${appName}.`);
    const cleanPhone = phone.replace(/\D/g, "");
    return `https://wa.me/55${cleanPhone}?text=${msg}`;
  };

  const today = new Date();

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const printTitle = viewMode === "semanal"
    ? `Agenda Semanal — ${format(currentWeekStart, "dd/MM")} a ${format(addDays(currentWeekStart, 5), "dd/MM/yyyy")}`
    : `Agenda Diária — ${format(dailyDate, "dd/MM/yyyy")}`;
  const printFilename = viewMode === "semanal"
    ? `agenda-semanal-${format(currentWeekStart, "yyyy-MM-dd")}.pdf`
    : `agenda-diaria-${format(dailyDate, "yyyy-MM-dd")}.pdf`;

  const hasFilters = filterStatus !== "all" || filterPatient.trim() !== "";

  return (
    <div className="space-y-4">
      {/* Print-only header */}
      <PrintHeader
        title={viewMode === "semanal" ? "Agenda Semanal" : "Agenda Diária"}
        subtitle={viewMode === "semanal"
          ? `Semana de ${format(currentWeekStart, "dd/MM/yyyy", { locale: ptBR })} a ${format(addDays(currentWeekStart, 5), "dd/MM/yyyy", { locale: ptBR })}`
          : format(dailyDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {viewMode === "semanal" ? "Agenda Semanal" : "Agenda Diária"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {viewMode === "semanal"
              ? `${format(currentWeekStart, "dd 'de' MMMM", { locale: ptBR })} — ${format(addDays(currentWeekStart, 5), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
              : format(dailyDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden no-print">
            <Button variant={viewMode === "semanal" ? "default" : "ghost"}
              size="sm" className="rounded-none h-9 px-3 text-xs"
              onClick={() => setViewMode("semanal")}>Semanal</Button>
            <Button variant={viewMode === "diaria" ? "default" : "ghost"}
              size="sm" className="rounded-none h-9 px-3 text-xs border-l"
              onClick={() => setViewMode("diaria")}>Diária</Button>
          </div>
          <div className="flex items-center gap-1 no-print">
            {viewMode === "semanal" ? (
              <>
                <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
                  Hoje
                </Button>
                <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="icon" onClick={() => setDailyDate(addDays(dailyDate, -1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDailyDate(new Date())}>
                  Hoje
                </Button>
                <Button variant="outline" size="icon" onClick={() => setDailyDate(addDays(dailyDate, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          <PrintButton title={printTitle} filename={printFilename} />
          <Button className="gap-2 no-print" onClick={() => {
            setCreateMode("single");
            const defaultDate = viewMode === "diaria" ? dailyDateStr : format(new Date(), "yyyy-MM-dd");
            newApptForm.reset({ patientId: 0, therapistId: 0, date: defaultDate, time: "08:00", status: "agendado", notes: null });
            setRecForm({ patientId: "", therapistId: "", startDate: defaultDate, time: "08:00", recurrenceType: "semanal", weekDays: [], totalCount: "12", endDate: "", notes: "" });
            setIsNewApptOpen(true);
          }}>
            <Plus className="h-4 w-4" /> Novo Agendamento
          </Button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-2 items-center no-print">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <Filter className="h-3.5 w-3.5" /> Filtros:
        </div>
        <Select value={selectedTherapistId?.toString() ?? "all"} onValueChange={v => setSelectedTherapistId(v === "all" ? undefined : parseInt(v))}>
          <SelectTrigger className="h-8 text-xs w-[175px]"><SelectValue placeholder="Todos os fisios" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os fisioterapeutas</SelectItem>
            {(therapists as TherapistType[]).map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-[155px]"><SelectValue placeholder="Todos os status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 text-xs pl-7 w-[160px]"
            placeholder="Buscar paciente..."
            value={filterPatient}
            onChange={e => setFilterPatient(e.target.value)}
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs px-2 text-muted-foreground"
            onClick={() => { setFilterStatus("all"); setFilterPatient(""); setSelectedTherapistId(undefined); }}>
            <X className="h-3.5 w-3.5 mr-1" /> Limpar
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredAppts.length} agendamento{filteredAppts.length !== 1 ? "s" : ""}
          {hasFilters ? " (filtrado)" : ""}
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <span key={key} className={`text-xs px-2 py-1 rounded border font-medium ${STATUS_COLORS[key]}`}>{label}</span>
        ))}
      </div>

      {/* Daily View */}
      {viewMode === "diaria" && (
        <div className="rounded-xl border border-border shadow-sm overflow-hidden">
          {/* Stats bar */}
          {!isLoadingAppts && (
            <div className="flex gap-4 flex-wrap px-4 py-2 bg-muted/40 border-b border-border text-xs">
              <span className="text-muted-foreground">Total do dia: <strong className="text-foreground">{allAppts.length}</strong></span>
              {filteredAppts.length !== allAppts.length && (
                <span className="text-muted-foreground">Exibindo: <strong className="text-foreground">{filteredAppts.length}</strong></span>
              )}
              {["confirmado","confirmado_recepcao","presente"].map(s => {
                const count = allAppts.filter(a => a.status === s).length;
                return count > 0 ? <span key={s} className={`px-2 py-0.5 rounded ${STATUS_COLORS[s]}`}>{STATUS_LABELS[s]}: {count}</span> : null;
              })}
              {["solicitou_remarcacao","nao_respondeu","falta"].map(s => {
                const count = allAppts.filter(a => a.status === s).length;
                return count > 0 ? <span key={s} className={`px-2 py-0.5 rounded ${STATUS_COLORS[s]}`}>{STATUS_LABELS[s]}: {count}</span> : null;
              })}
            </div>
          )}
          <div className="divide-y divide-border">
            {ALL_SLOTS.map((slot, slotIdx) => {
              const key = `${dailyDateStr}|${slot}`;
              const apts = apptsByDateAndTime.get(key) || [];
              const totalInSlot = allApptsByDateAndTime.get(key)?.length ?? 0;
              const remaining = MAX_SLOT_CAPACITY - totalInSlot;
              const isMorningBreak = slot === "13:30";
              return (
                <div key={slot}>
                  {isMorningBreak && (
                    <div className="py-1.5 px-4 bg-muted/30 text-xs text-muted-foreground text-center border-y border-dashed border-muted-foreground/20">
                      ☀️ Tarde
                    </div>
                  )}
                  <div className={`flex gap-3 px-4 py-3 ${slotIdx % 2 === 0 ? "bg-background" : "bg-muted/10"} ${apts.length === 0 ? "min-h-[56px]" : ""}`}>
                    {/* Time + capacity */}
                    <div className="w-16 shrink-0 flex flex-col items-center pt-1 gap-1">
                      <span className="text-xs font-mono text-muted-foreground font-medium">{slot}</span>
                      {totalInSlot > 0 && (
                        <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${remaining <= 0 ? "bg-red-100 text-red-700" : remaining <= 10 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                          {remaining > 0 ? `${remaining} vagas` : "Lotado"}
                        </span>
                      )}
                    </div>
                    {isLoadingAppts ? (
                      <div className="flex-1 h-12 bg-muted rounded animate-pulse" />
                    ) : apts.length === 0 ? (
                      <div className="flex-1 flex items-center">
                        <span className="text-xs text-muted-foreground/40 italic">
                          {totalInSlot > 0 ? `${totalInSlot} agendamento(s) — oculto(s) pelo filtro` : "Horário livre"}
                        </span>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-wrap gap-2">
                        {apts.map(apt => (
                          <div key={apt.id}
                            className={`text-left rounded-lg border transition-colors flex-1 min-w-[200px] max-w-[320px] print-avoid-break ${STATUS_BG_COLORS[apt.status] || "bg-gray-50 border-gray-200"}`}>
                            {/* Card header — clickable for details */}
                            <button className="w-full text-left p-3 pb-2" onClick={() => setSelectedAppointment(apt)}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm leading-tight">{apt.patientName}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[apt.status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                                  {STATUS_LABELS[apt.status] || apt.status}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {apt.therapistName} {apt.patientPhone && <span>· {apt.patientPhone}</span>}
                              </div>
                            </button>
                            {/* Quick actions row */}
                            <div className="flex gap-1 px-2 pb-2 no-print">
                              {apt.status !== "presente" && (
                                <button onClick={() => { setSelectedAppointment(apt); handleStatusChange("presente"); }}
                                  title="Marcar Presente"
                                  className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 border border-green-200 transition-colors font-medium">
                                  <Check className="h-3 w-3" /> Presente
                                </button>
                              )}
                              {apt.status !== "falta" && (
                                <button onClick={() => { setSelectedAppointment(apt); handleStatusChange("falta"); }}
                                  title="Registrar Falta"
                                  className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-200 transition-colors font-medium">
                                  <UserX className="h-3 w-3" /> Falta
                                </button>
                              )}
                              {apt.status !== "confirmado" && apt.status !== "presente" && apt.status !== "falta" && (
                                <button onClick={() => { setSelectedAppointment(apt); handleStatusChange("confirmado"); }}
                                  title="Confirmar"
                                  className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 hover:bg-teal-200 border border-teal-200 transition-colors font-medium">
                                  <Check className="h-3 w-3" /> Confirmar
                                </button>
                              )}
                              {apt.status !== "cancelado" && apt.status !== "presente" && (
                                <button onClick={() => { setSelectedAppointment(apt); handleStatusChange("cancelado"); }}
                                  title="Cancelar"
                                  className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300 transition-colors font-medium">
                                  <Ban className="h-3 w-3" /> Cancelar
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weekly Grid */}
      {viewMode === "semanal" && (
        <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 bg-muted/60 border-b border-border">
              <div className="py-3 px-3 text-xs font-semibold text-muted-foreground text-center border-r border-border">Horário</div>
              {weekDays.map(day => {
                const isToday = isSameDay(day, today);
                const dateStr = format(day, "yyyy-MM-dd");
                const dayTotal = dayTotals.get(dateStr) ?? 0;
                return (
                  <div key={day.toISOString()} className={`py-3 px-2 text-center border-r border-border last:border-r-0 cursor-pointer hover:bg-muted/80 transition-colors ${isToday ? "bg-primary/10" : ""}`}
                    onClick={() => { setDailyDate(day); setViewMode("diaria"); }}>
                    <div className={`text-xs font-semibold uppercase ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                      {format(day, "EEE", { locale: ptBR })}
                    </div>
                    <div className={`text-lg font-bold mt-0.5 ${isToday ? "text-primary" : "text-foreground"}`}>
                      {format(day, "dd")}
                    </div>
                    {dayTotal > 0 && (
                      <div className={`text-[10px] mt-0.5 font-medium ${isToday ? "text-primary/70" : "text-muted-foreground"}`}>
                        {dayTotal} pac.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {ALL_SLOTS.map((slot, slotIndex) => {
              const isSectionBreak = slot === "13:30";
              return (
                <div key={slot}>
                  {isSectionBreak && (
                    <div className="grid grid-cols-7 bg-muted/30 border-y border-dashed border-muted-foreground/20">
                      <div className="py-1 px-3 text-xs text-muted-foreground col-span-7 text-center">☀️ Tarde</div>
                    </div>
                  )}
                  <div className={`grid grid-cols-7 border-b border-border last:border-b-0 ${slotIndex % 2 === 0 ? "bg-background" : "bg-muted/20"}`} style={{ minHeight: "68px" }}>
                    <div className="py-2 px-3 text-xs font-mono text-muted-foreground font-medium border-r border-border flex items-start justify-center pt-3">{slot}</div>
                    {weekDays.map(day => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const key = `${dateStr}|${slot}`;
                      const apts = apptsByDateAndTime.get(key) || [];
                      const totalInSlot = allApptsByDateAndTime.get(key)?.length ?? 0;
                      const remaining = MAX_SLOT_CAPACITY - totalInSlot;
                      const isToday = isSameDay(day, today);
                      return (
                        <div key={dateStr} className={`py-1.5 px-1 border-r border-border last:border-r-0 ${isToday ? "bg-primary/5" : ""}`}>
                          {isLoadingAppts ? (
                            <div className="h-10 bg-muted rounded animate-pulse" />
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {apts.map(apt => (
                                <button key={apt.id} onClick={() => setSelectedAppointment(apt)}
                                  className={`text-left text-xs rounded border p-1.5 transition-colors cursor-pointer flex-shrink-0 ${STATUS_BG_COLORS[apt.status] || "bg-gray-50 border-gray-200 hover:bg-gray-100"}`}
                                  style={{ minWidth: apts.length > 1 ? "calc(50% - 2px)" : "100%", maxWidth: "100%" }}>
                                  <div className="font-semibold truncate leading-tight text-[11px]">{apt.patientName.split(" ")[0]}</div>
                                  <div className="text-[10px] opacity-60 truncate">{apt.therapistName.split(" ")[0]}</div>
                                </button>
                              ))}
                              {totalInSlot > 0 && (
                                <div className={`text-[9px] w-full text-center mt-0.5 font-medium ${remaining <= 0 ? "text-red-600" : remaining <= 10 ? "text-amber-600" : "text-green-600"}`}>
                                  {remaining > 0 ? `${remaining} vagas` : "Lotado"}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Appointment Detail Panel */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedAppointment(null)} />
          <div className="relative bg-card border border-border rounded-t-2xl sm:rounded-xl w-full sm:max-w-md shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Detalhes do Agendamento</h2>
              <Button variant="ghost" size="icon" onClick={() => setSelectedAppointment(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-2 text-sm">
              {[
                { label: "Paciente", value: selectedAppointment.patientName },
                { label: "Fisioterapeuta", value: selectedAppointment.therapistName },
                { label: "Data", value: format(new Date(selectedAppointment.date + "T12:00:00"), "dd/MM/yyyy") },
                { label: "Horário", value: selectedAppointment.time },
              ].map(i => (
                <div key={i.label} className="flex justify-between">
                  <span className="text-muted-foreground">{i.label}</span>
                  <span className="font-medium">{i.value}</span>
                </div>
              ))}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className={STATUS_COLORS[selectedAppointment.status]}>
                  {STATUS_LABELS[selectedAppointment.status]}
                </Badge>
              </div>
              {selectedAppointment.notes && (
                <div>
                  <span className="text-muted-foreground block mb-1">Observações</span>
                  <p className="text-foreground italic text-sm">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>

            {/* WhatsApp */}
            <a href={whatsappLink(selectedAppointment.patientPhone, selectedAppointment.patientName, selectedAppointment.date, selectedAppointment.time, selectedAppointment.therapistName)}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 font-medium border border-green-200 bg-green-50 rounded-lg px-3 py-2 transition-colors hover:bg-green-100">
              <MessageCircle className="h-4 w-4" />
              Enviar confirmação via WhatsApp
            </a>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Alterar Status</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <button key={key} onClick={() => handleStatusChange(key)}
                    disabled={selectedAppointment.status === key || updateStatus.isPending}
                    className={`text-xs px-2.5 py-1.5 rounded border font-medium transition-opacity ${STATUS_COLORS[key]} ${selectedAppointment.status === key ? "opacity-100 ring-2 ring-offset-1 ring-current" : "opacity-70 hover:opacity-100"} disabled:cursor-default`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" className="flex-1"
                onClick={() => { rescheduleForm.reset({ date: format(new Date(), "yyyy-MM-dd"), time: "08:00", therapistId: selectedAppointment.therapistId }); setIsRescheduleOpen(true); }}>
                Remarcar
              </Button>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"
                onClick={handleDelete} disabled={deleteAppt.isPending}>
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Dialog */}
      <Dialog open={isRescheduleOpen} onOpenChange={setIsRescheduleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Remarcar Sessão</DialogTitle></DialogHeader>
          <Form {...rescheduleForm}>
            <form onSubmit={rescheduleForm.handleSubmit(handleReschedule)} className="space-y-4">
              <FormField control={rescheduleForm.control} name="date" render={({ field }) => (
                <FormItem><FormLabel>Nova Data</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={rescheduleForm.control} name="time" render={({ field }) => (
                <FormItem>
                  <FormLabel>Novo Horário</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {MORNING_SLOTS.map(s => <SelectItem key={s} value={s}>{s} (manhã)</SelectItem>)}
                      {AFTERNOON_SLOTS.map(s => <SelectItem key={s} value={s}>{s} (tarde)</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={rescheduleForm.control} name="therapistId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fisioterapeuta (opcional)</FormLabel>
                  <Select onValueChange={v => field.onChange(v === "keep" ? null : parseInt(v))} value={field.value?.toString() ?? "keep"}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Manter o mesmo" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="keep">Manter o mesmo</SelectItem>
                      {(therapists as TherapistType[]).map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsRescheduleOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={reschedule.isPending}>Remarcar</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* New Appointment Dialog */}
      <Dialog open={isNewApptOpen} onOpenChange={setIsNewApptOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Agendamento</DialogTitle></DialogHeader>

          <Tabs value={createMode} onValueChange={v => setCreateMode(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">Sessão Única</TabsTrigger>
              <TabsTrigger value="recurring">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Recorrente
              </TabsTrigger>
            </TabsList>

            {/* Single */}
            <TabsContent value="single">
              <Form {...newApptForm}>
                <form onSubmit={newApptForm.handleSubmit(onCreateAppt)} className="space-y-4 mt-4">
                  <FormField control={newApptForm.control} name="patientId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paciente</FormLabel>
                      <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString() ?? ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione um paciente" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {(patients as PatientType[]).map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={newApptForm.control} name="therapistId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fisioterapeuta</FormLabel>
                      <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString() ?? ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione um fisioterapeuta" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {(therapists as TherapistType[]).map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={newApptForm.control} name="date" render={({ field }) => (
                      <FormItem><FormLabel>Data</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={newApptForm.control} name="time" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horário</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {MORNING_SLOTS.map(s => <SelectItem key={s} value={s}>{s} (manhã)</SelectItem>)}
                            {AFTERNOON_SLOTS.map(s => <SelectItem key={s} value={s}>{s} (tarde)</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={newApptForm.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={newApptForm.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl><Textarea placeholder="Observações opcionais..." {...field} value={field.value ?? ""} rows={2} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsNewApptOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createAppt.isPending}>Criar Agendamento</Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>

            {/* Recurring */}
            <TabsContent value="recurring">
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Paciente</Label>
                  <Select value={recForm.patientId} onValueChange={v => setRecForm(p => ({ ...p, patientId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione um paciente" /></SelectTrigger>
                    <SelectContent>
                      {(patients as PatientType[]).map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fisioterapeuta</Label>
                  <Select value={recForm.therapistId} onValueChange={v => setRecForm(p => ({ ...p, therapistId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione um fisioterapeuta" /></SelectTrigger>
                    <SelectContent>
                      {(therapists as TherapistType[]).map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Data de Início</Label>
                    <Input type="date" value={recForm.startDate} onChange={e => setRecForm(p => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Horário</Label>
                    <Select value={recForm.time} onValueChange={v => setRecForm(p => ({ ...p, time: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MORNING_SLOTS.map(s => <SelectItem key={s} value={s}>{s} (manhã)</SelectItem>)}
                        {AFTERNOON_SLOTS.map(s => <SelectItem key={s} value={s}>{s} (tarde)</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Tipo de Recorrência</Label>
                  <Select value={recForm.recurrenceType} onValueChange={v => setRecForm(p => ({ ...p, recurrenceType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semanal">Semanal (mesmo dia da semana)</SelectItem>
                      <SelectItem value="dias_semana">Dias específicos da semana</SelectItem>
                      <SelectItem value="diaria">Diária</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {recForm.recurrenceType === "dias_semana" && (
                  <div>
                    <Label>Dias da Semana</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {WEEK_DAYS.map(d => (
                        <button key={d.value} type="button"
                          className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${recForm.weekDays.includes(d.value) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
                          onClick={() => setRecForm(p => ({ ...p, weekDays: p.weekDays.includes(d.value) ? p.weekDays.filter(x => x !== d.value) : [...p.weekDays, d.value] }))}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Quantidade de Sessões</Label>
                    <Input type="number" min="1" max="100" value={recForm.totalCount}
                      onChange={e => setRecForm(p => ({ ...p, totalCount: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Data Final (opcional)</Label>
                    <Input type="date" value={recForm.endDate} onChange={e => setRecForm(p => ({ ...p, endDate: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea rows={2} placeholder="Observações opcionais..." value={recForm.notes}
                    onChange={e => setRecForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsNewApptOpen(false)}>Cancelar</Button>
                  <Button onClick={onCreateRecurring} disabled={recurringMut.isPending}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Criar Recorrência
                  </Button>
                </DialogFooter>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
