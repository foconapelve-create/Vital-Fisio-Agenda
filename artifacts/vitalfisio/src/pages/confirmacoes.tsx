import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Phone, CheckCircle2, AlertTriangle, Clock, Calendar, UserRound, RefreshCw, TrendingDown, Users, X } from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type Appointment = {
  id: number; patientId: number; therapistId: number; date: string; time: string;
  status: string; notes?: string | null; patientName: string; patientPhone: string;
  therapistName: string; therapistSpecialty: string;
};

type HistoryEntry = { id: number; status: string; date: string };

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado", confirmado: "Confirmado", presente: "Presente",
  falta: "Falta", cancelado: "Cancelado", remarcado: "Remarcado", encaixe: "Encaixe",
};

const CONFIRMATION_STATUS_COLORS: Record<string, string> = {
  confirmado: "bg-green-100 text-green-800 border-green-200",
  agendado: "bg-yellow-100 text-yellow-800 border-yellow-200",
  encaixe: "bg-purple-100 text-purple-800 border-purple-200",
  presente: "bg-green-100 text-green-800 border-green-200",
};

const fmtDate = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

const fmtPhone = (p: string) => p.replace(/\D/g, "");

function buildWhatsApp(phone: string, name: string, date: string, time: string, therapist: string, clinicName = "VitalFisio") {
  const d = fmtDate(date);
  const msg = `Olá, ${name}! Aqui é da clínica ${clinicName}. Sua sessão está agendada para ${d} às ${time} com ${therapist}.\n\nPara facilitar seu atendimento, responda:\n1 - Confirmar presença\n2 - Remarcar horário`;
  return `https://wa.me/55${fmtPhone(phone)}?text=${encodeURIComponent(msg)}`;
}

function RiskBadge({ risk }: { risk: "baixo" | "medio" | "alto" }) {
  if (risk === "alto") return <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">⚠ Alto Risco</Badge>;
  if (risk === "medio") return <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">⚡ Risco Médio</Badge>;
  return <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">✓ Baixo Risco</Badge>;
}

