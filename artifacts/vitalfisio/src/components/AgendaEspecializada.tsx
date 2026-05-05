import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft, ChevronRight, Plus, MessageCircle, Check, UserX, Ban, X, Pencil, Trash2, Filter,
} from "lucide-react";
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

/* ─── Time slots ─────────────────────────────────────────────────────── */
const MORNING_SLOTS  = ["08:00", "08:45", "09:30", "10:30", "11:10"];
const AFTERNOON_SLOTS= ["13:20", "14:00", "14:40", "15:40", "16:20"];
const ALL_SLOTS = [...MORNING_SLOTS, ...AFTERNOON_SLOTS];

/* ─── Status maps ────────────────────────────────────────────────────── */
const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado", confirmado: "Confirmado", presente: "Presente",
  falta: "Falta", cancelado: "Cancelado", aguardando_confirmacao: "Ag. Confirmação",
  mensagem_enviada: "Msg. Enviada",
};

const STATUS_CELL: Record<string, string> = {
  agendado:              "bg-blue-100 border-blue-300 text-blue-900",
  mensagem_enviada:      "bg-sky-100 border-sky-300 text-sky-900",
  aguardando_confirmacao:"bg-yellow-100 border-yellow-300 text-yellow-900",
  confirmado:            "bg-emerald-100 border-emerald-400 text-emerald-900",
  presente:              "bg-green-200 border-green-400 text-green-900",
  falta:                 "bg-red-200 border-red-400 text-red-900",
  cancelado:             "bg-slate-100 border-slate-300 text-slate-600",
};

const STATUS_COLORS: Record<string, string> = {
  agendado:              "bg-blue-100 text-blue-800 border-blue-200",
  mensagem_enviada:      "bg-sky-100 text-sky-800 border-sky-200",
  aguardando_confirmacao:"bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmado:            "bg-teal-100 text-teal-800 border-teal-200",
  presente:              "bg-green-100 text-green-800 border-green-200",
  falta:                 "bg-orange-100 text-orange-800 border-orange-200",
  cancelado:             "bg-slate-100 text-slate-700 border-slate-300",
};

const STATUS_OPTIONS = [
  "agendado","mensagem_enviada","aguardando_confirmacao","confirmado","presente","falta","cancelado",
];

const fmtDate = (s: string) => { const [y,m,d] = s.split("-"); return `${d}/${m}/${y}`; };

