import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, UserRound, History, Pencil, Trash2, Phone, Activity, Mail, MapPin, Loader2 } from "lucide-react";
import { PrintButton } from "@/components/print/PrintButton";
import { PrintHeader } from "@/components/print/PrintHeader";

type Patient = {
  id: number; name: string; phone: string; email?: string | null;
  birthDate?: string | null; insuranceType: string; insuranceName?: string | null;
  paymentMethod?: string | null; totalSessions: number; remainingSessions: number;
  zipCode?: string | null; addressStreet?: string | null; addressNumber?: string | null;
  addressComplement?: string | null; neighborhood?: string | null; city?: string | null;
  state?: string | null; notes?: string | null; createdAt: string;
  contactPreference?: string | null;
};

type FormData = {
  name: string; phone: string; email: string; birthDate: string;
  insuranceType: string; insuranceName: string; paymentMethod: string;
  totalSessions: number; amountPaid: string; zipCode: string; addressStreet: string; addressNumber: string;
  addressComplement: string; neighborhood: string; city: string; state: string; notes: string;
  contactPreference: string;
};

const emptyForm: FormData = {
  name: "", phone: "", email: "", birthDate: "", insuranceType: "particular",
  insuranceName: "", paymentMethod: "dinheiro", totalSessions: 10, amountPaid: "",
  zipCode: "", addressStreet: "", addressNumber: "", addressComplement: "",
  neighborhood: "", city: "", state: "", notes: "", contactPreference: "whatsapp",
};

const paymentMethods = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
];

