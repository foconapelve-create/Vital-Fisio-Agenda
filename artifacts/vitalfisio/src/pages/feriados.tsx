import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CalendarX, Plus, Trash2, RefreshCw, AlertTriangle, CheckCircle2,
  Download, Settings, Loader2, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

const TYPE_COLORS: Record<string, string> = {
  Nacional: "bg-blue-100 text-blue-800 border-blue-200",
  Estadual: "bg-purple-100 text-purple-800 border-purple-200",
  Municipal: "bg-orange-100 text-orange-800 border-orange-200",
  Interno: "bg-gray-100 text-gray-700 border-gray-300",
};

export default function Feriados() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showForm, setShowForm] = useState(false);
  const [editHoliday, setEditHoliday] = useState<any>(null);
  const [form, setForm] = useState({ date: "", description: "", type: "Nacional" });

  const [affectedData, setAffectedData] = useState<any>(null);
  const [showAffected, setShowAffected] = useState(false);
  const [rescheduleResult, setRescheduleResult] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Settings
  const [settings, setSettings] = useState<any>(null);

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ["holidays", selectedYear],
    queryFn: () => apiFetch(`${BASE}/api/holidays?year=${selectedYear}`),
  });

  const { data: rawSettings } = useQuery({
    queryKey: ["settings-holiday"],
    queryFn: async () => {
      const data: any = await apiFetch(`${BASE}/api/settings/holiday`);
      setSettings(data);
      return data;
    },
  });

  const createMut = useMutation({
    mutationFn: (body: any) => apiFetch(`${BASE}/api/holidays`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    onSuccess: async (created: any) => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      setShowForm(false);
      setForm({ date: "", description: "", type: "Nacional" });
      toast({ title: "Feriado criado!" });

      // Check affected appointments
      try {
        const data: any = await apiFetch(`${BASE}/api/holidays/${created.id}/affected`);
        if (data.affected?.length > 0) {
          setAffectedData(data);
          setShowAffected(true);
        }
      } catch {}
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) =>
      apiFetch(`${BASE}/api/holidays/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      setShowForm(false);
      setEditHoliday(null);
      toast({ title: "Feriado atualizado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`${BASE}/api/holidays/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      setDeleteTarget(null);
      toast({ title: "Feriado excluído." });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      apiFetch(`${BASE}/api/holidays/${id}`, { method: "PATCH", body: JSON.stringify({ active }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["holidays"] }),
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const seedMut = useMutation({
    mutationFn: (year: number) => apiFetch(`${BASE}/api/holidays/seed-national`, {
      method: "POST",
      body: JSON.stringify({ year }),
    }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast({ title: data.message });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const rescheduleMut = useMutation({
    mutationFn: (id: number) => apiFetch(`${BASE}/api/holidays/${id}/auto-reschedule`, { method: "POST" }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setShowAffected(false);
      setRescheduleResult(data);
      setShowResult(true);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const saveSettingsMut = useMutation({
    mutationFn: (body: any) => apiFetch(`${BASE}/api/settings/holiday`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-holiday"] });
      toast({ title: "Configurações salvas!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditHoliday(null);
    setForm({ date: "", description: "", type: "Nacional" });
    setShowForm(true);
  }

  function openEdit(h: any) {
    setEditHoliday(h);
    setForm({ date: h.date, description: h.description, type: h.type });
    setShowForm(true);
  }

  function submitForm() {
    if (!form.date || !form.description) {
      toast({ title: "Preencha data e descrição", variant: "destructive" });
      return;
    }
    if (editHoliday) {
      updateMut.mutate({ id: editHoliday.id, body: form });
    } else {
      createMut.mutate(form);
    }
  }

  const activeCount = (holidays as any[]).filter((h: any) => h.active).length;
  const nationalCount = (holidays as any[]).filter((h: any) => h.type === "Nacional").length;

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarX className="h-6 w-6 text-red-500" />
            Gestão de Feriados
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie feriados e configure o bloqueio de agendamentos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => seedMut.mutate(selectedYear)} disabled={seedMut.isPending}>
            {seedMut.isPending
              ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
              : <Download className="h-4 w-4 mr-1" />}
            Importar Feriados {selectedYear}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Feriado
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-red-600">{(holidays as any[]).length}</div>
            <div className="text-xs text-muted-foreground">Total de feriados ({selectedYear})</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-blue-600">{nationalCount}</div>
            <div className="text-xs text-muted-foreground">Feriados nacionais</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
            <div className="text-xs text-muted-foreground">Feriados ativos (bloqueando agenda)</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Lista de Feriados</TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-3 w-3 mr-1" />
            Configurações
          </TabsTrigger>
        </TabsList>

        {/* ─── LIST ─── */}
        <TabsContent value="list" className="mt-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-medium">Ano:</span>
            {yearOptions.map((y) => (
              <Button
                key={y}
                variant={selectedYear === y ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedYear(y)}
              >
                {y}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (holidays as any[]).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarX className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum feriado cadastrado para {selectedYear}</p>
              <p className="text-sm mt-1">Clique em "Importar Feriados" para carregar os feriados nacionais automaticamente.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Agendamentos</TableHead>
                    <TableHead className="w-28">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(holidays as any[]).map((h: any) => (
                    <HolidayRow
                      key={h.id}
                      holiday={h}
                      onEdit={() => openEdit(h)}
                      onDelete={() => setDeleteTarget(h)}
                      onToggle={() => toggleMut.mutate({ id: h.id, active: !h.active })}
                      onViewAffected={async () => {
                        try {
                          const data: any = await apiFetch(`${BASE}/api/holidays/${h.id}/affected`);
                          setAffectedData(data);
                          setShowAffected(true);
                        } catch (e: any) {
                          toast({ title: "Erro", description: e.message, variant: "destructive" });
                        }
                      }}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ─── SETTINGS ─── */}
        <TabsContent value="settings" className="mt-4">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle className="text-base">Configurações de Agendamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Comportamento em feriados</Label>
                <div className="space-y-2">
                  {[
                    { value: "block", label: "Bloquear completamente agendamentos no feriado" },
                    { value: "allow_plantao", label: "Permitir agendamento apenas para profissionais de plantão" },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-muted/30 border">
                      <input
                        type="radio"
                        value={opt.value}
                        checked={settings?.holidayMode === opt.value}
                        onChange={() => setSettings((s: any) => ({ ...s, holidayMode: opt.value }))}
                        className="accent-primary"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-t">
                <div>
                  <p className="text-sm font-medium">Bloquear agendamentos aos domingos</p>
                  <p className="text-xs text-muted-foreground">Impede qualquer agendamento no domingo</p>
                </div>
                <Switch
                  checked={settings?.blockSunday ?? true}
                  onCheckedChange={(v) => setSettings((s: any) => ({ ...s, blockSunday: v }))}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-t">
                <div>
                  <p className="text-sm font-medium">Permitir agendamentos aos sábados</p>
                  <p className="text-xs text-muted-foreground">Trata sábado como dia útil para atendimento</p>
                </div>
                <Switch
                  checked={settings?.allowSaturday ?? true}
                  onCheckedChange={(v) => setSettings((s: any) => ({ ...s, allowSaturday: v }))}
                />
              </div>

              <Button
                className="w-full"
                onClick={() => saveSettingsMut.mutate(settings)}
                disabled={saveSettingsMut.isPending}
              >
                {saveSettingsMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Create/Edit Modal ─── */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditHoliday(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editHoliday ? "Editar Feriado" : "Novo Feriado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Data *</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Descrição *</Label>
              <Input
                placeholder="Ex: Feriado Municipal da Cidade"
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Nacional", "Estadual", "Municipal", "Interno"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditHoliday(null); }}>Cancelar</Button>
            <Button onClick={submitForm} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editHoliday ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Affected Appointments Modal ─── */}
      <Dialog open={showAffected} onOpenChange={setShowAffected}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-700">
              <AlertTriangle className="h-5 w-5" />
              Pacientes afetados por este feriado
            </DialogTitle>
          </DialogHeader>
          {affectedData && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                O feriado <strong>{affectedData.holiday?.description}</strong> em{" "}
                <strong>{affectedData.holiday ? fmtDate(affectedData.holiday.date) : ""}</strong>{" "}
                afeta {affectedData.affected?.length} agendamento(s).
              </p>
              {affectedData.affected?.length > 0 ? (
                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {affectedData.affected.map((a: any) => (
                    <div key={a.id} className="px-3 py-2 flex justify-between items-center text-sm">
                      <div>
                        <div className="font-medium">{a.patientName}</div>
                        <div className="text-xs text-muted-foreground">{a.time} — {a.therapistName}</div>
                      </div>
                      <Badge variant="outline" className="text-orange-700 border-orange-300">Afetado</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">
                  ✓ Nenhum agendamento afetado.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAffected(false)}>Fechar</Button>
            {affectedData?.affected?.length > 0 && (
              <Button
                onClick={() => rescheduleMut.mutate(affectedData.holiday.id)}
                disabled={rescheduleMut.isPending}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {rescheduleMut.isPending
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <RefreshCw className="mr-2 h-4 w-4" />}
                Remarcar automaticamente
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reschedule Result Modal ─── */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              Remarcação automática concluída
            </DialogTitle>
          </DialogHeader>
          {rescheduleResult && (
            <div className="space-y-4">
              <p className="text-sm">{rescheduleResult.message}</p>
              {rescheduleResult.details?.rescheduled?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-700 mb-1">Remarcados com sucesso:</p>
                  <div className="border rounded-lg divide-y max-h-36 overflow-y-auto">
                    {rescheduleResult.details.rescheduled.map((r: any, i: number) => (
                      <div key={i} className="px-3 py-2 text-xs">
                        <span className="font-medium">{r.original.patientName}</span>
                        {" "}→ {fmtDate(r.newDate)} às {r.newTime}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {rescheduleResult.details?.pending?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-orange-700 mb-1">Sem disponibilidade (pendências):</p>
                  <div className="border rounded-lg divide-y max-h-28 overflow-y-auto border-orange-200">
                    {rescheduleResult.details.pending.map((p: any, i: number) => (
                      <div key={i} className="px-3 py-2 text-xs text-orange-800">
                        <span className="font-medium">{p.patientName}</span> — {p.time} com {p.therapistName}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowResult(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm ─── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir feriado?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá permanentemente <strong>{deleteTarget?.description}</strong> ({deleteTarget ? fmtDate(deleteTarget.date) : ""}). Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMut.mutate(deleteTarget.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HolidayRow({ holiday, onEdit, onDelete, onToggle, onViewAffected }: {
  holiday: any;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onViewAffected: () => void;
}) {
  const typeColor = TYPE_COLORS[holiday.type] ?? "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <TableRow className={cn(!holiday.active && "opacity-50")}>
      <TableCell className="font-mono text-sm">{fmtDate(holiday.date)}</TableCell>
      <TableCell className="font-medium">{holiday.description}</TableCell>
      <TableCell>
        <Badge variant="outline" className={cn("text-xs", typeColor)}>{holiday.type}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch checked={holiday.active} onCheckedChange={onToggle} />
          <span className="text-xs text-muted-foreground">{holiday.active ? "Ativo" : "Inativo"}</span>
        </div>
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" onClick={onViewAffected} className="h-7 text-xs text-orange-700 hover:text-orange-800 hover:bg-orange-50">
          <Users className="h-3 w-3 mr-1" />
          Ver afetados
        </Button>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <span className="text-xs">✏️</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-600" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
