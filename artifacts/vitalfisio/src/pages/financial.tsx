import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListPatients } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Filter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import apiFetch from "@/lib/apiFetch";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subMonths, getMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";

type FinancialRecord = {
  id: number;
  description: string;
  type: "receita" | "despesa";
  amount: number;
  paymentStatus: "pago" | "pendente" | "vencido";
  category: string | null;
  dueDate: string | null;
  paymentDate: string | null;
  patientId: number | null;
  patientName?: string | null;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
};

type Summary = {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  totalPendente: number;
  totalVencido: number;
  countReceitas: number;
  countDespesas: number;
};

type PatientType = { id: number; name: string };

const CATEGORIES_RECEITA = ["Sessão", "Avaliação", "Pacote", "Convênio", "Outros"];
const CATEGORIES_DESPESA = ["Aluguel", "Equipamentos", "Salários", "Material", "Manutenção", "Impostos", "Outros"];
const PAYMENT_METHODS = ["Dinheiro", "Cartão de crédito", "Cartão de débito", "PIX", "Transferência", "Cheque", "Convênio"];

const STATUS_STYLES: Record<string, string> = {
  pago: "bg-green-100 text-green-800 border-green-200",
  pendente: "bg-yellow-100 text-yellow-800 border-yellow-200",
  vencido: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  pago: "Pago",
  pendente: "Pendente",
  vencido: "Vencido",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(str: string | null) {
  if (!str) return "-";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

const defaultForm = {
  description: "",
  type: "receita" as "receita" | "despesa",
  amount: "",
  paymentStatus: "pendente" as "pago" | "pendente" | "vencido",
  category: "",
  dueDate: "",
  paymentDate: "",
  patientId: "",
  paymentMethod: "",
  notes: "",
};

export default function Financial() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<FinancialRecord | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const now = new Date();
  const [summaryMonth, setSummaryMonth] = useState(String(getMonth(now) + 1));
  const [summaryYear, setSummaryYear] = useState(String(getYear(now)));

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["financial", filterType, filterStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("type", filterType);
      if (filterStatus !== "all") params.set("paymentStatus", filterStatus);
      return apiFetch<FinancialRecord[]>(`/api/financial?${params.toString()}`);
    },
  });

  const { data: summary } = useQuery({
    queryKey: ["financial-summary", summaryMonth, summaryYear],
    queryFn: () =>
      apiFetch<Summary>(`/api/financial/summary?month=${summaryMonth}&year=${summaryYear}`),
  });

  const { data: patients = [] } = useListPatients({});

  const createRecord = useMutation({
    mutationFn: (data: any) => apiFetch("/api/financial", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Registro criado com sucesso" });
      invalidate();
      setIsDialogOpen(false);
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao criar", variant: "destructive" }),
  });

  const updateRecord = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiFetch(`/api/financial/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Registro atualizado" });
      invalidate();
      setIsDialogOpen(false);
      setEditingRecord(null);
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteRecord = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/financial/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Registro removido" });
      invalidate();
      setDeletingRecord(null);
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao remover", variant: "destructive" }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["financial"] });
    queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
  }

  function openCreate() {
    setEditingRecord(null);
    setForm(defaultForm);
    setIsDialogOpen(true);
  }

  function openEdit(r: FinancialRecord) {
    setEditingRecord(r);
    setForm({
      description: r.description,
      type: r.type,
      amount: String(r.amount),
      paymentStatus: r.paymentStatus,
      category: r.category ?? "",
      dueDate: r.dueDate ?? "",
      paymentDate: r.paymentDate ?? "",
      patientId: r.patientId ? String(r.patientId) : "",
      paymentMethod: r.paymentMethod ?? "",
      notes: r.notes ?? "",
    });
    setIsDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.description.trim() || !form.amount) {
      toast({ title: "Descrição e valor são obrigatórios", variant: "destructive" });
      return;
    }
    const payload = {
      ...form,
      amount: parseFloat(form.amount),
      patientId: form.patientId ? parseInt(form.patientId) : null,
      category: form.category || null,
      dueDate: form.dueDate || null,
      paymentDate: form.paymentDate || null,
      paymentMethod: form.paymentMethod || null,
      notes: form.notes || null,
    };
    if (editingRecord) {
      updateRecord.mutate({ id: editingRecord.id, data: payload });
    } else {
      createRecord.mutate(payload);
    }
  }

  // Build chart data for last 6 months
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i);
    return { label: format(d, "MMM", { locale: ptBR }), month: getMonth(d) + 1, year: getYear(d) };
  });

  const chartData = months.map(({ label }) => ({ mes: label, Receitas: 0, Despesas: 0 }));

  const allRecords = records as FinancialRecord[];
  const receitas = allRecords.filter((r) => r.type === "receita" && r.paymentStatus === "pago");
  const despesas = allRecords.filter((r) => r.type === "despesa" && r.paymentStatus === "pago");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Controle Financeiro</h1>
          <p className="text-muted-foreground mt-1">Receitas, despesas e fluxo de caixa da clínica</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Lançamento
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Receitas</span>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-xl font-bold text-green-600">{formatCurrency(summary?.totalReceitas ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">pagas no mês</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Despesas</span>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-xl font-bold text-red-600">{formatCurrency(summary?.totalDespesas ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">pagas no mês</p>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${(summary?.saldo ?? 0) >= 0 ? "border-l-primary" : "border-l-orange-500"}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Saldo</span>
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <p className={`text-xl font-bold ${(summary?.saldo ?? 0) >= 0 ? "text-primary" : "text-orange-600"}`}>
              {formatCurrency(summary?.saldo ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">receitas − despesas</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pendente/Vencido</span>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="text-xl font-bold text-yellow-600">
              {formatCurrency((summary?.totalPendente ?? 0) + (summary?.totalVencido ?? 0))}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">a receber/pagar</p>
          </CardContent>
        </Card>
      </div>

      {/* Month selector for summary */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Resumo do mês:</span>
        <Select value={summaryMonth} onValueChange={setSummaryMonth}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => ({
              value: String(i + 1),
              label: format(new Date(2024, i, 1), "MMMM", { locale: ptBR }),
            })).map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label.charAt(0).toUpperCase() + label.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={summaryYear} onValueChange={setSummaryYear}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026, 2027].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="records">
        <TabsList className="grid w-full sm:w-auto grid-cols-2">
          <TabsTrigger value="records">Lançamentos</TabsTrigger>
          <TabsTrigger value="chart">Gráfico</TabsTrigger>
        </TabsList>

        {/* Records Tab */}
        <TabsContent value="records" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="receita">Receitas</SelectItem>
                <SelectItem value="despesa">Despesas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-16" /></Card>)}
            </div>
          ) : allRecords.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Wallet className="h-14 w-14 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Nenhum lançamento encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allRecords.map((r) => (
                <Card key={r.id} className={`border-l-4 ${r.type === "receita" ? "border-l-green-400" : "border-l-red-400"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{r.description}</span>
                          {r.category && (
                            <Badge variant="outline" className="text-xs">{r.category}</Badge>
                          )}
                          {r.patientName && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              {r.patientName}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          {r.dueDate && <span>Vencto: {formatDate(r.dueDate)}</span>}
                          {r.paymentDate && <span>Pago em: {formatDate(r.paymentDate)}</span>}
                          {r.paymentMethod && <span>{r.paymentMethod}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-base font-bold ${r.type === "receita" ? "text-green-600" : "text-red-600"}`}>
                            {r.type === "receita" ? "+" : "-"}{formatCurrency(r.amount)}
                          </p>
                          <Badge variant="outline" className={`text-xs ${STATUS_STYLES[r.paymentStatus]}`}>
                            {STATUS_LABELS[r.paymentStatus]}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeletingRecord(r)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {r.notes && <p className="text-xs text-muted-foreground italic mt-2 border-t pt-2">{r.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Chart Tab */}
        <TabsContent value="chart" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Receitas vs. Despesas — Últimos 6 meses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                O gráfico exibe os lançamentos <strong>pagos</strong> por mês de criação.
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="Receitas" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Despesas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRecord ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Tipo</label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as any, category: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Status</label>
                <Select value={form.paymentStatus} onValueChange={(v) => setForm((f) => ({ ...f, paymentStatus: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1.5">Descrição *</label>
              <Input
                placeholder="Ex: Sessão de fisioterapia - Maria"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Valor (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Categoria</label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(form.type === "receita" ? CATEGORIES_RECEITA : CATEGORIES_DESPESA).map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Vencimento</label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Data de Pagamento</label>
                <Input type="date" value={form.paymentDate} onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Forma de Pagamento</label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.type === "receita" && (
                <div>
                  <label className="text-sm font-medium block mb-1.5">Paciente</label>
                  <Select value={form.patientId} onValueChange={(v) => setForm((f) => ({ ...f, patientId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Vincular paciente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {(patients as PatientType[]).map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium block mb-1.5">Observações</label>
              <Textarea
                placeholder="Observações opcionais..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createRecord.isPending || updateRecord.isPending}>
              {editingRecord ? "Salvar" : "Criar Lançamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingRecord} onOpenChange={(open) => !open && setDeletingRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover "<strong>{deletingRecord?.description}</strong>"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingRecord && deleteRecord.mutate(deletingRecord.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
