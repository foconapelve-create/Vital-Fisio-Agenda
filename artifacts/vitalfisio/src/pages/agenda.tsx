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
import {
  ChevronLeft, ChevronRight, Plus, X, RefreshCw, MessageCircle,
  Check, UserX, Ban, Search, Filter, Printer, Calendar,
} from "lucide-react";
import {
  format, addDays, startOfWeek, isSameDay, addWeeks, subWeeks,
  startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths,
  getDay, isSameMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";

/* ─────────────────────────── STATUS MAPS ─────────────────────────── */

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

const STATUS_CELL: Record<string, string> = {
  agendado:              "bg-blue-100 border-blue-300 text-blue-900",
  mensagem_enviada:      "bg-sky-100 border-sky-300 text-sky-900",
  aguardando_confirmacao:"bg-yellow-100 border-yellow-300 text-yellow-900",
  confirmado:            "bg-emerald-100 border-emerald-400 text-emerald-900",
  confirmado_recepcao:   "bg-teal-100 border-teal-300 text-teal-900",
  solicitou_remarcacao:  "bg-red-100 border-red-300 text-red-900",
  nao_respondeu:         "bg-gray-100 border-gray-300 text-gray-700",
  presente:              "bg-green-200 border-green-400 text-green-900",
  falta:                 "bg-red-200 border-red-400 text-red-900",
  cancelado:             "bg-slate-100 border-slate-300 text-slate-600",
  remarcado:             "bg-orange-100 border-orange-300 text-orange-900",
  encaixe:               "bg-purple-100 border-purple-300 text-purple-900",
  encaixe_preenchido:    "bg-violet-200 border-violet-400 text-violet-900",
};

const STATUS_COLORS: Record<string, string> = {
  agendado:              "bg-blue-100 text-blue-800 border-blue-200",
  mensagem_enviada:      "bg-sky-100 text-sky-800 border-sky-200",
  aguardando_confirmacao:"bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmado:            "bg-teal-100 text-teal-800 border-teal-200",
  confirmado_recepcao:   "bg-cyan-100 text-cyan-800 border-cyan-200",
  solicitou_remarcacao:  "bg-red-100 text-red-800 border-red-200",
  nao_respondeu:         "bg-gray-100 text-gray-700 border-gray-300",
  presente:              "bg-green-100 text-green-800 border-green-200",
  falta:                 "bg-orange-100 text-orange-800 border-orange-200",
  cancelado:             "bg-slate-100 text-slate-700 border-slate-300",
  remarcado:             "bg-purple-100 text-purple-800 border-purple-200",
  encaixe:               "bg-amber-100 text-amber-800 border-amber-200",
  encaixe_preenchido:    "bg-violet-100 text-violet-800 border-violet-200",
};

/* ────────────────────────── SLOTS / DAYS ──────────────────────────── */

const MORNING_SLOTS  = ["08:00", "08:45", "09:30", "10:30", "11:10"];
const AFTERNOON_SLOTS = ["13:20", "14:00", "14:40", "15:40", "16:20"];
const ALL_SLOTS = [...MORNING_SLOTS, ...AFTERNOON_SLOTS];

const WEEK_DAYS = [
  { value: 1, label: "Segunda" }, { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },   { value: 6, label: "Sábado" },
];

/* ───────────────────────────── TYPES ──────────────────────────────── */

type AppointmentType = {
  id: number; patientId: number; therapistId: number; date: string; time: string;
  status: string; notes?: string | null; originalAppointmentId?: number | null;
  recurringGroupId?: string | null; patientName: string; patientPhone: string;
  therapistName: string; therapistSpecialty: string; createdAt: string; updatedAt: string;
};
type TherapistType = { id: number; name: string; specialty: string; phone: string };
type PatientType   = { id: number; name: string; phone: string };

const ALL_STATUSES_LIST = [
  "agendado","mensagem_enviada","aguardando_confirmacao","confirmado","confirmado_recepcao",
  "solicitou_remarcacao","nao_respondeu","presente","falta","cancelado","remarcado","encaixe","encaixe_preenchido",
] as const;

/* ────────────────────────── FORM SCHEMAS ───────────────────────────── */

const newApptSchema = z.object({
  patientId:   z.number().min(1, "Selecione um paciente"),
  therapistId: z.number().min(1, "Selecione um fisioterapeuta"),
  date:        z.string().min(1, "Data é obrigatória"),
  time:        z.string().min(1, "Horário é obrigatório"),
  status:      z.enum(ALL_STATUSES_LIST),
  notes:       z.string().optional().nullable(),
});
type NewApptFormData = z.infer<typeof newApptSchema>;

const rescheduleSchema = z.object({
  date:        z.string().min(1, "Data é obrigatória"),
  time:        z.string().min(1, "Horário é obrigatório"),
  therapistId: z.number().optional().nullable(),
});
type RescheduleFormData = z.infer<typeof rescheduleSchema>;

/* ───────────────────────── HELPER: abbreviate name ─────────────────── */

function abbreviateName(full: string): string {
  const parts = full.trim().split(" ");
  if (parts.length <= 1) return full;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/* ═══════════════════════════════════════════════════════════════════════
   PATIENT BLOCK – small card rendered inside a grid cell
═══════════════════════════════════════════════════════════════════════ */

function PatientBlock({
  apt,
  compact,
  onOpen,
  onWhatsApp,
}: {
  apt: AppointmentType;
  compact: boolean;
  onOpen: () => void;
  onWhatsApp: (e: React.MouseEvent) => void;
}) {
  const cellClass = STATUS_CELL[apt.status] || "bg-gray-100 border-gray-300 text-gray-800";

  return (
    <div
      className={`rounded border text-[11px] leading-tight overflow-hidden cursor-pointer hover:brightness-95 transition-all ${cellClass}`}
      onClick={onOpen}
      title={`${apt.patientName} — ${STATUS_LABELS[apt.status] || apt.status}`}
    >
      <div className="px-1.5 py-1 flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">
            {compact ? abbreviateName(apt.patientName) : apt.patientName}
          </div>
          {!compact && (
            <div className="text-[10px] opacity-70 truncate">{apt.therapistName.split(" ")[0]}</div>
          )}
          <div className="text-[10px] font-medium opacity-80 mt-0.5">
            {STATUS_LABELS[apt.status] || apt.status}
          </div>
        </div>
        <button
          onClick={onWhatsApp}
          title="Enviar confirmação WhatsApp"
          className="shrink-0 text-green-600 hover:text-green-800 mt-0.5"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   WEEKLY EXCEL GRID
═══════════════════════════════════════════════════════════════════════ */

function WeeklyGrid({
  weekDays,
  apptsByDateAndTime,
  isLoadingAppts,
  onCellClick,
  onPatientClick,
  onWhatsApp,
  today,
}: {
  weekDays: Date[];
  apptsByDateAndTime: Map<string, AppointmentType[]>;
  isLoadingAppts: boolean;
  onCellClick: (date: string, time: string) => void;
  onPatientClick: (apt: AppointmentType) => void;
  onWhatsApp: (apt: AppointmentType, e: React.MouseEvent) => void;
  today: Date;
}) {
  const TIME_COL_W = "80px";
  const DAY_COL_W  = "minmax(110px, 1fr)";
  const gridCols   = `${TIME_COL_W} repeat(${weekDays.length}, ${DAY_COL_W})`;

  return (
    <div
      className="overflow-auto border border-border rounded-xl shadow-sm"
      style={{ maxHeight: "calc(100vh - 260px)" }}
    >
      {/* sticky header row */}
      <div
        className="grid sticky top-0 z-20 bg-muted/90 backdrop-blur border-b border-border shadow-sm"
        style={{ gridTemplateColumns: gridCols, minWidth: "600px" }}
      >
        <div className="py-2 px-2 text-[11px] font-semibold text-muted-foreground text-center border-r border-border sticky left-0 bg-muted/90 z-30">
          Horário
        </div>
        {weekDays.map(day => {
          const isToday = isSameDay(day, today);
          const dateStr = format(day, "yyyy-MM-dd");
          const total = Array.from(apptsByDateAndTime.entries())
            .filter(([k]) => k.startsWith(dateStr + "|"))
            .reduce((s, [, v]) => s + v.length, 0);
          return (
            <div
              key={day.toISOString()}
              className={`py-2 px-1 text-center border-r border-border last:border-r-0 ${isToday ? "bg-primary/10" : ""}`}
            >
              <div className={`text-[10px] font-semibold uppercase tracking-wide ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                {format(day, "EEE", { locale: ptBR })}
              </div>
              <div className={`text-base font-bold ${isToday ? "text-primary" : "text-foreground"}`}>
                {format(day, "dd")}
              </div>
              <div className={`text-[10px] ${isToday ? "text-primary/70" : "text-muted-foreground"}`}>
                {format(day, "MMM", { locale: ptBR })}
              </div>
              {total > 0 && (
                <div className={`text-[10px] font-semibold mt-0.5 px-1.5 py-0.5 rounded-full inline-block ${isToday ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {total} pac.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* slot rows */}
      <div style={{ minWidth: "600px" }}>
        {ALL_SLOTS.map((slot, slotIdx) => {
          const isAfternoonBreak = slot === "13:20";
          return (
            <div key={slot}>
              {isAfternoonBreak && (
                <div className="text-center text-[11px] text-muted-foreground bg-amber-50 border-y border-dashed border-amber-200 py-1 font-medium sticky left-0">
                  ☀️ Tarde
                </div>
              )}
              <div
                className={`grid border-b border-border last:border-b-0 ${slotIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}
                style={{ gridTemplateColumns: gridCols }}
              >
                {/* sticky time label */}
                <div className="py-2 px-2 border-r border-border sticky left-0 bg-inherit z-10 flex items-center justify-center">
                  <span className="text-[12px] font-mono font-semibold text-muted-foreground">{slot}</span>
                </div>
                {weekDays.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const key = `${dateStr}|${slot}`;
                  const apts = apptsByDateAndTime.get(key) || [];
                  const isToday = isSameDay(day, today);
                  return (
                    <div
                      key={dateStr}
                      className={`border-r border-border last:border-r-0 p-1 min-h-[52px] cursor-pointer hover:bg-primary/5 transition-colors ${isToday ? "bg-primary/[0.03]" : ""}`}
                      onClick={() => { if (apts.length === 0) onCellClick(dateStr, slot); }}
                    >
                      {isLoadingAppts ? (
                        <div className="h-8 bg-muted rounded animate-pulse m-1" />
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {apts.map(apt => (
                            <PatientBlock
                              key={apt.id}
                              apt={apt}
                              compact={apts.length > 2}
                              onOpen={() => onPatientClick(apt)}
                              onWhatsApp={(e) => onWhatsApp(apt, e)}
                            />
                          ))}
                          {apts.length === 0 && (
                            <div className="flex items-center justify-center h-8 opacity-0 hover:opacity-100 transition-opacity">
                              <Plus className="h-3.5 w-3.5 text-primary/40" />
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
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DAILY LIST VIEW
═══════════════════════════════════════════════════════════════════════ */

function DailyView({
  dateStr,
  apptsByDateAndTime,
  allApptsByDateAndTime,
  isLoadingAppts,
  onCellClick,
  onPatientClick,
  onWhatsApp,
}: {
  dateStr: string;
  apptsByDateAndTime: Map<string, AppointmentType[]>;
  allApptsByDateAndTime: Map<string, AppointmentType[]>;
  isLoadingAppts: boolean;
  onCellClick: (date: string, time: string) => void;
  onPatientClick: (apt: AppointmentType) => void;
  onWhatsApp: (apt: AppointmentType) => void;
}) {
  return (
    <div className="rounded-xl border border-border shadow-sm overflow-hidden">
      {/* header */}
      <div className="grid border-b border-border bg-muted/60" style={{ gridTemplateColumns: "80px 1fr" }}>
        <div className="py-3 px-3 text-[11px] font-semibold text-muted-foreground text-center border-r border-border">Horário</div>
        <div className="py-3 px-3 text-[11px] font-semibold text-muted-foreground">Pacientes</div>
      </div>

      {ALL_SLOTS.map((slot, slotIdx) => {
        const key = `${dateStr}|${slot}`;
        const apts = apptsByDateAndTime.get(key) || [];
        const totalInSlot = allApptsByDateAndTime.get(key)?.length ?? 0;
        const isAfternoonBreak = slot === "13:20";
        return (
          <div key={slot}>
            {isAfternoonBreak && (
              <div className="text-center text-[11px] text-muted-foreground bg-amber-50 border-y border-dashed border-amber-200 py-1 font-medium">
                ☀️ Tarde
              </div>
            )}
            <div
              className={`grid border-b border-border last:border-b-0 ${slotIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}
              style={{ gridTemplateColumns: "80px 1fr", minHeight: "60px" }}
            >
              <div
                className="py-3 px-2 border-r border-border flex flex-col items-center justify-start pt-3 gap-1 cursor-pointer hover:bg-primary/5"
                onClick={() => onCellClick(dateStr, slot)}
              >
                <span className="text-[12px] font-mono font-semibold text-muted-foreground">{slot}</span>
                {totalInSlot > 0 && (
                  <span className="text-[10px] bg-muted rounded px-1 text-muted-foreground">{totalInSlot} pac.</span>
                )}
              </div>
              <div className="p-2">
                {isLoadingAppts ? (
                  <div className="h-10 bg-muted rounded animate-pulse" />
                ) : apts.length === 0 ? (
                  <div
                    className="h-full min-h-[44px] flex items-center cursor-pointer hover:bg-primary/5 rounded transition-colors px-2"
                    onClick={() => onCellClick(dateStr, slot)}
                  >
                    <span className="text-xs text-muted-foreground/40 italic">
                      {totalInSlot > 0 ? `${totalInSlot} oculto(s) pelo filtro` : "Clique para agendar"}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {apts.map(apt => (
                      <div
                        key={apt.id}
                        className={`text-left rounded-lg border transition-colors flex-1 min-w-[180px] max-w-[320px] ${STATUS_CELL[apt.status] || "bg-gray-50 border-gray-200"}`}
                      >
                        <button className="w-full text-left p-3 pb-2" onClick={() => onPatientClick(apt)}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm leading-tight">{apt.patientName}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[apt.status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                              {STATUS_LABELS[apt.status] || apt.status}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {apt.therapistName}{apt.patientPhone && <span> · {apt.patientPhone}</span>}
                          </div>
                        </button>
                        <div className="px-3 pb-2 flex gap-2">
                          <button
                            onClick={() => onWhatsApp(apt)}
                            className="flex items-center gap-1 text-[11px] text-green-700 hover:text-green-800 font-medium"
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MONTHLY VIEW
═══════════════════════════════════════════════════════════════════════ */

function MonthlyView({
  currentMonth,
  apptsByDateAndTime,
  isLoadingAppts,
  onDayClick,
  today,
}: {
  currentMonth: Date;
  apptsByDateAndTime: Map<string, AppointmentType[]>;
  isLoadingAppts: boolean;
  onDayClick: (date: Date) => void;
  today: Date;
}) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // pad start (Mon=1 ... Sat=6; Sun=0→7)
  const startDow = getDay(monthStart);
  const padStart = startDow === 0 ? 6 : startDow - 1;
  const paddedDays: (Date | null)[] = [
    ...Array(padStart).fill(null),
    ...days,
  ];
  // pad end to complete last row
  while (paddedDays.length % 7 !== 0) paddedDays.push(null);

  const DOW_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <div className="rounded-xl border border-border shadow-sm overflow-hidden">
      {/* DOW header */}
      <div className="grid grid-cols-7 bg-muted/60 border-b border-border">
        {DOW_LABELS.map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold text-muted-foreground border-r border-border last:border-r-0">
            {d}
          </div>
        ))}
      </div>
      {/* weeks */}
      {Array.from({ length: paddedDays.length / 7 }).map((_, weekIdx) => (
        <div key={weekIdx} className="grid grid-cols-7 border-b border-border last:border-b-0">
          {paddedDays.slice(weekIdx * 7, weekIdx * 7 + 7).map((day, i) => {
            if (!day) {
              return <div key={i} className="min-h-[80px] bg-muted/20 border-r border-border last:border-r-0" />;
            }
            const dateStr = format(day, "yyyy-MM-dd");
            const dayApts: AppointmentType[] = [];
            for (const [k, v] of apptsByDateAndTime.entries()) {
              if (k.startsWith(dateStr + "|")) dayApts.push(...v);
            }
            const isToday = isSameDay(day, today);
            const inMonth = isSameMonth(day, currentMonth);
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[80px] p-1.5 border-r border-border last:border-r-0 cursor-pointer hover:bg-primary/5 transition-colors ${isToday ? "bg-primary/10" : !inMonth ? "bg-muted/30" : ""}`}
                onClick={() => onDayClick(day)}
              >
                <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                  {format(day, "d")}
                </div>
                {isLoadingAppts ? (
                  <div className="h-4 bg-muted rounded animate-pulse" />
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {dayApts.slice(0, 3).map(apt => (
                      <div
                        key={apt.id}
                        className={`text-[10px] px-1 py-0.5 rounded truncate font-medium ${STATUS_CELL[apt.status] || "bg-gray-100 text-gray-800 border-gray-200"} border`}
                      >
                        {apt.time} {abbreviateName(apt.patientName)}
                      </div>
                    ))}
                    {dayApts.length > 3 && (
                      <div className="text-[10px] text-muted-foreground font-medium px-1">
                        +{dayApts.length - 3} mais
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN AGENDA COMPONENT
═══════════════════════════════════════════════════════════════════════ */

export default function Agenda() {
  const appName = useAppName();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedTherapistId, setSelectedTherapistId] = useState<number | undefined>(undefined);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentType | null>(null);
  const [isNewApptOpen, setIsNewApptOpen] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"single" | "recurring">("single");
  const [viewMode, setViewMode] = useState<"semanal" | "diaria" | "mensal">("semanal");
  const [dailyDate, setDailyDate] = useState<Date>(new Date());
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPatient, setFilterPatient] = useState<string>("");

  const [recForm, setRecForm] = useState({
    patientId: "", therapistId: "", startDate: format(new Date(), "yyyy-MM-dd"),
    time: "08:00", recurrenceType: "semanal", weekDays: [] as number[],
    totalCount: "12", endDate: "", notes: "",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const weekStartStr  = format(currentWeekStart, "yyyy-MM-dd");
  const weekDays      = Array.from({ length: 6 }, (_, i) => addDays(currentWeekStart, i));
  const dailyDateStr  = format(dailyDate, "yyyy-MM-dd");

  const queryParams: Record<string, string | number> = viewMode === "semanal"
    ? { weekStart: weekStartStr }
    : viewMode === "diaria"
    ? { date: dailyDateStr }
    : { weekStart: format(startOfMonth(currentMonth), "yyyy-MM-dd") };
  if (selectedTherapistId) queryParams.therapistId = selectedTherapistId;

  const { data: appointments = [], isLoading: isLoadingAppts } = useListAppointments(queryParams, {
    query: { queryKey: getListAppointmentsQueryKey(queryParams) },
  });
  const { data: therapists = [] } = useListTherapists();
  const { data: patients = [] }   = useListPatients({});

  const updateStatus = useUpdateAppointmentStatus();
  const reschedule   = useRescheduleAppointment();
  const deleteAppt   = useDeleteAppointment();
  const createAppt   = useCreateAppointment();

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

  const allApptsByDateAndTime = useMemo(() => {
    const map = new Map<string, AppointmentType[]>();
    for (const apt of allAppts) {
      const key = `${apt.date}|${apt.time}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(apt);
    }
    return map;
  }, [allAppts]);

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
        onError: (err: any) => toast({ title: err?.message || "Erro ao remarcar sessão", variant: "destructive" }),
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
        onError: (err: any) => toast({ title: err?.message || err?.data?.error || "Erro ao criar agendamento", variant: "destructive" }),
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

  const sendWhatsApp = async (apt: AppointmentType, e?: React.MouseEvent) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    try {
      const data = await apiFetch<{ token: string }>(`/api/appointments/${apt.id}/whatsapp-token`, { method: "POST" });
      const base = window.location.origin + (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const confirmUrl = `${base}/confirmar?token=${data.token}`;
      const [y, m, day] = apt.date.split("-");
      const dateFormatted = `${day}/${m}/${y}`;
      const msg = encodeURIComponent(
        `Olá, ${apt.patientName.split(" ")[0]}! 👋\n` +
        `Você tem um atendimento agendado para ${dateFormatted} às ${apt.time} com ${apt.therapistName}.\n\n` +
        `Por favor, confirme sua presença clicando no link abaixo:\n${confirmUrl}\n\n` +
        `✅ Confirmar ou ❌ Cancelar`
      );
      const cleanPhone = apt.patientPhone.replace(/\D/g, "");
      window.open(`https://wa.me/55${cleanPhone}?text=${msg}`, "_blank");
      invalidate();
      toast({ title: "Link de confirmação enviado via WhatsApp!" });
    } catch (err: any) {
      toast({ title: err?.message || "Erro ao gerar link", variant: "destructive" });
    }
  };

  const openCreateModal = (date: string, time: string) => {
    setCreateMode("single");
    newApptForm.reset({ patientId: 0, therapistId: 0, date, time, status: "agendado", notes: null });
    setRecForm(p => ({ ...p, startDate: date, time }));
    setIsNewApptOpen(true);
  };

  const handlePrint = () => window.print();

  const today = new Date();
  const hasFilters = filterStatus !== "all" || filterPatient.trim() !== "";

  // Navigation helpers
  const navPrev = () => {
    if (viewMode === "semanal") setCurrentWeekStart(subWeeks(currentWeekStart, 1));
    else if (viewMode === "diaria") setDailyDate(addDays(dailyDate, -1));
    else setCurrentMonth(subMonths(currentMonth, 1));
  };
  const navNext = () => {
    if (viewMode === "semanal") setCurrentWeekStart(addWeeks(currentWeekStart, 1));
    else if (viewMode === "diaria") setDailyDate(addDays(dailyDate, 1));
    else setCurrentMonth(addMonths(currentMonth, 1));
  };
  const navToday = () => {
    if (viewMode === "semanal") setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    else if (viewMode === "diaria") setDailyDate(new Date());
    else setCurrentMonth(new Date());
  };

  const periodLabel = viewMode === "semanal"
    ? `${format(currentWeekStart, "dd 'de' MMMM", { locale: ptBR })} — ${format(addDays(currentWeekStart, 5), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
    : viewMode === "diaria"
    ? format(dailyDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* ─── TOP BAR ──────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground capitalize">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {(["diaria", "semanal", "mensal"] as const).map(mode => (
              <Button
                key={mode}
                variant={viewMode === mode ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-8 px-3 text-xs border-l first:border-l-0"
                onClick={() => setViewMode(mode)}
              >
                {mode === "diaria" ? "Dia" : mode === "semanal" ? "Semana" : "Mês"}
              </Button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={navPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={navToday}>
              <Calendar className="h-3.5 w-3.5 mr-1" /> Hoje
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={navNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Actions */}
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => {
            const defaultDate = viewMode === "diaria" ? dailyDateStr : format(currentWeekStart, "yyyy-MM-dd");
            openCreateModal(defaultDate, "08:00");
          }}>
            <Plus className="h-3.5 w-3.5" /> Novo Agendamento
          </Button>
        </div>
      </div>

      {/* ─── FILTERS ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
          <Filter className="h-3.5 w-3.5" /> Filtros:
        </div>
        <Select value={selectedTherapistId?.toString() ?? "all"} onValueChange={v => setSelectedTherapistId(v === "all" ? undefined : parseInt(v))}>
          <SelectTrigger className="h-7 text-xs w-[170px]"><SelectValue placeholder="Todos os fisios" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os fisioterapeutas</SelectItem>
            {(therapists as TherapistType[]).map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-7 text-xs w-[145px]"><SelectValue placeholder="Todos os status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="h-7 text-xs pl-7 w-[150px]" placeholder="Buscar paciente..." value={filterPatient} onChange={e => setFilterPatient(e.target.value)} />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground"
            onClick={() => { setFilterStatus("all"); setFilterPatient(""); setSelectedTherapistId(undefined); }}>
            <X className="h-3.5 w-3.5 mr-1" /> Limpar
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredAppts.length} agendamento{filteredAppts.length !== 1 ? "s" : ""}{hasFilters ? " (filtrado)" : ""}
        </span>
      </div>

      {/* ─── LEGEND ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <span key={key} className={`text-[11px] px-2 py-0.5 rounded border font-medium ${STATUS_COLORS[key]}`}>{label}</span>
        ))}
      </div>

      {/* ─── GRID / VIEW ─────────────────────────────────── */}
      {viewMode === "semanal" && (
        <WeeklyGrid
          weekDays={weekDays}
          apptsByDateAndTime={apptsByDateAndTime}
          isLoadingAppts={isLoadingAppts}
          onCellClick={openCreateModal}
          onPatientClick={setSelectedAppointment}
          onWhatsApp={sendWhatsApp}
          today={today}
        />
      )}

      {viewMode === "diaria" && (
        <DailyView
          dateStr={dailyDateStr}
          apptsByDateAndTime={apptsByDateAndTime}
          allApptsByDateAndTime={allApptsByDateAndTime}
          isLoadingAppts={isLoadingAppts}
          onCellClick={openCreateModal}
          onPatientClick={setSelectedAppointment}
          onWhatsApp={sendWhatsApp}
        />
      )}

      {viewMode === "mensal" && (
        <MonthlyView
          currentMonth={currentMonth}
          apptsByDateAndTime={apptsByDateAndTime}
          isLoadingAppts={isLoadingAppts}
          onDayClick={(day) => { setDailyDate(day); setViewMode("diaria"); }}
          today={today}
        />
      )}

      {/* ─── APPOINTMENT DETAIL PANEL ───────────────────── */}
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
            <button
              onClick={() => sendWhatsApp(selectedAppointment)}
              className="w-full flex items-center gap-2 text-sm text-green-600 hover:text-green-700 font-medium border border-green-200 bg-green-50 rounded-lg px-3 py-2 transition-colors hover:bg-green-100"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar confirmação via WhatsApp
            </button>

            {/* Quick status actions */}
            <div className="flex gap-2 flex-wrap">
              {selectedAppointment.status !== "presente" && (
                <button onClick={() => handleStatusChange("presente")}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200 border border-green-200 font-medium">
                  <Check className="h-3.5 w-3.5" /> Presente
                </button>
              )}
              {selectedAppointment.status !== "confirmado" && selectedAppointment.status !== "presente" && selectedAppointment.status !== "falta" && (
                <button onClick={() => handleStatusChange("confirmado")}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded bg-teal-100 text-teal-700 hover:bg-teal-200 border border-teal-200 font-medium">
                  <Check className="h-3.5 w-3.5" /> Confirmar
                </button>
              )}
              {selectedAppointment.status !== "falta" && (
                <button onClick={() => handleStatusChange("falta")}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 font-medium">
                  <UserX className="h-3.5 w-3.5" /> Falta
                </button>
              )}
              {selectedAppointment.status !== "cancelado" && selectedAppointment.status !== "presente" && (
                <button onClick={() => handleStatusChange("cancelado")}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300 font-medium">
                  <Ban className="h-3.5 w-3.5" /> Cancelar
                </button>
              )}
            </div>

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
                onClick={() => {
                  rescheduleForm.reset({ date: format(new Date(), "yyyy-MM-dd"), time: "08:00", therapistId: selectedAppointment.therapistId });
                  setIsRescheduleOpen(true);
                }}>
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

      {/* ─── RESCHEDULE DIALOG ───────────────────────────── */}
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

      {/* ─── NEW APPOINTMENT DIALOG ──────────────────────── */}
      <Dialog open={isNewApptOpen} onOpenChange={setIsNewApptOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Agendamento</DialogTitle></DialogHeader>
          <Tabs value={createMode} onValueChange={v => setCreateMode(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">Sessão Única</TabsTrigger>
              <TabsTrigger value="recurring"><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Recorrente</TabsTrigger>
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
                        <SelectContent>{(patients as PatientType[]).map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={newApptForm.control} name="therapistId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fisioterapeuta</FormLabel>
                      <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString() ?? ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione um fisioterapeuta" /></SelectTrigger></FormControl>
                        <SelectContent>{(therapists as TherapistType[]).map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}</SelectContent>
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
                        <SelectContent>{Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
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
                    <SelectContent>{(patients as PatientType[]).map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fisioterapeuta</Label>
                  <Select value={recForm.therapistId} onValueChange={v => setRecForm(p => ({ ...p, therapistId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione um fisioterapeuta" /></SelectTrigger>
                    <SelectContent>{(therapists as TherapistType[]).map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}</SelectContent>
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
                    <RefreshCw className="h-4 w-4 mr-2" /> Criar Recorrência
                  </Button>
                </DialogFooter>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ─── PRINT STYLES ────────────────────────────────── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .agenda-print, .agenda-print * { visibility: visible; }
          .agenda-print { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: landscape; margin: 1cm; }
        }
      `}</style>
    </div>
  );
}