function usePatientRisk(patientId: number) {
  const { data: history = [] } = useQuery<HistoryEntry[]>({
    queryKey: ["patient-history", patientId],
    queryFn: () => apiFetch(`/api/patients/${patientId}/history`),
    staleTime: 60000,
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

function AppointmentCard({ apt, onConfirm, isConfirming }: {
  apt: Appointment;
  onConfirm: (id: number) => void;
  isConfirming: boolean;
}) {
  const risk = usePatientRisk(apt.patientId);
  const isToday = apt.date === new Date().toISOString().split("T")[0];
  const isTomorrow = apt.date === new Date(Date.now() + 86400000).toISOString().split("T")[0];

  return (
    <div className={`p-4 rounded-lg border transition-colors ${
      risk === "alto" ? "border-red-200 bg-red-50/20" :
      risk === "medio" ? "border-orange-200 bg-orange-50/10" :
      "border-border bg-background"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm">{apt.patientName}</span>
            <RiskBadge risk={risk} />
            {apt.status === "confirmado" && (
              <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">✓ Confirmado</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {isToday ? <strong className="text-primary">Hoje</strong> : isTomorrow ? <strong className="text-orange-600">Amanhã</strong> : fmtDate(apt.date)} às {apt.time}
            </span>
            <span className="flex items-center gap-1">
              <UserRound className="h-3 w-3" /> {apt.therapistName}
            </span>
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" /> {apt.patientPhone}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <a href={buildWhatsApp(apt.patientPhone, apt.patientName, apt.date, apt.time, apt.therapistName)}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-md transition-colors">
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
          <a href={`tel:${fmtPhone(apt.patientPhone)}`}
            className="flex items-center gap-1.5 text-xs font-medium border border-border bg-background hover:bg-muted px-3 py-1.5 rounded-md transition-colors">
            <Phone className="h-3.5 w-3.5" /> Ligar
          </a>
          {apt.status !== "confirmado" && apt.status !== "presente" && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
              onClick={() => onConfirm(apt.id)} disabled={isConfirming}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Confirmacoes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(3);

  const { data: upcoming = [], isLoading, refetch } = useQuery<Appointment[]>({
    queryKey: ["appointments-upcoming", days],
    queryFn: () => apiFetch(`/api/appointments/upcoming?days=${days}`),
    refetchInterval: 30000,
  });

  const confirmMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/appointments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "confirmado" }) }),
    onSuccess: () => {
      toast({ title: "Presença confirmada pela recepção" });
      queryClient.invalidateQueries({ queryKey: ["appointments-upcoming"] });
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao confirmar", variant: "destructive" }),
  });

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const todayApts = upcoming.filter(a => a.date === today);
  const tomorrowApts = upcoming.filter(a => a.date === tomorrow);
  const otherApts = upcoming.filter(a => a.date !== today && a.date !== tomorrow);

  const pendentes = upcoming.filter(a => a.status === "agendado");
  const confirmados = upcoming.filter(a => a.status === "confirmado");
  const altoRisco = upcoming.filter(a => {
    return false;
  });

  const stats = [
    { label: "Total no período", value: upcoming.length, icon: Users, color: "text-foreground" },
    { label: "Aguardando confirmação", value: pendentes.length, icon: Clock, color: "text-yellow-600" },
    { label: "Confirmados", value: confirmados.length, icon: CheckCircle2, color: "text-green-600" },
    { label: "Taxa de confirmação", value: upcoming.length ? `${Math.round(confirmados.length / upcoming.length * 100)}%` : "0%", icon: TrendingDown, color: "text-primary" },
  ];

  const DaySection = ({ label, apts, isUrgent }: { label: string; apts: Appointment[]; isUrgent?: boolean }) => (
    apts.length > 0 ? (
      <div className="space-y-3">
        <div className={`flex items-center gap-2 ${isUrgent ? "text-orange-600" : "text-foreground"}`}>
          <h3 className="font-semibold text-sm uppercase tracking-wide">{label}</h3>
          <Badge variant="outline" className={`text-xs ${isUrgent ? "border-orange-300 text-orange-600" : ""}`}>{apts.length} sessão(ões)</Badge>
        </div>
        <div className="space-y-2">
          {apts.map(apt => (
            <AppointmentCard key={apt.id} apt={apt} onConfirm={id => confirmMut.mutate(id)} isConfirming={confirmMut.isPending} />
          ))}
        </div>
      </div>
    ) : null
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Funil de Confirmações</h1>
          <p className="text-muted-foreground mt-1">Acompanhe e confirme as sessões dos próximos dias</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Próximos dias:</span>
          {[1, 2, 3, 5, 7].map(d => (
            <Button key={d} size="sm" variant={days === d ? "default" : "outline"}
              className="h-8 w-8 p-0 text-xs" onClick={() => setDays(d)}>{d}</Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1 h-8">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : upcoming.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <CheckCircle2 className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Nenhuma sessão nos próximos {days} dia(s)</p>
          <p className="text-sm mt-1">Ajuste o filtro de dias ou agende novas sessões na Agenda</p>
        </div>
      ) : (
        <div className="space-y-6">
          <DaySection label="Hoje" apts={todayApts} isUrgent />
          <DaySection label="Amanhã" apts={tomorrowApts} isUrgent />
          {otherApts.length > 0 && (
            <div className="space-y-3">
              {[...new Set(otherApts.map(a => a.date))].sort().map(date => (
                <DaySection
                  key={date}
                  label={format(new Date(date + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  apts={otherApts.filter(a => a.date === date)}
                />
              ))}
            </div>
          )}

          {pendentes.length > 0 && (
            <Card className="border-yellow-200 bg-yellow-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-yellow-800">
                  <AlertTriangle className="h-4 w-4" />
                  Ações Rápidas — {pendentes.length} paciente(s) sem confirmação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendentes.slice(0, 5).map(apt => (
                    <div key={apt.id} className="flex items-center justify-between gap-2 py-1 border-b border-yellow-100 last:border-0">
                      <div>
                        <span className="text-sm font-medium">{apt.patientName}</span>
                        <span className="text-xs text-muted-foreground ml-2">{fmtDate(apt.date)} às {apt.time}</span>
                      </div>
                      <div className="flex gap-2">
                        <a href={buildWhatsApp(apt.patientPhone, apt.patientName, apt.date, apt.time, apt.therapistName)}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs text-white bg-green-500 hover:bg-green-600 px-2 py-1 rounded transition-colors">
                          WhatsApp
                        </a>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => confirmMut.mutate(apt.id)}>
                          Confirmar
                        </Button>
                      </div>
                    </div>
                  ))}
                  {pendentes.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">+ {pendentes.length - 5} mais acima</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Guide */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Como usar o funil de confirmações</p>
          <div className="grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
            <div className="flex gap-2">
              <MessageCircle className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
              <span><strong className="text-foreground">WhatsApp:</strong> envia mensagem de confirmação com opção de remarcar</span>
            </div>
            <div className="flex gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
              <span><strong className="text-foreground">Confirmar:</strong> registra confirmação manual pela recepção</span>
            </div>
            <div className="flex gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
              <span><strong className="text-foreground">Alto Risco:</strong> paciente com histórico de faltas — priorize o contato</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
