import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListPatients, useListTherapists } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft, ChevronRight, Calendar, Search, Trash2, Pencil, X,
  RefreshCw, MapPin,
} from "lucide-react";
import {
  format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

/* ─────────────────────────── CONSTANTS ─────────────────────────────── */

const MORNING_SLOTS   = ["08:00", "08:45", "09:30", "10:30", "11:10"];
const AFTERNOON_SLOTS = ["13:20", "14:00", "14:40", "15:40", "16:20"];

const GROUND_FLOOR_LOCATIONS = [
  "Eletroterapia 1", "Eletroterapia 2", "Eletroterapia 3", "Eletroterapia 4",
  "Mão/Punho 1", "Mão/Punho 2",
  "Maca 1", "Maca 2", "Maca 3", "Maca 4",
  "Espaldar 1", "Espaldar 2",
  "Barra",
  "Cadeira Exercício 1", "Cadeira Exercício 2",
];

const UPPER_FLOOR_LOCATIONS = [
  "Tablado 1", "Tablado 2",
  "Cadeira Eletro 1", "Cadeira Eletro 2",
];

const ALL_LOCATIONS = [...GROUND_FLOOR_LOCATIONS, ...UPPER_FLOOR_LOCATIONS];

const TABS = [
  { key: "manha",     label: "MANHÃ",               locations: GROUND_FLOOR_LOCATIONS, slots: MORNING_SLOTS },
  { key: "tarde",     label: "TARDE",               locations: GROUND_FLOOR_LOCATIONS, slots: AFTERNOON_SLOTS },
  { key: "ps-manha",  label: "PISO SUPERIOR MANHÃ", locations: UPPER_FLOOR_LOCATIONS,  slots: MORNING_SLOTS },
  { key: "ps-tarde",  label: "PISO SUPERIOR TARDE", locations: UPPER_FLOOR_LOCATIONS,  slots: AFTERNOON_SLOTS },
];

const WEEK_DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const ALL_STATUSES = [
  "agendado", "mensagem_enviada", "aguardando_confirmacao", "confirmado",
  "confirmado_recepcao", "solicitou_remarcacao", "nao_respondeu",
  "presente", "falta", "cancelado", "remarcado",
] as const;

const STATUS_LABELS: Record<string, string> = {
  agendado:               "Agendado",
  mensagem_enviada:       "Msg. Enviada",
  aguardando_confirmacao: "Ag. Confirmação",
  confirmado:             "Confirmado",
  confirmado_recepcao:    "Conf. Recepção",
  solicitou_remarcacao:   "Sol. Remarcação",
  nao_respondeu:          "Não Respondeu",
  presente:               "Presente",
  falta:                  "Falta",
  cancelado:              "Cancelado",
  remarcado:              "Remarcado",
};

/* ────────────── STATUS → colour class ─────────────────────────────── */
function cellColor(status: string): string {
  if (["confirmado", "confirmado_recepcao", "presente"].includes(status))
    return "bg-green-100 border-green-400 text-green-900";
  if (["agendado", "mensagem_enviada", "aguardando_confirmacao", "nao_respondeu"].includes(status))
    return "bg-yellow-100 border-yellow-400 text-yellow-900";
  if (["falta", "cancelado"].includes(status))
    return "bg-gray-100 border-gray-300 text-gray-500";
  if (["solicitou_remarcacao", "remarcado"].includes(status))
    return "bg-orange-100 border-orange-400 text-orange-900";
  return "bg-blue-100 border-blue-300 text-blue-900";
}

function statusDot(status: string): string {
  if (["confirmado", "confirmado_recepcao", "presente"].includes(status))  return "bg-green-500";
  if (["agendado", "mensagem_enviada", "aguardando_confirmacao"].includes(status)) return "bg-yellow-400";
  if (["falta", "cancelado"].includes(status)) return "bg-gray-400";
  if (["solicitou_remarcacao", "remarcado"].includes(status)) return "bg-orange-400";
  return "bg-blue-400";
}

/* ─────────────────────────── TYPES ─────────────────────────────────── */
type LocalAppointment = {
  id: number;
  patientId: number;
  therapistId: number;
  date: string;
  time: string;
  status: string;
  notes: string | null;
  location: string;
  insurance: string | null;
  appointmentType: string | null;
  patientName: string;
  patientPhone: string;
  therapistName: string;
};

type Patient    = { id: number; name: string; phone: string };
type Therapist  = { id: number; name: string; specialty: string };

/* ─────────────────────────── CELL CARD ─────────────────────────────── */
function AppCard({
  apt, onEdit, onDelete,
}: { apt: LocalAppointment; onEdit: () => void; onDelete: () => void }) {
  const cls = cellColor(apt.status);
  return (
    <div
      className={`group relative rounded border text-[11px] leading-snug px-1.5 py-1 cursor-pointer hover:shadow-sm transition-all ${cls}`}
      onClick={onEdit}
      title={`${apt.patientName} — ${STATUS_LABELS[apt.status] || apt.status}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot(apt.status)}`} />
            <span className="font-semibold truncate">{apt.patientName}</span>
          </div>
          {apt.therapistName && (
            <div className="truncate opacity-70 text-[10px]">{apt.therapistName.split(" ")[0]}</div>
          )}
          {apt.appointmentType && (
            <div className="truncate opacity-60 text-[10px] italic">{apt.appointmentType}</div>
          )}
        </div>
        <button
          className="opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Remover"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════ */
export default function AgendaLocal() {
  const qc = useQueryClient();
  const { toast } = useToast();

  /* ── week navigation ── */
  const today = new Date();
  const [weekBase, setWeekBase] = useState(() =>
    startOfWeek(today, { weekStartsOn: 1 })
  );
  const weekDays = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => addDays(weekBase, i)),
    [weekBase]
  );
  const weekStart = format(weekBase, "yyyy-MM-dd");

  /* ── filters ── */
  const [search, setSearch]             = useState("");
  const [filterTherapist, setFilterTherapist] = useState("all");
  const [filterLocation, setFilterLocation]   = useState("all");
  const [activeTab, setActiveTab]       = useState("manha");

  /* ── dialog ── */
  const [dialog, setDialog] = useState<null | {
    mode: "create" | "edit";
    apt?: LocalAppointment;
    date?: string;
    time?: string;
    location?: string;
  }>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<LocalAppointment | null>(null);

  /* ── form state ── */
  const [form, setForm] = useState({
    patientId: "",
    therapistId: "",
    date: "",
    time: "",
    location: "",
    status: "agendado",
    notes: "",
    insurance: "",
    appointmentType: "",
  });

  /* ── data fetching ── */
  const { data: rawApts = [], isLoading, refetch } = useQuery<LocalAppointment[]>({
    queryKey: ["agenda-local", weekStart, filterTherapist, filterLocation],
    queryFn: () => {
      const params = new URLSearchParams({ weekStart });
      if (filterTherapist !== "all") params.set("therapistId", filterTherapist);
      if (filterLocation !== "all")  params.set("location",    filterLocation);
      return apiFetch(`/api/agenda-local?${params}`);
    },
  });

  const { data: patientsData }   = useListPatients();
  const { data: therapistsData } = useListTherapists();
  const patients:   Patient[]   = (patientsData   as any) ?? [];
  const therapists: Therapist[] = (therapistsData as any) ?? [];

  /* ── appointment map: key = `location|date|time` ── */
  const aptMap = useMemo(() => {
    const m = new Map<string, LocalAppointment>();
    for (const a of rawApts) {
      if (!a.location) continue;
      m.set(`${a.location}|${a.date}|${a.time}`, a);
    }
    return m;
  }, [rawApts]);

  /* ── search filter ── */
  const searchLower = search.toLowerCase();
  const filteredMap = useMemo(() => {
    if (!searchLower) return aptMap;
    const filtered = new Map<string, LocalAppointment>();
    aptMap.forEach((v, k) => {
      if (
        v.patientName.toLowerCase().includes(searchLower) ||
        (v.therapistName || "").toLowerCase().includes(searchLower)
      ) filtered.set(k, v);
    });
    return filtered;
  }, [aptMap, searchLower]);

  /* ── mutations ── */
  const invalidate = () => qc.invalidateQueries({ queryKey: ["agenda-local"] });

  const createMut = useMutation({
    mutationFn: (body: object) => apiFetch("/api/agenda-local", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { invalidate(); toast({ title: "Agendamento criado!" }); setDialog(null); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      apiFetch(`/api/agenda-local/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { invalidate(); toast({ title: "Agendamento atualizado!" }); setDialog(null); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/agenda-local/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); toast({ title: "Agendamento removido." }); setDeleteConfirm(null); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/api/agenda-local/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => invalidate(),
  });

  /* ── open dialog helpers ── */
  const openCreate = useCallback((date: string, time: string, location: string) => {
    setForm({
      patientId: "", therapistId: "", date, time, location,
      status: "agendado", notes: "", insurance: "", appointmentType: "",
    });
    setDialog({ mode: "create", date, time, location });
  }, []);

  const openEdit = useCallback((apt: LocalAppointment) => {
    setForm({
      patientId:       String(apt.patientId),
      therapistId:     String(apt.therapistId),
      date:            apt.date,
      time:            apt.time,
      location:        apt.location,
      status:          apt.status,
      notes:           apt.notes ?? "",
      insurance:       apt.insurance ?? "",
      appointmentType: apt.appointmentType ?? "",
    });
    setDialog({ mode: "edit", apt });
  }, []);

  /* ── submit ── */
  const handleSubmit = () => {
    const body = {
      patientId:       Number(form.patientId),
      therapistId:     Number(form.therapistId),
      date:            form.date,
      time:            form.time,
      location:        form.location,
      status:          form.status,
      notes:           form.notes || null,
      insurance:       form.insurance || null,
      appointmentType: form.appointmentType || null,
    };
    if (!body.patientId || !body.therapistId || !body.date || !body.time || !body.location) {
      toast({ title: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }
    if (dialog?.mode === "edit" && dialog.apt) {
      updateMut.mutate({ id: dialog.apt.id, body });
    } else {
      createMut.mutate(body);
    }
  };

  /* ─────────────────────── GRID COMPONENT ─────────────────────────── */
  const tab = TABS.find(t => t.key === activeTab) ?? TABS[0];

  const weekRangeLabel = `${format(weekBase, "dd/MM")} – ${format(addDays(weekBase, 5), "dd/MM/yyyy")}`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top bar ── */}
      <div className="bg-background border-b border-border px-4 py-3 flex flex-wrap gap-2 items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Agenda por Local</h1>
          <span className="text-sm text-muted-foreground font-medium ml-1">{weekRangeLabel}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setWeekBase(w => subWeeks(w, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekBase(startOfWeek(today, { weekStartsOn: 1 }))}>
            <Calendar className="h-3.5 w-3.5 mr-1" />
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekBase(w => addWeeks(w, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()} title="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-muted/30 border-b border-border px-4 py-2 flex flex-wrap gap-2 items-center shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-7 h-8 text-sm w-48"
            placeholder="Pesquisar paciente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <Select value={filterTherapist} onValueChange={setFilterTherapist}>
          <SelectTrigger className="h-8 text-sm w-44">
            <SelectValue placeholder="Profissional" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos profissionais</SelectItem>
            {therapists.map(t => (
              <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="h-8 text-sm w-44">
            <SelectValue placeholder="Local" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os locais</SelectItem>
            {ALL_LOCATIONS.map(l => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(search || filterTherapist !== "all" || filterLocation !== "all") && (
          <Button
            variant="ghost" size="sm" className="h-8 text-xs"
            onClick={() => { setSearch(""); setFilterTherapist("all"); setFilterLocation("all"); }}
          >
            <X className="h-3 w-3 mr-1" /> Limpar
          </Button>
        )}

        <div className="ml-auto flex gap-3 text-xs text-muted-foreground items-center">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-300 inline-block" /> Confirmado</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-300 inline-block" /> Pendente</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-300 inline-block" /> Falta</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border inline-block" /> Livre</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="shrink-0 mx-4 mt-2 w-fit bg-muted rounded-lg">
          {TABS.map(t => (
            <TabsTrigger key={t.key} value={t.key} className="text-xs font-semibold px-4">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map(tabDef => (
          <TabsContent
            key={tabDef.key}
            value={tabDef.key}
            className="flex-1 overflow-auto m-0 mt-2"
          >
            <AgendaGrid
              locations={tabDef.locations}
              slots={tabDef.slots}
              weekDays={weekDays}
              aptMap={filteredMap}
              isLoading={isLoading}
              today={today}
              onCellClick={openCreate}
              onEditClick={openEdit}
              onDeleteClick={setDeleteConfirm}
              onStatusChange={(id, status) => statusMut.mutate({ id, status })}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={!!dialog} onOpenChange={v => !v && setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "edit" ? "Editar Agendamento" : "Novo Agendamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            {/* location + date/time (read-only in create, editable in edit) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Local *</Label>
                {dialog?.mode === "create" ? (
                  <Input className="h-8 text-sm mt-1" value={form.location} readOnly />
                ) : (
                  <Select value={form.location} onValueChange={v => setForm(f => ({ ...f, location: v }))}>
                    <SelectTrigger className="h-8 text-sm mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_LOCATIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label className="text-xs">Horário *</Label>
                {dialog?.mode === "create" ? (
                  <Input className="h-8 text-sm mt-1" value={form.time} readOnly />
                ) : (
                  <Select value={form.time} onValueChange={v => setForm(f => ({ ...f, time: v }))}>
                    <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[...MORNING_SLOTS, ...AFTERNOON_SLOTS].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs">Data *</Label>
              <Input
                type="date" className="h-8 text-sm mt-1"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>

            <div>
              <Label className="text-xs">Paciente *</Label>
              <Select value={form.patientId} onValueChange={v => setForm(f => ({ ...f, patientId: v }))}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue placeholder="Selecione o paciente" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Profissional *</Label>
              <Select value={form.therapistId} onValueChange={v => setForm(f => ({ ...f, therapistId: v }))}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue placeholder="Selecione o profissional" />
                </SelectTrigger>
                <SelectContent>
                  {therapists.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Convênio</Label>
                <Input
                  className="h-8 text-sm mt-1" placeholder="Particular, Unimed..."
                  value={form.insurance}
                  onChange={e => setForm(f => ({ ...f, insurance: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Tipo de Atendimento</Label>
                <Input
                  className="h-8 text-sm mt-1" placeholder="Fisioterapia..."
                  value={form.appointmentType}
                  onChange={e => setForm(f => ({ ...f, appointmentType: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea
                className="text-sm mt-1 resize-none" rows={2}
                placeholder="Observações sobre a sessão..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {createMut.isPending || updateMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover Agendamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja remover o agendamento de <strong>{deleteConfirm?.patientName}</strong> em{" "}
            <strong>{deleteConfirm?.location}</strong> às <strong>{deleteConfirm?.time}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMut.mutate(deleteConfirm.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   AGENDA GRID
══════════════════════════════════════════════════════════════════════ */
function AgendaGrid({
  locations, slots, weekDays, aptMap, isLoading, today,
  onCellClick, onEditClick, onDeleteClick, onStatusChange,
}: {
  locations:     string[];
  slots:         string[];
  weekDays:      Date[];
  aptMap:        Map<string, LocalAppointment>;
  isLoading:     boolean;
  today:         Date;
  onCellClick:   (date: string, time: string, location: string) => void;
  onEditClick:   (apt: LocalAppointment) => void;
  onDeleteClick: (apt: LocalAppointment) => void;
  onStatusChange:(id: number, status: string) => void;
}) {
  const LOC_COL  = "160px";
  const TIME_COL = "56px";
  const DAY_COL  = "minmax(120px, 1fr)";
  const gridCols = `${LOC_COL} ${TIME_COL} repeat(${weekDays.length}, ${DAY_COL})`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Carregando agenda...
      </div>
    );
  }

  return (
    <div
      className="overflow-auto border border-border rounded-lg mx-4 mb-4 shadow-sm"
      style={{ maxHeight: "calc(100vh - 260px)" }}
    >
      <div style={{ minWidth: `calc(${LOC_COL} + ${TIME_COL} + ${weekDays.length} * 130px)` }}>
        {/* ── Sticky header ── */}
        <div
          className="grid sticky top-0 z-30 bg-gray-100 border-b-2 border-gray-300"
          style={{ gridTemplateColumns: gridCols }}
        >
          <div className="py-2 px-2 text-[11px] font-bold text-gray-600 uppercase tracking-wide border-r border-gray-300 sticky left-0 bg-gray-100 z-40">
            Local
          </div>
          <div className="py-2 px-1 text-[11px] font-bold text-gray-600 uppercase text-center border-r border-gray-300">
            Hora
          </div>
          {weekDays.map(day => {
            const isToday = isSameDay(day, today);
            return (
              <div
                key={day.toISOString()}
                className={`py-2 px-2 text-center border-r border-gray-300 last:border-r-0 ${isToday ? "bg-primary/10" : ""}`}
              >
                <div className={`text-[11px] font-bold uppercase tracking-wide ${isToday ? "text-primary" : "text-gray-600"}`}>
                  {WEEK_DAYS_PT[day.getDay()]}
                </div>
                <div className={`text-base font-extrabold leading-tight ${isToday ? "text-primary" : "text-gray-800"}`}>
                  {format(day, "dd")}
                </div>
                <div className={`text-[10px] ${isToday ? "text-primary/70" : "text-gray-500"}`}>
                  {format(day, "MMM", { locale: ptBR })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Body rows ── */}
        {locations.map((loc, locIdx) => (
          <div key={loc}>
            {/* Location separator */}
            <div
              className={`grid border-b border-gray-200 ${locIdx % 2 === 0 ? "bg-slate-50" : "bg-white"}`}
              style={{ gridTemplateColumns: gridCols }}
            >
              {/* Location name — spans vertically across all time slots */}
              <div
                className={`sticky left-0 z-20 px-2 py-0 border-r border-gray-200 font-semibold text-[11px] text-gray-700 ${locIdx % 2 === 0 ? "bg-slate-50" : "bg-white"}`}
                style={{ gridRow: `1 / span ${slots.length}` }}
              >
                <div className="flex items-center h-full min-h-[28px] gap-1">
                  <MapPin className="h-2.5 w-2.5 shrink-0 text-primary/60" />
                  <span className="leading-tight">{loc}</span>
                </div>
              </div>

              {/* First slot row in this location */}
              <SlotRow
                location={loc}
                slot={slots[0]}
                weekDays={weekDays}
                aptMap={aptMap}
                onCellClick={onCellClick}
                onEditClick={onEditClick}
                onDeleteClick={onDeleteClick}
                isEven={locIdx % 2 === 0}
              />
            </div>

            {/* Remaining slot rows */}
            {slots.slice(1).map(slot => (
              <div
                key={slot}
                className={`grid border-b border-gray-100 ${locIdx % 2 === 0 ? "bg-slate-50" : "bg-white"}`}
                style={{ gridTemplateColumns: gridCols }}
              >
                {/* Empty cell for location column (already rendered above) */}
                <div className={`sticky left-0 z-20 border-r border-gray-200 ${locIdx % 2 === 0 ? "bg-slate-50" : "bg-white"}`} />
                <SlotRow
                  location={loc}
                  slot={slot}
                  weekDays={weekDays}
                  aptMap={aptMap}
                  onCellClick={onCellClick}
                  onEditClick={onEditClick}
                  onDeleteClick={onDeleteClick}
                  isEven={locIdx % 2 === 0}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Single time-slot row inside a location group ── */
function SlotRow({
  location, slot, weekDays, aptMap,
  onCellClick, onEditClick, onDeleteClick, isEven,
}: {
  location:      string;
  slot:          string;
  weekDays:      Date[];
  aptMap:        Map<string, LocalAppointment>;
  onCellClick:   (date: string, time: string, location: string) => void;
  onEditClick:   (apt: LocalAppointment) => void;
  onDeleteClick: (apt: LocalAppointment) => void;
  isEven:        boolean;
}) {
  return (
    <>
      {/* Time label */}
      <div className="px-1 py-1 text-[11px] font-mono font-semibold text-gray-500 border-r border-gray-200 text-center flex items-center justify-center min-h-[38px]">
        {slot}
      </div>

      {/* Day cells */}
      {weekDays.map(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        const key     = `${location}|${dateStr}|${slot}`;
        const apt     = aptMap.get(key);

        return (
          <div
            key={dateStr}
            className={`border-r border-gray-200 last:border-r-0 px-1 py-1 min-h-[38px] min-w-0 ${
              apt
                ? ""
                : `${isEven ? "bg-slate-50" : "bg-white"} hover:bg-blue-50 cursor-pointer transition-colors`
            }`}
            onClick={() => !apt && onCellClick(dateStr, slot, location)}
          >
            {apt ? (
              <AppCard
                apt={apt}
                onEdit={() => onEditClick(apt)}
                onDelete={() => onDeleteClick(apt)}
              />
            ) : (
              <div className="flex items-center justify-center h-full opacity-0 hover:opacity-40 transition-opacity text-gray-400 text-xs select-none">
                +
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
