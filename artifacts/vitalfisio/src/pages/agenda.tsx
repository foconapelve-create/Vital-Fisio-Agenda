import { useState, useMemo } from "react";
import {
  useListAppointments,
  useListTherapists,
  useCreateAppointment,
  useUpdateAppointmentStatus,
  useRescheduleAppointment,
  useDeleteAppointment,
  getListAppointmentsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useListPatients } from "@workspace/api-client-react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  X,
} from "lucide-react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  presente: "Presente",
  falta: "Falta",
  cancelado: "Cancelado",
  remarcado: "Remarcado",
  encaixe: "Encaixe",
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

const STATUS_BG_COLORS: Record<string, string> = {
  agendado: "bg-blue-50 border-blue-200 hover:bg-blue-100",
  confirmado: "bg-teal-50 border-teal-200 hover:bg-teal-100",
  presente: "bg-green-50 border-green-200 hover:bg-green-100",
  falta: "bg-orange-50 border-orange-200 hover:bg-orange-100",
  cancelado: "bg-red-50 border-red-200 hover:bg-red-100",
  remarcado: "bg-purple-50 border-purple-200 hover:bg-purple-100",
  encaixe: "bg-amber-50 border-amber-200 hover:bg-amber-100",
};

const MORNING_SLOTS = ["08:00", "08:40", "09:20", "10:00", "10:40", "11:20"];
const AFTERNOON_SLOTS = ["13:30", "14:10", "14:50", "15:30", "16:10", "16:50"];
const ALL_SLOTS = [...MORNING_SLOTS, ...AFTERNOON_SLOTS];

type AppointmentType = {
  id: number;
  patientId: number;
  therapistId: number;
  date: string;
  time: string;
  status: string;
  notes?: string | null;
  originalAppointmentId?: number | null;
  patientName: string;
  patientPhone: string;
  therapistName: string;
  therapistSpecialty: string;
  createdAt: string;
  updatedAt: string;
};

type TherapistType = {
  id: number;
  name: string;
  specialty: string;
  phone: string;
  availableHours?: string | null;
};

type PatientType = {
  id: number;
  name: string;
  phone: string;
};

const newApptSchema = z.object({
  patientId: z.number().min(1, "Selecione um paciente"),
  therapistId: z.number().min(1, "Selecione um fisioterapeuta"),
  date: z.string().min(1, "Data é obrigatória"),
  time: z.string().min(1, "Horário é obrigatório"),
  status: z.enum(["agendado", "confirmado", "presente", "falta", "cancelado", "remarcado", "encaixe"]),
  notes: z.string().optional().nullable(),
});

type NewApptFormData = z.infer<typeof newApptSchema>;

const rescheduleSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  time: z.string().min(1, "Horário é obrigatório"),
  therapistId: z.number().optional().nullable(),
});

type RescheduleFormData = z.infer<typeof rescheduleSchema>;

