import { useState } from "react";
import {
  useGetDailyReport,
  useGetAbsenceReport,
  useGetSessionsReport,
  getGetDailyReportQueryKey,
  getGetAbsenceReportQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileBarChart2, Calendar, UserX, Activity } from "lucide-react";
import { PrintButton } from "@/components/print/PrintButton";
import { PrintHeader } from "@/components/print/PrintHeader";

function formatDate(str: string) {
  const [y, m, d] = str.split("-");
  return `${d}/${m}`;
}

function formatDateLong(str: string) {
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

export default function Reports() {
  const today = format(new Date(), "yyyy-MM-dd");
  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const [dailyRange, setDailyRange] = useState({ start: thirtyDaysAgo, end: today });
  const [absenceRange, setAbsenceRange] = useState({ start: thirtyDaysAgo, end: today });

  const { data: dailyData = [], isLoading: isLoadingDaily } = useGetDailyReport(
    { startDate: dailyRange.start, endDate: dailyRange.end },
    {
      query: {
        enabled: !!(dailyRange.start && dailyRange.end),
        queryKey: getGetDailyReportQueryKey({ startDate: dailyRange.start, endDate: dailyRange.end }),
      },
    }
  );

  const { data: absenceData = [], isLoading: isLoadingAbsences } = useGetAbsenceReport(
    { startDate: absenceRange.start, endDate: absenceRange.end },
    {
      query: {
        enabled: !!(absenceRange.start && absenceRange.end),
        queryKey: getGetAbsenceReportQueryKey({ startDate: absenceRange.start, endDate: absenceRange.end }),
      },
    }
  );

  const { data: sessionsData = [], isLoading: isLoadingSessions } = useGetSessionsReport();

  const dailyChartData = (dailyData as any[]).map((d: any) => ({
    date: formatDate(d.date),
    Concluídos: d.completed,
    Faltas: d.absent,
    Cancelados: d.cancelled,
  }));

  const totalByPeriod = (dailyData as any[]).reduce(
    (acc: any, d: any) => ({
      total: acc.total + d.total,
      completed: acc.completed + d.completed,
      absent: acc.absent + d.absent,
      cancelled: acc.cancelled + d.cancelled,
    }),
    { total: 0, completed: 0, absent: 0, cancelled: 0 }
  );

  return (
    <div className="space-y-6">
      <PrintHeader title="Relatórios Clínicos" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground mt-1">Análise de atendimentos e sessões</p>
        </div>
        <PrintButton
          title="Relatórios"
          filename={`relatorios-${format(new Date(), "yyyy-MM-dd")}.pdf`}
        />
      </div>

      <Tabs defaultValue="daily" className="space-y-6">
        <TabsList className="grid w-full sm:w-auto grid-cols-3">
          <TabsTrigger value="daily" className="gap-2">
            <Calendar className="h-3.5 w-3.5" />
            Atendimentos
          </TabsTrigger>
          <TabsTrigger value="absences" className="gap-2">
            <UserX className="h-3.5 w-3.5" />
            Faltas
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <Activity className="h-3.5 w-3.5" />
            Sessões
          </TabsTrigger>
        </TabsList>

        {/* Daily Attendance Tab */}
        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Atendimentos por Dia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 items-end mb-6">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Data início</label>
                  <Input
                    type="date"
                    value={dailyRange.start}
                    onChange={(e) => setDailyRange((r) => ({ ...r, start: e.target.value }))}
                    className="w-[160px]"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Data fim</label>
                  <Input
                    type="date"
                    value={dailyRange.end}
                    onChange={(e) => setDailyRange((r) => ({ ...r, end: e.target.value }))}
                    className="w-[160px]"
                  />
                </div>
              </div>

              {isLoadingDaily ? (
                <div className="h-64 bg-muted animate-pulse rounded" />
              ) : (dailyData as any[]).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileBarChart2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Nenhum dado para o período selecionado</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    {[
                      { label: "Total", value: totalByPeriod.total, color: "text-foreground" },
                      { label: "Concluídos", value: totalByPeriod.completed, color: "text-green-600" },
                      { label: "Faltas", value: totalByPeriod.absent, color: "text-orange-600" },
                      { label: "Cancelados", value: totalByPeriod.cancelled, color: "text-red-600" },
                    ].map((stat) => (
                      <Card key={stat.label} className="border">
                        <CardContent className="p-4 text-center">
                          <p className="text-xs text-muted-foreground">{stat.label}</p>
                          <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={dailyChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Concluídos" fill="#22c55e" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Faltas" fill="#f97316" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Cancelados" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Absences Tab */}
        <TabsContent value="absences" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Faltas por Período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 items-end mb-6">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Data início</label>
                  <Input
                    type="date"
                    value={absenceRange.start}
                    onChange={(e) => setAbsenceRange((r) => ({ ...r, start: e.target.value }))}
                    className="w-[160px]"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Data fim</label>
                  <Input
                    type="date"
                    value={absenceRange.end}
                    onChange={(e) => setAbsenceRange((r) => ({ ...r, end: e.target.value }))}
                    className="w-[160px]"
                  />
                </div>
              </div>

              {isLoadingAbsences ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : (absenceData as any[]).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <UserX className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Nenhuma falta registrada no período</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center gap-2">
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                      {(absenceData as any[]).length} falta{(absenceData as any[]).length !== 1 ? "s" : ""} no período
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {(absenceData as any[]).map((absence: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg border border-orange-100 bg-orange-50/50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[52px]">
                            <p className="text-sm font-bold text-orange-700">{formatDateLong(absence.date)}</p>
                            <p className="text-xs text-muted-foreground">{absence.time}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{absence.patientName}</p>
                            <p className="text-xs text-muted-foreground">{absence.therapistName}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                          Falta
                        </Badge>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Sessões Restantes por Paciente</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingSessions ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : (sessionsData as any[]).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Nenhum paciente cadastrado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(sessionsData as any[])
                    .sort((a: any, b: any) => a.remainingSessions - b.remainingSessions)
                    .map((item: any) => {
                      const pct = item.totalSessions > 0
                        ? Math.round((item.remainingSessions / item.totalSessions) * 100)
                        : 0;
                      const barColor = pct <= 20 ? "bg-red-500" : pct <= 40 ? "bg-orange-400" : "bg-green-500";
                      return (
                        <div key={item.patientId} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{item.patientName}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {item.usedSessions} usadas
                              </span>
                              <span className={`text-sm font-bold ${pct <= 20 ? "text-red-600" : pct <= 40 ? "text-orange-600" : "text-green-600"}`}>
                                {item.remainingSessions} / {item.totalSessions}
                              </span>
                            </div>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${barColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
