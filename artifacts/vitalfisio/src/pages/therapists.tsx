import { useState } from "react";
import {
  useListTherapists,
  useCreateTherapist,
  useUpdateTherapist,
  useDeleteTherapist,
  getListTherapistsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { PrintButton } from "@/components/print/PrintButton";
import { PrintHeader } from "@/components/print/PrintHeader";
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
import { Plus, UserRound, Phone, Stethoscope, Clock, Pencil, Trash2 } from "lucide-react";

const therapistSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  specialty: z.string().min(2, "Especialidade é obrigatória"),
  phone: z.string().min(8, "Telefone inválido"),
  availableHours: z.string().optional().nullable(),
});

type TherapistFormData = z.infer<typeof therapistSchema>;

type TherapistRecord = {
  id: number;
  name: string;
  specialty: string;
  phone: string;
  availableHours?: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function Therapists() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTherapist, setEditingTherapist] = useState<TherapistRecord | null>(null);
  const [deletingTherapist, setDeletingTherapist] = useState<TherapistRecord | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: therapists = [], isLoading } = useListTherapists();

  const createTherapist = useCreateTherapist();
  const updateTherapist = useUpdateTherapist();
  const deleteTherapist = useDeleteTherapist();

  const form = useForm<TherapistFormData>({
    resolver: zodResolver(therapistSchema),
    defaultValues: {
      name: "",
      specialty: "",
      phone: "",
      availableHours: null,
    },
  });

  function openCreateDialog() {
    setEditingTherapist(null);
    form.reset({ name: "", specialty: "", phone: "", availableHours: null });
    setIsDialogOpen(true);
  }

  function openEditDialog(therapist: TherapistRecord) {
    setEditingTherapist(therapist);
    form.reset({
      name: therapist.name,
      specialty: therapist.specialty,
      phone: therapist.phone,
      availableHours: therapist.availableHours ?? null,
    });
    setIsDialogOpen(true);
  }

  function invalidateTherapists() {
    queryClient.invalidateQueries({ queryKey: getListTherapistsQueryKey() });
  }

  const onSubmit = (data: TherapistFormData) => {
    const payload = {
      ...data,
      availableHours: data.availableHours || null,
    };

    if (editingTherapist) {
      updateTherapist.mutate(
        { id: editingTherapist.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Fisioterapeuta atualizado" });
            setIsDialogOpen(false);
            invalidateTherapists();
          },
          onError: () => {
            toast({ title: "Erro ao atualizar", variant: "destructive" });
          },
        }
      );
    } else {
      createTherapist.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Fisioterapeuta criado" });
            setIsDialogOpen(false);
            invalidateTherapists();
          },
          onError: () => {
            toast({ title: "Erro ao criar", variant: "destructive" });
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (!deletingTherapist) return;
    deleteTherapist.mutate(
      { id: deletingTherapist.id },
      {
        onSuccess: () => {
          toast({ title: "Fisioterapeuta removido" });
          setDeletingTherapist(null);
          invalidateTherapists();
        },
        onError: () => {
          toast({ title: "Erro ao remover", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <PrintHeader title="Cadastro de Fisioterapeutas" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fisioterapeutas</h1>
          <p className="text-muted-foreground mt-1">Equipe clínica cadastrada</p>
        </div>
        <div className="flex gap-2">
          <PrintButton title="Fisioterapeutas" filename="fisioterapeutas.pdf" showPdfButton={false} />
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Fisioterapeuta
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5 space-y-3">
                <div className="h-5 w-2/3 bg-muted rounded" />
                <div className="h-4 w-1/2 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (therapists as TherapistRecord[]).length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <UserRound className="h-14 w-14 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Nenhum fisioterapeuta cadastrado</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(therapists as TherapistRecord[]).map((therapist) => (
            <Card key={therapist.id} className="hover:shadow-md transition-shadow border border-border">
              <CardContent className="p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <UserRound className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{therapist.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-primary mt-0.5">
                      <Stethoscope className="h-3.5 w-3.5" />
                      <span className="truncate">{therapist.specialty}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {therapist.phone}
                  </div>
                  {therapist.availableHours && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {therapist.availableHours}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => openEditDialog(therapist)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-destructive hover:text-destructive"
                    onClick={() => setDeletingTherapist(therapist)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTherapist ? "Editar Fisioterapeuta" : "Novo Fisioterapeuta"}</DialogTitle>
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
                      <Input placeholder="Ex: Dr. João Lima" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="specialty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especialidade</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Fisioterapia Ortopédica" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                name="availableHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horários Disponíveis</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ex: 08:00-12:00, 13:30-17:00"
                        {...field}
                        value={field.value ?? ""}
                        rows={2}
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
                <Button type="submit" disabled={createTherapist.isPending || updateTherapist.isPending}>
                  {editingTherapist ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingTherapist} onOpenChange={(open) => !open && setDeletingTherapist(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Fisioterapeuta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deletingTherapist?.name}</strong>?
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
