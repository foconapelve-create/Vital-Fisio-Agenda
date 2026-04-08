import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, UserRound, Activity, Phone, ClipboardList, CalendarDays, Plus, Pencil, Trash2, FileText, Lock, Mail, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado", confirmado: "Confirmado", presente: "Presente",
  falta: "Falta", cancelado: "Cancelado", remarcado: "Remarcado", encaixe: "Encaixe",
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

type EvolutionRecord = {
  id: number; patientId: number; therapistId: number; appointmentId: number | null;
  date: string; content: string; therapistName: string; therapistSpecialty: string; createdAt: string;
};

type TherapistType = { id: number; name: string; specialty: string };

const fmtDate = (s: string) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };

export default function PatientHistory() {
  const [, params] = useRoute("/patients/:id/history");
  const patientId = params?.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEvolutionOpen, setIsEvolutionOpen] = useState(false);
  const [editingEvolution, setEditingEvolution] = useState<EvolutionRecord | null>(null);
  const [deletingEvolution, setDeletingEvolution] = useState<EvolutionRecord | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [evForm, setEvForm] = useState({ therapistId: "", date: format(new Date(), "yyyy-MM-dd"), content: "" });

  const { data: patient, isLoading: isLoadingPatient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => apiFetch(`/api/patients/${patientId}`),
    enabled: !!patientId,
  });

  const { data: historyData = [], isLoading: isLoadingHistory } = useQuery<any[]>({
    queryKey: ["patient-history", patientId],
    queryFn: () => apiFetch(`/api/patients/${patientId}/history`),
    enabled: !!patientId,
  });

  const { data: evolutions = [], isLoading: isLoadingEvolutions } = useQuery<EvolutionRecord[]>({
    queryKey: ["evolutions", patientId],
    queryFn: () => apiFetch(`/api/evolutions/patient/${patientId}`),
    enabled: !!patientId,
  });

  const { data: therapists = [] } = useQuery<TherapistType[]>({
    queryKey: ["therapists"],
    queryFn: () => apiFetch("/api/therapists"),
  });

  const createEvolution = useMutation({
    mutationFn: (data: any) => apiFetch("/api/evolutions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Evolução registrada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["evolutions", patientId] });
      setIsEvolutionOpen(false);
      setEvForm({ therapistId: "", date: format(new Date(), "yyyy-MM-dd"), content: "" });
      setSelectedAppointmentId(null);
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao salvar evolução", variant: "destructive" }),
  });

  const updateEvolution = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiFetch(`/api/evolutions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Evolução atualizada" });
      queryClient.invalidateQueries({ queryKey: ["evolutions", patientId] });
      setIsEvolutionOpen(false);
      setEditingEvolution(null);
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteEvolution = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/evolutions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Evolução removida" });
      queryClient.invalidateQueries({ queryKey: ["evolutions", patientId] });
      setDeletingEvolution(null);
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao remover", variant: "destructive" }),
  });

  function openNewEvolutionFromAppointment(apt: any) {
    setEditingEvolution(null);
    setSelectedAppointmentId(apt.id);
    setEvForm({ therapistId: apt.therapistId?.toString() || "", date: apt.date, content: "" });
    setIsEvolutionOpen(true);
  }

  function openNewEvolution() {
    setEditingEvolution(null);
    setSelectedAppointmentId(null);
    setEvForm({ therapistId: "", date: format(new Date(), "yyyy-MM-dd"), content: "" });
    setIsEvolutionOpen(true);
  }

  function openEditEvolution(ev: EvolutionRecord) {
    setEditingEvolution(ev);
    setEvForm({ therapistId: ev.therapistId.toString(), date: ev.date, content: ev.content });
    setIsEvolutionOpen(true);
  }

  function handleEvolutionSubmit() {
    if (!evForm.therapistId || !evForm.date || !evForm.content.trim()) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    if (editingEvolution) {
      updateEvolution.mutate({ id: editingEvolution.id, data: { content: evForm.content, date: evForm.date } });
    } else {
      createEvolution.mutate({
        patientId, therapistId: parseInt(evForm.therapistId),
        date: evForm.date, content: evForm.content,
        appointmentId: selectedAppointmentId,
      });
    }
  }

  const isLoading = isLoadingPatient || isLoadingHistory;
  const history = historyData as any[];
  const presenteAppointments = history.filter(a => a.status === "presente");

  const stats = {
    total: history.length,
    presente: history.filter(a => a.status === "presente").length,
    falta: history.filter(a => a.status === "falta").length,
    cancelado: history.filter(a => a.status === "cancelado").length,
  };

  const p = patient as any;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/patients")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Histórico do Paciente</h1>
          <p className="text-muted-foreground mt-1">Atendimentos e evoluções clínicas</p>
        </div>
      </div>

      {isLoading ? (
        <Card className="animate-pulse">
          <CardContent className="p-6 space-y-3">
            <div className="h-6 w-1/3 bg-muted rounded" />
            <div className="h-4 w-1/4 bg-muted rounded" />
          </CardContent>
        </Card>
      ) : p ? (
        <>
          {/* Patient Card */}
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <UserRound className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{p.name}</h2>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                      <Phone className="h-3.5 w-3.5" /> {p.phone}
                    </div>
                    {p.email && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                        <Mail className="h-3.5 w-3.5" /> {p.email}
                      </div>
                    )}
                    {(p.city || p.state) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3" /> {[p.city, p.state].filter(Boolean).join(", ")}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={p.insuranceType === "convenio" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-50 text-gray-600 border-gray-200"}>
                        {p.insuranceType === "convenio" ? p.insuranceName || "Convênio" : "Particular"}
                      </Badge>
                      {p.paymentMethod && (
                        <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">{p.paymentMethod}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-4 py-3">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="text-sm">
                    <span className="font-bold text-primary">{p.remainingSessions}</span>
                    <span className="text-muted-foreground"> / {p.totalSessions} sessões restantes</span>
                  </span>
                </div>
              </div>
              {p.notes && <p className="mt-4 text-sm text-muted-foreground italic border-t pt-3">{p.notes}</p>}
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="appointments">
            <TabsList className="grid w-full sm:w-auto grid-cols-2">
              <TabsTrigger value="appointments" className="gap-2">
                <CalendarDays className="h-3.5 w-3.5" /> Atendimentos
              </TabsTrigger>
              <TabsTrigger value="evolutions" className="gap-2">
                <FileText className="h-3.5 w-3.5" /> Evoluções
                {(evolutions as EvolutionRecord[]).length > 0 && (
                  <span className="ml-1 bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5">{(evolutions as EvolutionRecord[]).length}</span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Appointments Tab */}
            <TabsContent value="appointments" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Total", value: stats.total, color: "text-foreground" },
                  { label: "Presentes", value: stats.presente, color: "text-green-600" },
                  { label: "Faltas", value: stats.falta, color: "text-orange-600" },
                  { label: "Cancelados", value: stats.cancelado, color: "text-red-600" },
                ].map(stat => (
                  <Card key={stat.label}>
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Registro de Atendimentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {history.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <p>Nenhum atendimento registrado para este paciente.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {history.map((apt: any) => {
                        const hasEvolution = (evolutions as EvolutionRecord[]).some(ev => ev.appointmentId === apt.id);
                        return (
                          <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="text-center min-w-[52px]">
                                <p className="text-sm font-bold">{fmtDate(apt.date)}</p>
                                <p className="text-xs text-muted-foreground">{apt.time}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium">{apt.therapistName}</p>
                                <p className="text-xs text-muted-foreground">{apt.therapistSpecialty}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {hasEvolution && (
                                <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">Evolução</span>
                              )}
                              <Badge variant="outline" className={STATUS_COLORS[apt.status] || "bg-gray-100 text-gray-700"}>
                                {STATUS_LABELS[apt.status] || apt.status}
                              </Badge>
                              {apt.status === "presente" && !hasEvolution && (
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                                  onClick={() => openNewEvolutionFromAppointment(apt)}>
                                  <Plus className="h-3 w-3" /> Evolução
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Evolutions Tab */}
            <TabsContent value="evolutions" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{(evolutions as EvolutionRecord[]).length} evolução(ões) registrada(s)</p>
                  {presenteAppointments.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Evoluções são criadas a partir de sessões com presença confirmada
                    </p>
                  )}
                </div>
                <Button onClick={openNewEvolution} className="gap-2" size="sm">
                  <Plus className="h-4 w-4" /> Nova Evolução
                </Button>
              </div>

              {isLoadingEvolutions ? (
                <div className="space-y-3">{[1,2].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-5 space-y-2">
                      <div className="h-4 w-1/3 bg-muted rounded" />
                      <div className="h-12 w-full bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}</div>
              ) : (evolutions as EvolutionRecord[]).length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <FileText className="h-14 w-14 mx-auto mb-4 opacity-20" />
                  <p className="text-base font-medium">Nenhuma evolução registrada</p>
                  <p className="text-sm mt-1">Use o botão "Evolução" ao lado de cada sessão realizada, ou clique em "Nova Evolução"</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(evolutions as EvolutionRecord[]).map(ev => (
                    <Card key={ev.id} className="border border-border hover:shadow-sm transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-primary">{fmtDate(ev.date)}</span>
                              <span className="text-xs text-muted-foreground">—</span>
                              <span className="text-sm font-medium">{ev.therapistName}</span>
                              {ev.therapistSpecialty && <span className="text-xs text-muted-foreground">{ev.therapistSpecialty}</span>}
                              {ev.appointmentId && (
                                <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">Vinculada à sessão</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditEvolution(ev)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingEvolution(ev)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3 leading-relaxed">
                          {ev.content}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <UserRound className="h-14 w-14 mx-auto mb-4 opacity-20" />
          <p>Paciente não encontrado.</p>
        </div>
      )}

      {/* Evolution Dialog */}
      <Dialog open={isEvolutionOpen} onOpenChange={setIsEvolutionOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEvolution ? "Editar Evolução" : "Registrar Evolução"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingEvolution && (
              <div>
                <Label>Fisioterapeuta</Label>
                <Select value={evForm.therapistId} onValueChange={v => setEvForm(f => ({ ...f, therapistId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o fisioterapeuta" /></SelectTrigger>
                  <SelectContent>
                    {(therapists as TherapistType[]).map(t => (
                      <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Data</Label>
              <Input type="date" value={evForm.date} onChange={e => setEvForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label>Evolução Clínica</Label>
              <Textarea
                placeholder="Descreva o progresso do paciente, técnicas utilizadas, observações clínicas, resposta ao tratamento..."
                value={evForm.content}
                onChange={e => setEvForm(f => ({ ...f, content: e.target.value }))}
                rows={7}
                className="resize-none"
              />
            </div>
            {selectedAppointmentId && (
              <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded p-2">
                Esta evolução será vinculada à sessão selecionada.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEvolutionOpen(false)}>Cancelar</Button>
            <Button onClick={handleEvolutionSubmit} disabled={createEvolution.isPending || updateEvolution.isPending}>
              {editingEvolution ? "Salvar" : "Registrar Evolução"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deletingEvolution} onOpenChange={open => !open && setDeletingEvolution(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Evolução</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta evolução do dia <strong>{deletingEvolution ? fmtDate(deletingEvolution.date) : ""}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingEvolution && deleteEvolution.mutate(deletingEvolution.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
