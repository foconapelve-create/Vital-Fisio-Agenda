import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronLeft, ChevronRight, X, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const SLOTS = [
  "07:00","07:30","08:00","08:30","09:00","09:30",
  "10:00","10:30","11:00","11:30","12:00","12:30",
  "13:00","13:30","14:00","14:30","15:00","15:30",
  "16:00","16:30","17:00","17:30","18:00",
];

function fmt(date: Date) {
  return date.toISOString().split("T")[0];
}

function fmtDisplay(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function weekday(dateStr: string) {
  const days = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const d = new Date(dateStr + "T12:00:00");
  return days[d.getDay()];
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { credentials: "include", ...opts });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erro ${res.status}`);
  }
  return res.json();
}

export default function AgendaRecursos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(fmt(new Date()));
  const [therapistFilter, setTherapistFilter] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [dragApt, setDragApt] = useState<any>(null);
  const [dropTarget, setDropTarget] = useState<{ resourceId: number; time: string } | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editApt, setEditApt] = useState<any>(null);
  const [form, setForm] = useState({ patientId: "", therapistId: "", resourceId: "", time: "", notes: "" });

  const { data: resources = [], isLoading: loadingResources } = useQuery({
    queryKey: ["resources"],
    queryFn: () => apiFetch("/api/resources"),
  });

  const { data: appointments = [], isLoading: loadingApts } = useQuery({
    queryKey: ["appointments", selectedDate],
    queryFn: () => apiFetch(`/api/appointments?date=${selectedDate}`),
    refetchInterval: 30000,
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients"],
    queryFn: () => apiFetch("/api/patients"),
  });

  const { data: therapists = [] } = useQuery({
    queryKey: ["therapists"],
    queryFn: () => apiFetch("/api/therapists"),
  });

  const createMut = useMutation({
    mutationFn: (body: any) => apiFetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", selectedDate] });
      setShowModal(false);
      toast({ title: "Agendamento criado com sucesso!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) =>
      apiFetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", selectedDate] });
      setShowModal(false);
      setEditApt(null);
      toast({ title: "Agendamento atualizado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/appointments/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelado" }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", selectedDate] });
      toast({ title: "Agendamento cancelado." });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const seedMut = useMutation({
    mutationFn: () => apiFetch("/api/resources/seed", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast({ title: "Recursos criados com sucesso!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const activeResources = (resources as any[]).filter((r: any) => r.active);

  const activeApts = (appointments as any[]).filter(
    (a: any) => !["cancelado", "remarcado"].includes(a.status)
  );

  const filteredApts = activeApts.filter((a: any) => {
    if (therapistFilter && String(a.therapistId) !== therapistFilter) return false;
    if (patientSearch && !a.patientName?.toLowerCase().includes(patientSearch.toLowerCase())) return false;
    return true;
  });

  function getCell(resourceId: number, time: string) {
    return filteredApts.find((a: any) => a.resourceId === resourceId && a.time === time) ?? null;
  }

  const totalVagas = activeResources.length * SLOTS.length;
  const totalOcupadas = activeApts.length;
  const totalLivres = totalVagas - totalOcupadas;
  const taxa = totalVagas > 0 ? Math.round((totalOcupadas / totalVagas) * 100) : 0;

  function changeDate(delta: number) {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setSelectedDate(fmt(d));
  }

  function openCreate(resourceId?: number, time?: string) {
    setEditApt(null);
    setForm({
      patientId: "",
      therapistId: "",
      resourceId: resourceId ? String(resourceId) : "",
      time: time ?? "",
      notes: "",
    });
    setShowModal(true);
  }

  function openEdit(apt: any) {
    setEditApt(apt);
    setForm({
      patientId: String(apt.patientId),
      therapistId: String(apt.therapistId),
      resourceId: apt.resourceId ? String(apt.resourceId) : "",
      time: apt.time,
      notes: apt.notes ?? "",
    });
    setShowModal(true);
  }

  function submitForm() {
    const body = {
      patientId: Number(form.patientId),
      therapistId: Number(form.therapistId),
      resourceId: form.resourceId ? Number(form.resourceId) : null,
      date: selectedDate,
      time: form.time,
      notes: form.notes || null,
    };
    if (!body.patientId || !body.therapistId || !body.time) {
      toast({ title: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }
    if (editApt) {
      updateMut.mutate({ id: editApt.id, body });
    } else {
      createMut.mutate(body);
    }
  }

  const handleDragStart = useCallback((apt: any) => {
    setDragApt(apt);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, resourceId: number, time: string) => {
    e.preventDefault();
    setDropTarget({ resourceId, time });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, resourceId: number, time: string) => {
    e.preventDefault();
    setDropTarget(null);
    if (!dragApt) return;
    const existing = getCell(resourceId, time);
    if (existing && existing.id !== dragApt.id) {
      toast({ title: "Este local já está ocupado neste horário.", variant: "destructive" });
      return;
    }
    updateMut.mutate({ id: dragApt.id, body: { resourceId, time, date: selectedDate } });
    setDragApt(null);
  }, [dragApt, selectedDate]);

  const isLoading = loadingResources || loadingApts;

  if (activeResources.length === 0 && !loadingResources) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-4 min-h-[60vh]">
        <Layers className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Nenhum recurso cadastrado</h2>
        <p className="text-muted-foreground text-sm text-center max-w-sm">
          Clique abaixo para criar os 20 recursos padrão da clínica (Macas, Espaldares, Eletroterapia, etc.)
        </p>
        <Button onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
          {seedMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar recursos padrão
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background px-4 py-3 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Agenda por Recurso</h1>

        {/* Date navigation */}
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm bg-background"
          />
          <Button variant="outline" size="icon" onClick={() => changeDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground ml-1">
            {weekday(selectedDate)}, {fmtDisplay(selectedDate)}
          </span>
        </div>

        {/* Filters */}
        <Select value={therapistFilter} onValueChange={setTherapistFilter}>
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue placeholder="Todos profissionais" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos profissionais</SelectItem>
            {(therapists as any[]).map((t: any) => (
              <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Input
            placeholder="Buscar paciente..."
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            className="h-8 text-sm w-44 pr-7"
          />
          {patientSearch && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setPatientSearch("")}>
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <Button size="sm" onClick={() => openCreate()}>+ Novo Agendamento</Button>
      </div>

      {/* Dashboard indicators */}
      <div className="grid grid-cols-4 gap-3 px-4 py-3 border-b bg-muted/30">
        <div className="bg-background rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold">{totalVagas}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total de vagas</div>
        </div>
        <div className="bg-green-50 border-green-200 border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{totalLivres}</div>
          <div className="text-xs text-green-600 mt-0.5">Vagas livres</div>
        </div>
        <div className="bg-red-50 border-red-200 border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-700">{totalOcupadas}</div>
          <div className="text-xs text-red-600 mt-0.5">Vagas ocupadas</div>
        </div>
        <div className="bg-blue-50 border-blue-200 border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">{taxa}%</div>
          <div className="text-xs text-blue-600 mt-0.5">Taxa de ocupação</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 text-xs border-b bg-muted/10">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" /> Livre</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" /> Ocupado</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300 inline-block" /> Confirmado</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-300 inline-block" /> Presente/Falta</span>
        <span className="text-muted-foreground ml-auto">Arraste para mover agendamentos</span>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="border-collapse text-xs w-full min-w-[900px]">
            <thead className="sticky top-0 z-10 bg-background">
              <tr>
                <th className="border border-border bg-muted/50 px-2 py-2 text-left font-medium sticky left-0 z-20 min-w-[120px]">
                  Recurso
                </th>
                {SLOTS.map((slot) => (
                  <th key={slot} className="border border-border bg-muted/50 px-1 py-2 font-medium text-center min-w-[80px]">
                    {slot}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeResources.map((resource: any) => {
                const rowApts = filteredApts.filter((a: any) => a.resourceId === resource.id);
                const rowOccupied = rowApts.length;
                const rowFree = SLOTS.length - rowOccupied;
                const rowLabel = rowFree === 0
                  ? "Lotado"
                  : rowFree === SLOTS.length
                  ? "Livre"
                  : `${rowOccupied}/${SLOTS.length}`;

                return (
                  <tr key={resource.id} className="group">
                    <td className="border border-border px-2 py-1.5 sticky left-0 z-10 bg-background group-hover:bg-muted/20">
                      <div className="font-medium text-xs leading-tight">{resource.name}</div>
                      <div className="text-muted-foreground text-[10px]">{resource.type}</div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] h-4 mt-0.5",
                          rowFree === 0
                            ? "border-red-300 text-red-700 bg-red-50"
                            : rowFree === SLOTS.length
                            ? "border-green-300 text-green-700 bg-green-50"
                            : "border-yellow-300 text-yellow-700 bg-yellow-50"
                        )}
                      >
                        {rowLabel}
                      </Badge>
                    </td>
                    {SLOTS.map((slot) => {
                      const apt = getCell(resource.id, slot);
                      const isDrop = dropTarget?.resourceId === resource.id && dropTarget?.time === slot;

                      return (
                        <td
                          key={slot}
                          className={cn(
                            "border border-border p-0 relative cursor-pointer transition-colors",
                            isDrop && "bg-blue-100",
                            !apt && !isDrop && "hover:bg-green-50"
                          )}
                          onClick={() => !apt && openCreate(resource.id, slot)}
                          onDragOver={(e) => handleDragOver(e, resource.id, slot)}
                          onDrop={(e) => handleDrop(e, resource.id, slot)}
                          onDragLeave={() => setDropTarget(null)}
                        >
                          {apt ? (
                            <AppointmentCell
                              apt={apt}
                              onEdit={() => openEdit(apt)}
                              onCancel={() => {
                                if (confirm(`Cancelar agendamento de ${apt.patientName}?`)) {
                                  cancelMut.mutate(apt.id);
                                }
                              }}
                              onDragStart={() => handleDragStart(apt)}
                            />
                          ) : (
                            <div className={cn(
                              "w-full h-10 bg-green-50/60",
                              isDrop && "bg-blue-100"
                            )} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={(open) => { setShowModal(open); if (!open) setEditApt(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editApt ? "Editar Agendamento" : "Novo Agendamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Paciente *</Label>
                <Select value={form.patientId} onValueChange={(v) => setForm(f => ({ ...f, patientId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {(patients as any[]).map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Profissional *</Label>
                <Select value={form.therapistId} onValueChange={(v) => setForm(f => ({ ...f, therapistId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(therapists as any[]).map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Horário *</Label>
                <Select value={form.time} onValueChange={(v) => setForm(f => ({ ...f, time: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {SLOTS.map((slot) => (
                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Recurso</Label>
                <Select value={form.resourceId} onValueChange={(v) => setForm(f => ({ ...f, resourceId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    <SelectItem value="">Nenhum</SelectItem>
                    {activeResources.map((r: any) => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.resourceId && form.time && (
              <ResourceAvailabilityHint
                resourceId={Number(form.resourceId)}
                time={form.time}
                date={selectedDate}
                appointments={activeApts}
                editAptId={editApt?.id}
              />
            )}

            <div className="space-y-1">
              <Label>Data</Label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm bg-background w-full"
              />
            </div>

            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Observações opcionais..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowModal(false); setEditApt(null); }}>
              Cancelar
            </Button>
            <Button
              onClick={submitForm}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editApt ? "Salvar alterações" : "Criar agendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AppointmentCell({ apt, onEdit, onCancel, onDragStart }: {
  apt: any;
  onEdit: () => void;
  onCancel: () => void;
  onDragStart: () => void;
}) {
  const statusColors: Record<string, string> = {
    agendado: "bg-red-100 border-red-300 text-red-900",
    mensagem_enviada: "bg-red-100 border-red-300 text-red-900",
    aguardando_confirmacao: "bg-yellow-100 border-yellow-300 text-yellow-900",
    confirmado: "bg-yellow-100 border-yellow-300 text-yellow-900",
    confirmado_recepcao: "bg-yellow-100 border-yellow-300 text-yellow-900",
    presente: "bg-gray-100 border-gray-300 text-gray-700",
    falta: "bg-gray-100 border-gray-300 text-gray-500",
    encaixe: "bg-blue-100 border-blue-300 text-blue-900",
  };

  const color = statusColors[apt.status] ?? "bg-red-100 border-red-300 text-red-900";

  return (
    <div
      className={cn(
        "w-full h-10 px-1 py-0.5 border-l-2 flex flex-col justify-center cursor-grab active:cursor-grabbing group/cell relative",
        color
      )}
      draggable
      onDragStart={onDragStart}
      title={`${apt.patientName} — ${apt.therapistName} (${apt.status})`}
    >
      <div className="font-medium text-[10px] leading-tight truncate">{apt.patientName}</div>
      <div className="text-[9px] opacity-70 truncate">{apt.therapistName}</div>
      {/* Actions on hover */}
      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/cell:opacity-100 flex items-center justify-center gap-1 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="bg-white/90 text-xs px-1.5 py-0.5 rounded text-blue-700 font-medium shadow"
        >
          ✏️
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          className="bg-white/90 text-xs px-1.5 py-0.5 rounded text-red-700 font-medium shadow"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function ResourceAvailabilityHint({ resourceId, time, date, appointments, editAptId }: {
  resourceId: number;
  time: string;
  date: string;
  appointments: any[];
  editAptId?: number;
}) {
  const conflict = appointments.find(
    (a: any) => a.resourceId === resourceId && a.time === time && a.id !== editAptId
  );

  if (conflict) {
    return (
      <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
        ⚠️ Este local já está ocupado neste horário por <strong>{conflict.patientName}</strong>.
      </div>
    );
  }

  return (
    <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1.5">
      ✓ Recurso disponível neste horário.
    </div>
  );
}