export default function Patients() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [cepLoading, setCepLoading] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["patients", search],
    queryFn: () => apiFetch(`/api/patients${search.trim() ? `?search=${encodeURIComponent(search)}` : ""}`),
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => apiFetch("/api/patients", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Paciente criado com sucesso" }); setIsDialogOpen(false); queryClient.invalidateQueries({ queryKey: ["patients"] }); },
    onError: (e: any) => toast({ title: e.message || "Erro ao criar paciente", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) => apiFetch(`/api/patients/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Paciente atualizado" }); setIsDialogOpen(false); queryClient.invalidateQueries({ queryKey: ["patients"] }); },
    onError: (e: any) => toast({ title: e.message || "Erro ao atualizar paciente", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/patients/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Paciente removido" }); setDeletingPatient(null); queryClient.invalidateQueries({ queryKey: ["patients"] }); },
    onError: (e: any) => toast({ title: e.message || "Erro ao remover paciente", variant: "destructive" }),
  });

  const lookupCep = useCallback(async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(prev => ({
          ...prev,
          addressStreet: data.logradouro || prev.addressStreet,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
        toast({ title: "Endereço preenchido automaticamente" });
      } else {
        toast({ title: "CEP não encontrado", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao buscar CEP", variant: "destructive" });
    } finally {
      setCepLoading(false);
    }
  }, [toast]);

  function openCreate() {
    setEditingPatient(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  }

  function openEdit(p: Patient) {
    setEditingPatient(p);
    setForm({
      name: p.name, phone: p.phone, email: p.email || "",
      birthDate: p.birthDate || "", insuranceType: p.insuranceType,
      insuranceName: p.insuranceName || "", paymentMethod: p.paymentMethod || "dinheiro",
      totalSessions: p.totalSessions, amountPaid: (p as any).amountPaid ? String((p as any).amountPaid) : "",
      zipCode: p.zipCode || "", addressStreet: p.addressStreet || "", addressNumber: p.addressNumber || "",
      addressComplement: p.addressComplement || "", neighborhood: p.neighborhood || "",
      city: p.city || "", state: p.state || "", notes: p.notes || "",
      contactPreference: p.contactPreference || "whatsapp",
    });
    setIsDialogOpen(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: "Nome e telefone são obrigatórios", variant: "destructive" });
      return;
    }
    if (editingPatient) updateMutation.mutate({ id: editingPatient.id, data: form });
    else createMutation.mutate(form);
  }

  const formatDate = (d?: string | null) => {
    if (!d) return "-";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const sessionColor = (rem: number, tot: number) => {
    if (tot === 0) return "bg-gray-100 text-gray-600 border-gray-200";
    const r = rem / tot;
    if (r <= 0.2) return "bg-red-100 text-red-700 border-red-200";
    if (r <= 0.4) return "bg-orange-100 text-orange-700 border-orange-200";
    return "bg-green-100 text-green-700 border-green-200";
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <PrintHeader title="Cadastro de Pacientes" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-muted-foreground mt-1">Gerencie os cadastros de pacientes da clínica</p>
        </div>
        <div className="flex gap-2">
          <PrintButton title="Lista de Pacientes" filename="pacientes.pdf" showPdfButton={false} />
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Paciente
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar paciente por nome..." value={search}
          onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => (
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
          {(patients as Patient[]).map(p => (
            <Card key={p.id} className="hover:shadow-md transition-shadow border border-border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{p.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                      <Phone className="h-3 w-3" /> {p.phone}
                    </div>
                    {p.email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Mail className="h-3 w-3" /> {p.email}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className={p.insuranceType === "convenio" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-50 text-gray-600 border-gray-200"}>
                    {p.insuranceType === "convenio" ? p.insuranceName || "Convênio" : "Particular"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between mb-3 bg-muted/40 rounded-md px-3 py-2">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                    <span className="text-muted-foreground">Sessões:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold px-2 py-0.5 rounded border ${sessionColor(p.remainingSessions, p.totalSessions)}`}>
                      {p.remainingSessions} restantes
                    </span>
                    <span className="text-xs text-muted-foreground">/ {p.totalSessions}</span>
                  </div>
                </div>

                {(p.city || p.state) && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                    <MapPin className="h-3 w-3" />
                    {[p.city, p.state].filter(Boolean).join(", ")}
                  </div>
                )}

                {p.birthDate && <p className="text-xs text-muted-foreground mb-2">Nasc.: {formatDate(p.birthDate)}</p>}
                {p.notes && <p className="text-xs text-muted-foreground italic mb-2 line-clamp-2">{p.notes}</p>}

                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => setLocation(`/patients/${p.id}/history`)}>
                    <History className="h-3.5 w-3.5" /> Histórico
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={() => setDeletingPatient(p)}>
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPatient ? "Editar Paciente" : "Novo Paciente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-5">
            {/* Dados pessoais */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Dados Pessoais</p>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label>Nome Completo *</Label>
                  <Input placeholder="Ex: Maria Oliveira" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Telefone *</Label>
                    <Input placeholder="(11) 99999-0000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Data de Nascimento</Label>
                    <Input type="date" value={form.birthDate} onChange={e => setForm(p => ({ ...p, birthDate: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>E-mail</Label>
                    <Input type="email" placeholder="email@exemplo.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Preferência de Contato</Label>
                    <Select value={form.contactPreference} onValueChange={v => setForm(p => ({ ...p, contactPreference: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="ambos">WhatsApp e E-mail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Convênio e Pagamento */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Convênio e Pagamento</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de Atendimento</Label>
                  <Select value={form.insuranceType} onValueChange={v => setForm(p => ({ ...p, insuranceType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="particular">Particular</SelectItem>
                      <SelectItem value="convenio">Convênio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.insuranceType === "convenio" && (
                  <div>
                    <Label>Nome do Convênio</Label>
                    <Input placeholder="Ex: Unimed" value={form.insuranceName} onChange={e => setForm(p => ({ ...p, insuranceName: e.target.value }))} />
                  </div>
                )}
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select value={form.paymentMethod} onValueChange={v => setForm(p => ({ ...p, paymentMethod: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Total de Sessões</Label>
                  <Input type="number" min={0} value={form.totalSessions}
                    onChange={e => setForm(p => ({ ...p, totalSessions: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className={`col-span-2 ${editingPatient ? "opacity-60" : ""}`}>
                  <Label>Valor Pago (R$) {!editingPatient && <span className="text-xs text-green-600 ml-1">→ gera entrada no financeiro</span>}</Label>
                  <Input type="number" min={0} step="0.01" placeholder="0,00"
                    value={form.amountPaid}
                    onChange={e => setForm(p => ({ ...p, amountPaid: e.target.value }))}
                    disabled={!!editingPatient}
                  />
                  {editingPatient && <p className="text-xs text-muted-foreground mt-1">Para ajustar o valor, registre no Financeiro</p>}
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Endereço</p>
              <div className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <Label>CEP</Label>
                    <div className="relative">
                      <Input placeholder="00000-000" value={form.zipCode}
                        onChange={e => { setForm(p => ({ ...p, zipCode: e.target.value })); if (e.target.value.replace(/\D/g, "").length === 8) lookupCep(e.target.value); }}
                      />
                      {cepLoading && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Label>Logradouro</Label>
                    <Input placeholder="Rua, Avenida..." value={form.addressStreet} onChange={e => setForm(p => ({ ...p, addressStreet: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Número</Label>
                    <Input placeholder="123" value={form.addressNumber} onChange={e => setForm(p => ({ ...p, addressNumber: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Complemento</Label>
                    <Input placeholder="Apto 4B" value={form.addressComplement} onChange={e => setForm(p => ({ ...p, addressComplement: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Bairro</Label>
                    <Input placeholder="Centro" value={form.neighborhood} onChange={e => setForm(p => ({ ...p, neighborhood: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Cidade</Label>
                    <Input placeholder="São Paulo" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Estado</Label>
                    <Input placeholder="SP" maxLength={2} value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value.toUpperCase() }))} />
                  </div>
                </div>
              </div>
            </div>

            {/* Observações */}
            <div>
              <Label>Observações</Label>
              <Textarea placeholder="Diagnóstico, observações clínicas..." rows={3}
                value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingPatient ? "Salvar" : "Criar Paciente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingPatient} onOpenChange={open => !open && setDeletingPatient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Paciente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deletingPatient?.name}</strong>? Esta ação removerá também todos os agendamentos do paciente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingPatient && deleteMutation.mutate(deletingPatient.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
