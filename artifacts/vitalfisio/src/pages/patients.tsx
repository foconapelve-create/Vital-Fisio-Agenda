import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListPatients,
  useCreatePatient,
  useUpdatePatient,
  useDeletePatient,
  getListPatientsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, UserRound, History, Pencil, Trash2, Phone, Activity } from "lucide-react";

const patientSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().min(8, "Telefone inválido"),
  birthDate: z.string().optional().nullable(),
  insuranceType: z.enum(["particular", "convenio"]),
  insuranceName: z.string().optional().nullable(),
  totalSessions: z.number().int().min(1, "Mínimo 1 sessão"),
  notes: z.string().optional().nullable(),
});

type PatientFormData = z.infer<typeof patientSchema>;

type PatientRecord = {
  id: number;
  name: string;
  phone: string;
  birthDate?: string | null;
  insuranceType: string;
  insuranceName?: string | null;
  totalSessions: number;
  remainingSessions: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function Patients() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientRecord | null>(null);
  const [deletingPatient, setDeletingPatient] = useState<PatientRecord | null>(null);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const searchParam = search.trim() ? { search: search.trim() } : undefined;
  const { data: patients = [], isLoading } = useListPatients(
    searchParam ?? {},
    { query: { queryKey: getListPatientsQueryKey(searchParam) } }
  );

  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient();
  const deletePatient = useDeletePatient();

  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: "",
      phone: "",
      birthDate: null,
      insuranceType: "particular",
      insuranceName: null,
      totalSessions: 10,
      notes: null,
    },
  });

  const watchInsuranceType = form.watch("insuranceType");

  function openCreateDialog() {
    setEditingPatient(null);
    form.reset({
      name: "",
      phone: "",
      birthDate: null,
      insuranceType: "particular",
      insuranceName: null,
      totalSessions: 10,
      notes: null,
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(patient: PatientRecord) {
    setEditingPatient(patient);
    form.reset({
      name: patient.name,
      phone: patient.phone,
      birthDate: patient.birthDate ?? null,
      insuranceType: patient.insuranceType as "particular" | "convenio",
      insuranceName: patient.insuranceName ?? null,
      totalSessions: patient.totalSessions,
      notes: patient.notes ?? null,
    });
    setIsDialogOpen(true);
  }

  function invalidatePatients() {
    queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey(searchParam) });
  }

  const onSubmit = (data: PatientFormData) => {
    const payload = {
      ...data,
      birthDate: data.birthDate || null,
      insuranceName: data.insuranceName || null,
      notes: data.notes || null,
    };

    if (editingPatient) {
      updatePatient.mutate(
        { id: editingPatient.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Paciente atualizado com sucesso" });
            setIsDialogOpen(false);
            invalidatePatients();
          },
          onError: () => {
            toast({ title: "Erro ao atualizar paciente", variant: "destructive" });
          },
        }
      );
    } else {
      createPatient.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Paciente criado com sucesso" });
            setIsDialogOpen(false);
            invalidatePatients();
          },
          onError: () => {
            toast({ title: "Erro ao criar paciente", variant: "destructive" });
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (!deletingPatient) return;
    deletePatient.mutate(
      { id: deletingPatient.id },
      {
        onSuccess: () => {
          toast({ title: "Paciente removido" });
          setDeletingPatient(null);
          invalidatePatients();
        },
        onError: () => {
          toast({ title: "Erro ao remover paciente", variant: "destructive" });
        },
      }
    );
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const getSessionBadgeColor = (remaining: number, total: number) => {
    const ratio = remaining / total;
    if (ratio <= 0.2) return "bg-red-100 text-red-700 border-red-200";
    if (ratio <= 0.4) return "bg-orange-100 text-orange-700 border-orange-200";
    return "bg-green-100 text-green-700 border-green-200";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-muted-foreground mt-1">Gerencie os cadastros de pacientes da clínica</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Paciente
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar paciente por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5 space-y-3">
                <div className="h-5 w-2/3 bg-muted rounded" />
                <div className="h-4 w-1/2 bg-muted rounded" />
                <div className="h-4 w-1/3 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : patients.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <UserRound className="h-14 w-14 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Nenhum paciente encontrado</p>
          {search && <p className="text-sm mt-1">Tente uma busca diferente</p>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(patients as PatientRecord[]).map((patient) => (
            <Card key={patient.id} className="hover:shadow-md transition-shadow border border-border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{patient.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                      <Phone className="h-3 w-3" />
                      {patient.phone}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={patient.insuranceType === "convenio" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-50 text-gray-600 border-gray-200"}
                  >
                    {patient.insuranceType === "convenio" ? patient.insuranceName || "Convênio" : "Particular"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between mb-3 bg-muted/40 rounded-md px-3 py-2">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                    <span className="text-muted-foreground">Sessões:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold px-2 py-0.5 rounded border ${getSessionBadgeColor(patient.remainingSessions, patient.totalSessions)}`}>
                      {patient.remainingSessions} restantes
                    </span>
                    <span className="text-xs text-muted-foreground">/ {patient.totalSessions}</span>
                  </div>
                </div>

                {patient.birthDate && (
                  <p className="text-xs text-muted-foreground mb-3">Nasc.: {formatDate(patient.birthDate)}</p>
                )}

                {patient.notes && (
                  <p className="text-xs text-muted-foreground italic mb-3 line-clamp-2">{patient.notes}</p>
                )}

                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => setLocation(`/patients/${patient.id}/history`)}
                  >
                    <History className="h-3.5 w-3.5" />
                    Histórico
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => openEditDialog(patient)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-destructive hover:text-destructive"
                    onClick={() => setDeletingPatient(patient)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPatient ? "Editar Paciente" : "Novo Paciente"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Maria Oliveira" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 99999-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Nascimento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="insuranceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="particular">Particular</SelectItem>
                          <SelectItem value="convenio">Convênio</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {watchInsuranceType === "convenio" && (
                  <FormField
                    control={form.control}
                    name="insuranceName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Convênio</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Unimed" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              <FormField
                control={form.control}
                name="totalSessions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total de Sessões Contratadas</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Diagnóstico, observações clínicas..."
                        {...field}
                        value={field.value ?? ""}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createPatient.isPending || updatePatient.isPending}>
                  {editingPatient ? "Salvar" : "Criar Paciente"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingPatient} onOpenChange={(open) => !open && setDeletingPatient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Paciente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deletingPatient?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