function abbreviateName(full: string) {
  const parts = full.trim().split(" ");
  if (parts.length <= 1) return full;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

type Appointment = {
  id: number; agendaType: string;
  patientId: number | null; therapistId: number | null;
  patientName: string; patientPhone: string | null;
  therapistName: string; therapistSpecialty: string | null;
  date: string; time: string; status: string; notes: string | null;
};
type Patient    = { id: number; name: string; phone: string };
type Therapist  = { id: number; name: string; specialty: string };

const emptyForm = {
  patientId: "", therapistId: "", date: "", time: "",
  status: "agendado", notes: "",
};

function makeWhatsAppLink(apt: Appointment, clinicName: string): string {
  const phone = apt.patientPhone?.replace(/\D/g, "");
  if (!phone) return "";
  const d = fmtDate(apt.date);
  const msg = `Olá *${apt.patientName}*, tudo bem?\nPassando para confirmar sua consulta em *${clinicName}* no dia *${d}* às *${apt.time}*.\nPor favor confirme sua presença. Obrigado!`;
  return `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`;
}

/* ─── PatientBlock ──────────────────────────────────────────────────── */
function PatientBlock({ apt, compact, onOpen, onWhatsApp }: {
  apt: Appointment; compact: boolean;
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
          {!compact && apt.therapistName && (
            <div className="text-[10px] opacity-70 truncate">{apt.therapistName.split(" ")[0]}</div>
          )}
          <div className="text-[10px] font-medium opacity-80 mt-0.5">
            {STATUS_LABELS[apt.status] || apt.status}
          </div>
        </div>
        <button onClick={onWhatsApp} title="Enviar WhatsApp" className="shrink-0 text-green-600 hover:text-green-800 mt-0.5">
          <MessageCircle className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── WeeklyGrid ────────────────────────────────────────────────────── */
function WeeklyGrid({ weekDays, apptsByKey, isLoading, onCellClick, onPatientClick, onWhatsApp, today }: {
  weekDays: Date[];
  apptsByKey: Map<string, Appointment[]>;
  isLoading: boolean;
  onCellClick: (date: string, time: string) => void;
  onPatientClick: (apt: Appointment) => void;
  onWhatsApp: (apt: Appointment, e: React.MouseEvent) => void;
  today: Date;
}) {
  const TIME_COL_W = "80px";
  const DAY_COL_W  = "minmax(110px, 1fr)";
  const gridCols   = `${TIME_COL_W} repeat(${weekDays.length}, ${DAY_COL_W})`;

  return (
    <div className="overflow-auto border border-border rounded-xl shadow-sm" style={{ maxHeight: "calc(100vh - 260px)" }}>
      <div className="grid sticky top-0 z-20 bg-muted/90 backdrop-blur border-b border-border shadow-sm"
        style={{ gridTemplateColumns: gridCols, minWidth: "600px" }}>
        <div className="py-2 px-2 text-[11px] font-semibold text-muted-foreground text-center border-r border-border sticky left-0 bg-muted/90 z-30">Horário</div>
        {weekDays.map(day => {
          const isToday = isSameDay(day, today);
          const dateStr = format(day, "yyyy-MM-dd");
          const total = Array.from(apptsByKey.entries()).filter(([k]) => k.startsWith(dateStr + "|")).reduce((s, [,v]) => s + v.length, 0);
          return (
            <div key={day.toISOString()} className={`py-2 px-1 text-center border-r border-border last:border-r-0 ${isToday ? "bg-primary/10" : ""}`}>
              <div className={`text-[10px] font-semibold uppercase tracking-wide ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                {format(day, "EEE", { locale: ptBR })}
              </div>
              <div className={`text-base font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{format(day, "dd")}</div>
              <div className={`text-[10px] ${isToday ? "text-primary/70" : "text-muted-foreground"}`}>{format(day, "MMM", { locale: ptBR })}</div>
              {total > 0 && (
                <div className={`text-[10px] font-semibold mt-0.5 px-1.5 py-0.5 rounded-full inline-block ${isToday ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {total} pac.
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ minWidth: "600px" }}>
        {ALL_SLOTS.map((slot, idx) => {
          const isAfternoon = slot === "13:20";
          return (
            <div key={slot}>
              {isAfternoon && (
                <div className="text-center text-[11px] text-muted-foreground bg-amber-50 border-y border-dashed border-amber-200 py-1 font-medium">
                  ☀️ Tarde
                </div>
              )}
              <div className={`grid border-b border-border last:border-b-0 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}
                style={{ gridTemplateColumns: gridCols }}>
                <div className="py-2 px-2 border-r border-border sticky left-0 bg-inherit z-10 flex items-center justify-center">
                  <span className="text-[12px] font-mono font-semibold text-muted-foreground">{slot}</span>
                </div>
                {weekDays.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const key = `${dateStr}|${slot}`;
                  const apts = apptsByKey.get(key) || [];
                  const isToday = isSameDay(day, today);
                  return (
                    <div key={dateStr}
                      className={`border-r border-border last:border-r-0 p-1 min-h-[52px] cursor-pointer hover:bg-primary/5 transition-colors ${isToday ? "bg-primary/[0.03]" : ""}`}
                      onClick={() => { if (apts.length === 0) onCellClick(dateStr, slot); }}>
                      {isLoading ? (
                        <div className="h-8 bg-muted rounded animate-pulse m-1" />
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {apts.map(apt => (
                            <PatientBlock key={apt.id} apt={apt} compact={apts.length > 2}
                              onOpen={() => onPatientClick(apt)}
                              onWhatsApp={(e) => onWhatsApp(apt, e)} />
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
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export function AgendaEspecializada({ agendaType, title, clinicName }: {
  agendaType: "pelvica" | "bebe";
  title: string;
  clinicName: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = new Date();

  const [currentWeek, setCurrentWeek] = useState(startOfWeek(today, { weekStartsOn: 1 }));
  const [filterTherapist, setFilterTherapist] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);
  const [deleteApt, setDeleteApt] = useState<Appointment | null>(null);
  const [detailApt, setDetailApt] = useState<Appointment | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const weekStart = format(currentWeek, "yyyy-MM-dd");
  const weekDays = Array.from({ length: 6 }, (_, i) => addDays(currentWeek, i));

  const qKey = ["agenda-esp", agendaType, weekStart, filterTherapist];

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: qKey,
    queryFn: () => {
      const params = new URLSearchParams({ agendaType, weekStart });
      if (filterTherapist !== "all") params.set("therapistId", filterTherapist);
      return apiFetch(`/api/agenda-esp/appointments?${params}`);
    },
  });

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["patients-list"],
    queryFn: () => apiFetch("/api/patients"),
  });

  const { data: therapists = [] } = useQuery<Therapist[]>({
    queryKey: ["therapists"],
    queryFn: () => apiFetch("/api/therapists"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["agenda-esp", agendaType] });

  const createMut = useMutation({
    mutationFn: (d: any) => apiFetch("/api/agenda-esp/appointments", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { toast({ title: "Agendamento criado!" }); invalidate(); setDialogOpen(false); },
    onError: (e: any) => toast({ title: e.message || "Erro ao criar agendamento", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => apiFetch(`/api/agenda-esp/appointments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Agendamento atualizado!" }); invalidate(); setDialogOpen(false); setEditingApt(null); setDetailApt(null); },
    onError: (e: any) => toast({ title: e.message || "Erro ao atualizar", variant: "destructive" }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: any) => apiFetch(`/api/agenda-esp/appointments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { invalidate(); setDetailApt(null); },
    onError: (e: any) => toast({ title: e.message || "Erro ao atualizar status", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/agenda-esp/appointments/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Agendamento removido" }); invalidate(); setDeleteApt(null); setDetailApt(null); },
    onError: (e: any) => toast({ title: e.message || "Erro ao remover", variant: "destructive" }),
  });

  const apptsByKey = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const apt of appointments) {
      const key = `${apt.date}|${apt.time}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(apt);
    }
    return map;
  }, [appointments]);

  function openCreate(date?: string, time?: string) {
    setEditingApt(null);
    setForm({ ...emptyForm, date: date || format(today, "yyyy-MM-dd"), time: time || "08:00" });
    setDetailApt(null);
    setDialogOpen(true);
  }

  function openEdit(apt: Appointment) {
    setEditingApt(apt);
    setForm({
      patientId: apt.patientId?.toString() || "",
      therapistId: apt.therapistId?.toString() || "",
      date: apt.date, time: apt.time,
      status: apt.status, notes: apt.notes || "",
    });
    setDetailApt(null);
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.patientId || !form.therapistId || !form.date || !form.time) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" }); return;
    }
    const payload = {
      agendaType, patientId: parseInt(form.patientId),
      therapistId: parseInt(form.therapistId),
      date: form.date, time: form.time, status: form.status, notes: form.notes || null,
    };
    if (editingApt) updateMut.mutate({ id: editingApt.id, data: payload });
    else createMut.mutate(payload);
  }

  function handleWhatsApp(apt: Appointment, e: React.MouseEvent) {
    e.stopPropagation();
    const link = makeWhatsAppLink(apt, clinicName);
    if (!link) { toast({ title: "Paciente sem telefone cadastrado", variant: "destructive" }); return; }
    window.open(link, "_blank");
    statusMut.mutate({ id: apt.id, status: "mensagem_enviada" });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Agendamentos independentes para esta especialidade</p>
        </div>
        <Button className="gap-1.5" onClick={() => openCreate()}>
          <Plus className="h-4 w-4" /> Novo Agendamento
        </Button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentWeek(w => subWeeks(w, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-2 min-w-[200px] text-center">
            {format(currentWeek, "d 'de' MMM", { locale: ptBR })} — {format(addDays(currentWeek, 5), "d 'de' MMM, yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentWeek(w => addWeeks(w, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCurrentWeek(startOfWeek(today, { weekStartsOn: 1 }))}>
          Hoje
        </Button>
        <div className="flex items-center gap-1.5 ml-auto">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterTherapist} onValueChange={setFilterTherapist}>
            <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Todos os profissionais" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os profissionais</SelectItem>
              {(therapists as Therapist[]).map(t => (
                <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid */}
      <WeeklyGrid
        weekDays={weekDays}
        apptsByKey={apptsByKey}
        isLoading={isLoading}
        onCellClick={(date, time) => openCreate(date, time)}
        onPatientClick={apt => setDetailApt(apt)}
        onWhatsApp={handleWhatsApp}
        today={today}
      />

      {/* ── Detail / status dialog ───────────────────────────────────────── */}
      <Dialog open={!!detailApt && !dialogOpen} onOpenChange={o => !o && setDetailApt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{detailApt?.patientName}</span>
              <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[detailApt?.status || ""] || "")}>
                {STATUS_LABELS[detailApt?.status || ""] || detailApt?.status}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {detailApt && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
                <span><strong>Data:</strong> {fmtDate(detailApt.date)}</span>
                <span><strong>Horário:</strong> {detailApt.time}</span>
                <span className="col-span-2"><strong>Profissional:</strong> {detailApt.therapistName}{detailApt.therapistSpecialty ? ` · ${detailApt.therapistSpecialty}` : ""}</span>
                {detailApt.patientPhone && <span className="col-span-2"><strong>Telefone:</strong> {detailApt.patientPhone}</span>}
              </div>
              {detailApt.notes && <p className="text-sm bg-muted/50 rounded p-2 italic">{detailApt.notes}</p>}

              <div className="border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Alterar status:</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300"
                    onClick={() => statusMut.mutate({ id: detailApt.id, status: "presente" })}>
                    <Check className="h-3 w-3" /> Presente
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-teal-700 border-teal-300"
                    onClick={() => statusMut.mutate({ id: detailApt.id, status: "confirmado" })}>
                    Confirmado
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-orange-600 border-orange-300"
                    onClick={() => statusMut.mutate({ id: detailApt.id, status: "falta" })}>
                    <UserX className="h-3 w-3" /> Falta
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-600 border-red-300"
                    onClick={() => statusMut.mutate({ id: detailApt.id, status: "cancelado" })}>
                    <Ban className="h-3 w-3" /> Cancelado
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 border-t pt-3">
                <Button size="sm" variant="outline" className="gap-1"
                  onClick={() => { const link = makeWhatsAppLink(detailApt, clinicName); if (link) { window.open(link, "_blank"); statusMut.mutate({ id: detailApt.id, status: "mensagem_enviada" }); } else toast({ title: "Sem telefone cadastrado", variant: "destructive" }); }}>
                  <MessageCircle className="h-3.5 w-3.5 text-green-600" /> WhatsApp
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(detailApt)}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-red-600 border-red-300 ml-auto"
                  onClick={() => { setDeleteApt(detailApt); setDetailApt(null); }}>
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create/Edit dialog ───────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) { setDialogOpen(false); setEditingApt(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingApt ? "Editar Agendamento" : "Novo Agendamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Paciente *</Label>
              <Select value={form.patientId} onValueChange={v => setForm(f => ({ ...f, patientId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {(patients as Patient[]).map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Profissional *</Label>
              <Select value={form.therapistId} onValueChange={v => setForm(f => ({ ...f, therapistId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o profissional" /></SelectTrigger>
                <SelectContent>
                  {(therapists as Therapist[]).map(t => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Data *</Label>
                <Input type="date" className="mt-1" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Horário *</Label>
                <Select value={form.time} onValueChange={v => setForm(f => ({ ...f, time: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Horário" /></SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Manhã</div>
                    {MORNING_SLOTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-t mt-1">Tarde</div>
                    {AFTERNOON_SLOTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Observações</Label>
              <Textarea className="mt-1 resize-none" rows={2} placeholder="Observações sobre o agendamento..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingApt(null); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {editingApt ? "Salvar" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ───────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteApt} onOpenChange={o => !o && setDeleteApt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o agendamento de <strong>{deleteApt?.patientName}</strong> do dia <strong>{deleteApt ? fmtDate(deleteApt.date) : ""}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteApt && deleteMut.mutate(deleteApt.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
