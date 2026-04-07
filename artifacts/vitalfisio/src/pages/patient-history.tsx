import { useRoute, useLocation } from "wouter";
import { useGetPatient, useGetPatientHistory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserRound, Activity, Phone } from "lucide-react";

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

export default function PatientHistory() {
  const [, params] = useRoute("/patients/:id/history");
  const patientId = params?.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();

  const { data: patient, isLoading: isLoadingPatient } = useGetPatient(patientId, {
    query: { enabled: !!patientId },
  });

  const { data: history = [], isLoading: isLoadingHistory } = useGetPatientHistory(patientId, {
    query: { enabled: !!patientId },
  });

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const isLoading = isLoadingPatient || isLoadingHistory;

  const stats = {
    total: (history as any[]).length,
    presente: (history as any[]).filter((a: any) => a.status === "presente").length,
    falta: (history as any[]).filter((a: any) => a.status === "falta").length,
    cancelado: (history as any[]).filter((a: any) => a.status === "cancelado").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/patients")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Histórico do Paciente</h1>
          <p className="text-muted-foreground mt-1">Todos os atendimentos registrados</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Card className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-6 w-1/3 bg-muted rounded mb-3" />
              <div className="h-4 w-1/4 bg-muted rounded" />
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {patient && (
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-6">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserRound className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{(patient as any).name}</h2>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                        <Phone className="h-3.5 w-3.5" />
                        {(patient as any).phone}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={
                          (patient as any).insuranceType === "convenio"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-gray-50 text-gray-600 border-gray-200"
                        }>
                          {(patient as any).insuranceType === "convenio"
                            ? (patient as any).insuranceName || "Convênio"
                            : "Particular"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-4 py-3">
                    <Activity className="h-4 w-4 text-primary" />
                    <span className="text-sm">
                      <span className="font-bold text-primary">{(patient as any).remainingSessions}</span>
                      <span className="text-muted-foreground"> / {(patient as any).totalSessions} sessões restantes</span>
                    </span>
                  </div>
                </div>

                {(patient as any).notes && (
                  <p className="mt-4 text-sm text-muted-foreground italic border-t pt-3">{(patient as any).notes}</p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total", value: stats.total, color: "text-foreground" },
              { label: "Presentes", value: stats.presente, color: "text-green-600" },
              { label: "Faltas", value: stats.falta, color: "text-orange-600" },
              { label: "Cancelados", value: stats.cancelado, color: "text-red-600" },
            ].map((stat) => (
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
              <CardTitle className="text-base font-semibold">Registro de Atendimentos</CardTitle>
            </CardHeader>
            <CardContent>
              {(history as any[]).length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <p>Nenhum atendimento registrado para este paciente.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(history as any[]).map((apt: any) => (
                    <div
                      key={apt.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[52px]">
                          <p className="text-sm font-bold">{formatDate(apt.date)}</p>
                          <p className="text-xs text-muted-foreground">{apt.time}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{apt.therapistName}</p>
                          <p className="text-xs text-muted-foreground">{apt.therapistSpecialty}</p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={STATUS_COLORS[apt.status] || "bg-gray-100 text-gray-700"}
                      >
                        {STATUS_LABELS[apt.status] || apt.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
