import { useLocation } from "wouter";
import { useGetDashboardSummary, useGetUpcomingAppointments } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CalendarX, CheckCircle, CalendarCheck, XCircle, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: upcoming, isLoading: isLoadingUpcoming } = useGetUpcomingAppointments();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendado': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'confirmado': return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300';
      case 'presente': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'falta': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'cancelado': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'remarcado': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'encaixe': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Visão geral da clínica para hoje, {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
      </div>

      {isLoadingSummary ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-1/2 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-1/3 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summary ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pacientes Hoje</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalToday}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Agendados</CardTitle>
              <CalendarCheck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalScheduled}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalCompleted}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faltas</CardTitle>
              <CalendarX className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalAbsences}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cancelados</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalCancelled}</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-2 md:col-span-1 border-t-4 border-t-primary shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Próximos Atendimentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingUpcoming ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center space-x-4 animate-pulse">
                    <div className="h-10 w-10 bg-muted rounded-full"></div>
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-1/3 bg-muted rounded"></div>
                      <div className="h-3 w-1/4 bg-muted rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : upcoming && upcoming.length > 0 ? (
              <div className="space-y-6">
                {upcoming.map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border cursor-pointer" onClick={() => setLocation(`/agenda`)}>
                    <div className="flex items-center space-x-4">
                      <div className="flex flex-col items-center justify-center w-12 h-12 rounded bg-primary/10 text-primary font-bold">
                        <span>{apt.time.split(':')[0]}</span>
                        <span className="text-xs">{apt.time.split(':')[1]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-none">{apt.patientName}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Com {apt.therapistName}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={getStatusColor(apt.status)}>
                      {getStatusLabel(apt.status)}
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

        {/* Quick Actions placeholder or other dashboard widgets could go here */}
      </div>
    </div>
  );
}