export default function Agenda() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    return startOfWeek(today, { weekStartsOn: 1 });
  });
  const [selectedTherapistId, setSelectedTherapistId] = useState<number | undefined>(undefined);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentType | null>(null);
  const [isNewApptOpen, setIsNewApptOpen] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const weekStartStr = format(currentWeekStart, "yyyy-MM-dd");
  const weekDays = Array.from({ length: 6 }, (_, i) => addDays(currentWeekStart, i));

  const queryParams: Record<string, string | number> = { weekStart: weekStartStr };
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

  const newApptForm = useForm<NewApptFormData>({
    resolver: zodResolver(newApptSchema),
    defaultValues: {
      patientId: 0,
      therapistId: 0,
      date: format(new Date(), "yyyy-MM-dd"),
      time: "08:00",
      status: "agendado",
      notes: null,
    },
  });

  const rescheduleForm = useForm<RescheduleFormData>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      time: "08:00",
      therapistId: null,
    },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey(queryParams) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  }

  const apptsByDateAndTime = useMemo(() => {
    const map = new Map<string, AppointmentType[]>();
    for (const apt of appointments as AppointmentType[]) {
      const key = `${apt.date}|${apt.time}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(apt);
    }
    return map;
  }, [appointments]);

  const handleStatusChange = (status: string) => {
    if (!selectedAppointment) return;
    updateStatus.mutate(
      { id: selectedAppointment.id, data: { status: status as AppointmentType["status"] } },
      {
        onSuccess: (updated) => {
          toast({ title: `Status atualizado: ${STATUS_LABELS[status]}` });
          setSelectedAppointment(updated as AppointmentType);
          invalidate();
        },
        onError: () => {
          toast({ title: "Erro ao atualizar status", variant: "destructive" });
        },
      }
    );
  };

  const handleReschedule = (data: RescheduleFormData) => {
    if (!selectedAppointment) return;
    reschedule.mutate(
      {
        id: selectedAppointment.id,
        data: {
          date: data.date,
          time: data.time,
          therapistId: data.therapistId ?? null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Sessão remarcada com sucesso" });
          setIsRescheduleOpen(false);
          setSelectedAppointment(null);
          invalidate();
        },
        onError: (err: any) => {
          toast({ title: err?.error?.error || "Erro ao remarcar", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!selectedAppointment) return;
    deleteAppt.mutate(
      { id: selectedAppointment.id },
      {
        onSuccess: () => {
          toast({ title: "Agendamento removido" });
          setSelectedAppointment(null);
          invalidate();
        },
        onError: () => {
          toast({ title: "Erro ao remover", variant: "destructive" });
        },
      }
    );
  };

  const onCreateAppt = (data: NewApptFormData) => {
    createAppt.mutate(
      {
        data: {
          ...data,
          notes: data.notes || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Agendamento criado" });
          setIsNewApptOpen(false);
          invalidate();
        },
        onError: (err: any) => {
          toast({ title: err?.error?.error || "Erro ao criar agendamento", variant: "destructive" });
        },
      }
    );
  };

  const today = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda Semanal</h1>
          <p className="text-muted-foreground mt-1">
            {format(currentWeekStart, "dd 'de' MMMM", { locale: ptBR })} —{" "}
            {format(addDays(currentWeekStart, 5), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select
            value={selectedTherapistId?.toString() ?? "all"}
            onValueChange={(v) => setSelectedTherapistId(v === "all" ? undefined : parseInt(v))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os fisioterapeutas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fisioterapeutas</SelectItem>
              {(therapists as TherapistType[]).map((t) => (
                <SelectItem key={t.id} value={t.id.toString()}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setIsNewApptOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* Status Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <span key={key} className={`text-xs px-2 py-1 rounded border font-medium ${STATUS_COLORS[key]}`}>
            {label}
          </span>
        ))}
      </div>

      {/* Weekly Grid */}
      <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
        <div className="min-w-[700px]">
          {/* Header */}
          <div className="grid grid-cols-7 bg-muted/60 border-b border-border">
            <div className="py-3 px-3 text-xs font-semibold text-muted-foreground text-center border-r border-border">
              Horário
            </div>
            {weekDays.map((day) => {
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={day.toISOString()}
                  className={`py-3 px-2 text-center border-r border-border last:border-r-0 ${isToday ? "bg-primary/10" : ""}`}
                >
                  <div className={`text-xs font-semibold uppercase ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {format(day, "EEE", { locale: ptBR })}
                  </div>
                  <div className={`text-lg font-bold mt-0.5 ${isToday ? "text-primary" : "text-foreground"}`}>
                    {format(day, "dd")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time Slots */}
          {ALL_SLOTS.map((slot, slotIndex) => {
            const isSectionBreak = slot === "13:30";
            return (
              <div key={slot}>
                {isSectionBreak && (
                  <div className="grid grid-cols-7 bg-muted/30 border-y border-dashed border-muted-foreground/20">
                    <div className="py-1 px-3 text-xs text-muted-foreground col-span-7 text-center">
                      Intervalo — tarde
                    </div>
                  </div>
                )}
                <div
                  className={`grid grid-cols-7 border-b border-border last:border-b-0 ${slotIndex % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
                  style={{ minHeight: "68px" }}
                >
                  <div className="py-2 px-3 text-xs font-mono text-muted-foreground font-medium border-r border-border flex items-start justify-center pt-3">
                    {slot}
                  </div>
                  {weekDays.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const key = `${dateStr}|${slot}`;
                    const apts = apptsByDateAndTime.get(key) || [];
                    const isToday = isSameDay(day, today);
                    return (
                      <div
                        key={dateStr}
                        className={`py-1.5 px-1.5 border-r border-border last:border-r-0 ${isToday ? "bg-primary/5" : ""}`}
                      >
                        {isLoadingAppts ? (
                          <div className="h-10 bg-muted rounded animate-pulse" />
                        ) : (
                          <div className="space-y-1">
                            {apts.map((apt) => (
                              <button
                                key={apt.id}
                                onClick={() => setSelectedAppointment(apt)}
                                className={`w-full text-left text-xs rounded border p-1.5 transition-colors cursor-pointer ${STATUS_BG_COLORS[apt.status] || "bg-gray-50 border-gray-200 hover:bg-gray-100"}`}
                              >
                                <div className="font-semibold truncate leading-tight">{apt.patientName.split(" ")[0]}</div>
                                <div className="text-[10px] opacity-70 truncate">{apt.therapistName.split(" ").slice(-1)[0]}</div>
                              </button>
                            ))}
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paciente</span>
                <span className="font-medium">{selectedAppointment.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fisioterapeuta</span>
                <span className="font-medium">{selectedAppointment.therapistName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data</span>
                <span className="font-medium">
                  {format(new Date(selectedAppointment.date + "T12:00:00"), "dd/MM/yyyy")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Horário</span>
                <span className="font-medium">{selectedAppointment.time}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className={STATUS_COLORS[selectedAppointment.status]}>
                  {STATUS_LABELS[selectedAppointment.status]}
                </Badge>
              </div>
              {selectedAppointment.notes && (
                <div>
                  <span className="text-muted-foreground block mb-1">Observações</span>
                  <p className="text-foreground italic">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Alterar Status</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => handleStatusChange(key)}
                    disabled={selectedAppointment.status === key || updateStatus.isPending}
                    className={`text-xs px-2.5 py-1.5 rounded border font-medium transition-opacity ${STATUS_COLORS[key]} ${selectedAppointment.status === key ? "opacity-100 ring-2 ring-offset-1 ring-current" : "opacity-70 hover:opacity-100"} disabled:cursor-default`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  rescheduleForm.reset({
                    date: format(new Date(), "yyyy-MM-dd"),
                    time: "08:00",
                    therapistId: selectedAppointment.therapistId,
                  });
                  setIsRescheduleOpen(true);
                }}
              >
                Remarcar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleteAppt.isPending}
              >
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Dialog */}
      <Dialog open={isRescheduleOpen} onOpenChange={setIsRescheduleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remarcar Sessão</DialogTitle>
          </DialogHeader>
          <Form {...rescheduleForm}>
            <form onSubmit={rescheduleForm.handleSubmit(handleReschedule)} className="space-y-4">
              <FormField
                control={rescheduleForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova Data</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={rescheduleForm.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Novo Horário</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="" disabled>Manhã</SelectItem>
                        {MORNING_SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        <SelectItem value="interval" disabled>Tarde</SelectItem>
                        {AFTERNOON_SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={rescheduleForm.control}
                name="therapistId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fisioterapeuta (opcional)</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v ? parseInt(v) : null)}
                      value={field.value?.toString() ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Manter o mesmo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Manter o mesmo</SelectItem>
                        {(therapists as TherapistType[]).map((t) => (
                          <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
          </DialogHeader>
          <Form {...newApptForm}>
            <form onSubmit={newApptForm.handleSubmit(onCreateAppt)} className="space-y-4">
              <FormField
                control={newApptForm.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paciente</FormLabel>
                    <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString() ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um paciente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(patients as PatientType[]).map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={newApptForm.control}
                name="therapistId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fisioterapeuta</FormLabel>
                    <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString() ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um fisioterapeuta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(therapists as TherapistType[]).map((t) => (
                          <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={newApptForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={newApptForm.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MORNING_SLOTS.map((s) => <SelectItem key={s} value={s}>{s} (manhã)</SelectItem>)}
                          {AFTERNOON_SLOTS.map((s) => <SelectItem key={s} value={s}>{s} (tarde)</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={newApptForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={newApptForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observações opcionais..."
                        {...field}
                        value={field.value ?? ""}
                        rows={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsNewApptOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createAppt.isPending}>Criar Agendamento</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
