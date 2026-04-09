import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Users, CalendarX, CheckCircle, CalendarCheck, XCircle, Clock,
  Wallet, TrendingUp, AlertTriangle, Bell, DollarSign
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PrintButton } from "@/components/print/PrintButton";
import { PrintHeader } from "@/components/print/PrintHeader";

type Summary = {
  totalToday: number; totalAbsences: number; totalCompleted: number;
  totalScheduled: number; totalCancelled: number;
  financialSummary?: {
    receivedToday: number; receivedMonth: number; billsMonth: number;
    overdueCount: number; overdueRecords: Array<{ id: number; description: string; amount: number; dueDate: string }>;
    upcomingBillsCount: number; upcomingBills: Array<{ id: number; description: string; amount: number; dueDate: string }>;
  };
};

const statusColors: Record<string, string> = {
  agendado: "bg-blue-100 text-blue-800",
  confirmado: "bg-teal-100 text-teal-800",
  presente: "bg-green-100 text-green-800",
  falta: "bg-orange-100 text-orange-800",
  cancelado: "bg-red-100 text-red-800",
  remarcado: "bg-purple-100 text-purple-800",
  encaixe: "bg-amber-100 text-amber-800",
};

const statusLabels: Record<string, string> = {
  agendado: "Agendado", confirmado: "Confirmado", presente: "Presente",
  falta: "Falta", cancelado: "Cancelado", remarcado: "Remarcado", encaixe: "Encaixe",
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => { if (!s) return "-"; const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const { data: summary, isLoading: isLoadingSummary } = useQuery<Summary>({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiFetch("/api/dashboard/summary"),
    refetchInterval: 60000,
  });

  const { data: upcoming = [], isLoading: isLoadingUpcoming } = useQuery<any[]>({
    queryKey: ["dashboard-upcoming"],
    queryFn: () => apiFetch("/api/dashboard/upcoming"),
    refetchInterval: 60000,
  });

  const fin = summary?.financialSummary;

  return (
    <div className="space-y-6">
      <PrintHeader title="Dashboard — Visão Geral" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Visão geral da clínica — {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <PrintButton
          title="Dashboard"
          filename={`dashboard-${format(new Date(), "yyyy-MM-dd")}.pdf`}
        />
      </div>

      {/* Alertas financeiros */}
      {fin && (fin.overdueCount > 0 || fin.upcomingBillsCount > 0) && (
        <div className="space-y-2">
          {fin.overdueCount > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Contas Vencidas ({fin.overdueCount})</AlertTitle>
              <AlertDescription>
                {fin.overdueRecords.slice(0, 3).map(b => (
                  <span key={b.id} className="block text-xs">
                    • {b.description} — {fmt(b.amount)} (venc. {fmtDate(b.dueDate)})
                  </span>
                ))}
                {fin.overdueCount > 3 && <span className="text-xs">...e mais {fin.overdueCount - 3}</span>}
              </AlertDescription>
            </Alert>
          )}
          {fin.upcomingBillsCount > 0 && (
            <Alert>
              <Bell className="h-4 w-4" />
              <AlertTitle>Contas a Vencer nos Próximos 7 Dias ({fin.upcomingBillsCount})</AlertTitle>
              <AlertDescription>
                {fin.upcomingBills.slice(0, 3).map(b => (
                  <span key={b.id} className="block text-xs">
                    • {b.description} — {fmt(b.amount)} (venc. {fmtDate(b.dueDate)})
                  </span>
                ))}
                {fin.upcomingBillsCount > 3 && <span className="text-xs">...e mais {fin.upcomingBillsCount - 3}</span>}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Cards de atendimento */}
      {isLoadingSummary ? (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {[1,2,3,4,5].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2"><div className="h-4 w-1/2 bg-muted rounded" /></CardHeader>
              <CardContent><div className="h-8 w-1/3 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : summary ? (
        <>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pacientes Hoje</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{summary.totalToday}</div></CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Agendados</CardTitle>
                <CalendarCheck className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{summary.totalScheduled}</div></CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{summary.totalCompleted}</div></CardContent>
            </Card>
            <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Faltas</CardTitle>
                <CalendarX className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{summary.totalAbsences}</div></CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cancelados</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{summary.totalCancelled}</div></CardContent>
            </Card>
          </div>

          {/* Cards financeiros */}
          {fin && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation("/financial")}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Recebido Hoje</CardTitle>
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-emerald-600">{fmt(fin.receivedToday)}</div></CardContent>
              </Card>
              <Card className="border-l-4 border-l-teal-500 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation("/financial")}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Recebido no Mês</CardTitle>
                  <TrendingUp className="h-4 w-4 text-teal-500" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-teal-600">{fmt(fin.receivedMonth)}</div></CardContent>
              </Card>
              <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation("/financial")}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contas a Pagar</CardTitle>
                  <Wallet className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-amber-600">{fmt(fin.billsMonth)}</div></CardContent>
              </Card>
              <Card className={`border-l-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${fin.overdueCount > 0 ? "border-l-red-500" : "border-l-gray-300"}`} onClick={() => setLocation("/financial")}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contas Vencidas</CardTitle>
                  <AlertTriangle className={`h-4 w-4 ${fin.overdueCount > 0 ? "text-red-500" : "text-gray-400"}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${fin.overdueCount > 0 ? "text-red-600" : "text-gray-500"}`}>{fin.overdueCount}</div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      ) : null}

      {/* Próximos atendimentos */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-t-4 border-t-primary shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Próximos Atendimentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingUpcoming ? (
              <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center space-x-4 animate-pulse">
                    <div className="h-10 w-10 bg-muted rounded-full" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-1/3 bg-muted rounded" />
                      <div className="h-3 w-1/4 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : upcoming.length > 0 ? (
              <div className="space-y-3">
                {upcoming.map((apt: any) => (
                  <div key={apt.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border cursor-pointer"
                    onClick={() => setLocation("/agenda")}>
                    <div className="flex items-center space-x-3">
                      <div className="flex flex-col items-center justify-center w-12 h-12 rounded bg-primary/10 text-primary font-bold shrink-0">
                        <span>{apt.time?.split(":")[0]}</span>
                        <span className="text-xs">{apt.time?.split(":")[1]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{apt.patientName}</p>
                        <p className="text-xs text-muted-foreground">Com {apt.therapistName}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={statusColors[apt.status] || ""}>
                      {statusLabels[apt.status] || apt.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Nenhum atendimento próximo agendado.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ações rápidas */}
        <Card className="border-t-4 border-t-teal-500 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-teal-500" />
              Acesso Rápido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Nova Sessão", href: "/agenda", icon: CalendarCheck, color: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200" },
                { label: "Pacientes", href: "/patients", icon: Users, color: "bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200" },
                { label: "Financeiro", href: "/financial", icon: Wallet, color: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200" },
                { label: "Relatórios", href: "/reports", icon: TrendingUp, color: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200" },
              ].map(item => (
                <button key={item.href}
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-colors cursor-pointer ${item.color}`}
                  onClick={() => setLocation(item.href)}>
                  <item.icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
