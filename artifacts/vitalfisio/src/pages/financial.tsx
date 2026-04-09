import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, Plus, Pencil, Trash2, CheckCircle2, Loader2, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { getMonth, getYear } from "date-fns";

type FinancialRecord = {
  id: number; description: string; type: "receita" | "despesa";
  amount: number; paymentStatus: string; category: string | null;
  supplier: string | null; dueDate: string | null; paymentDate: string | null;
  patientId: number | null; patientName?: string | null;
  paymentMethod: string | null; notes: string | null; createdAt: string;
};

type Summary = {
  totalReceitas: number; totalDespesas: number; saldo: number;
  totalPendente: number; totalVencido: number;
};

const CATS_RECEITA = ["Sessão", "Avaliação", "Pacote", "Convênio", "Outros"];
const CATS_DESPESA = ["Aluguel", "Equipamentos", "Salários", "Material", "Manutenção", "Impostos", "Marketing", "Outros"];
const PAY_METHODS = ["Dinheiro", "PIX", "Cartão de crédito", "Cartão de débito", "Transferência", "Boleto", "Convênio"];

const STATUS_STYLES: Record<string, string> = {
  pago: "bg-green-100 text-green-800 border-green-200",
  pendente: "bg-yellow-100 text-yellow-800 border-yellow-200",
  vencido: "bg-red-100 text-red-800 border-red-200",
};

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtDate = (s?: string | null) => { if (!s) return "-"; const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };

const today = new Date().toISOString().split("T")[0];

type FormState = {
  description: string; type: string; amount: string; paymentStatus: string;
  category: string; supplier: string; dueDate: string; paymentDate: string;
  patientId: string; paymentMethod: string; notes: string;
};

const emptyForm: FormState = {
  description: "", type: "receita", amount: "", paymentStatus: "pendente",
  category: "", supplier: "", dueDate: "", paymentDate: "",
  patientId: "", paymentMethod: "", notes: "",
};

export default function Financial() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("receitas");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<FinancialRecord | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const now = new Date();
  const [summaryMonth, setSummaryMonth] = useState(String(getMonth(now) + 1));
  const [summaryYear, setSummaryYear] = useState(String(getYear(now)));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["financial"] });
    queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  };

  const { data: allRecords = [], isLoading } = useQuery<FinancialRecord[]>({
    queryKey: ["financial"],
    queryFn: () => apiFetch("/api/financial"),
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ["financial-summary", summaryMonth, summaryYear],
    queryFn: () => apiFetch(`/api/financial/summary?month=${summaryMonth}&year=${summaryYear}`),
  });

  const { data: patients = [] } = useQuery<any[]>({
    queryKey: ["patients"],
    queryFn: () => apiFetch("/api/patients"),
  });

  const createMut = useMutation({
    mutationFn: (data: FormState) => apiFetch("/api/financial", { method: "POST", body: JSON.stringify({ ...data, amount: parseFloat(data.amount) || 0, patientId: data.patientId || null }) }),
    onSuccess: () => { toast({ title: "Registro criado com sucesso" }); setIsDialogOpen(false); invalidate(); },
    onError: (e: any) => toast({ title: e.message || "Erro ao criar registro", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormState }) => apiFetch(`/api/financial/${id}`, { method: "PUT", body: JSON.stringify({ ...data, amount: parseFloat(data.amount) || 0, patientId: data.patientId || null }) }),
    onSuccess: () => { toast({ title: "Registro atualizado" }); setIsDialogOpen(false); invalidate(); },
    onError: (e: any) => toast({ title: e.message || "Erro ao atualizar", variant: "destructive" }),
  });

  const payMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/financial/${id}/pay`, { method: "PATCH" }),
    onSuccess: () => { toast({ title: "Marcado como pago!" }); invalidate(); },
    onError: (e: any) => toast({ title: e.message || "Erro", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/financial/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Registro removido" }); setDeletingRecord(null); invalidate(); },
    onError: (e: any) => toast({ title: e.message || "Erro ao remover", variant: "destructive" }),
  });

  function openCreate(type: "receita" | "despesa") {
    setEditingRecord(null);
    setForm({ ...emptyForm, type });
    setIsDialogOpen(true);
  }

  function openEdit(r: FinancialRecord) {
    setEditingRecord(r);
    setForm({
      description: r.description, type: r.type, amount: String(r.amount),
      paymentStatus: r.paymentStatus, category: r.category || "",
      supplier: r.supplier || "", dueDate: r.dueDate || "", paymentDate: r.paymentDate || "",
      patientId: r.patientId ? String(r.patientId) : "", paymentMethod: r.paymentMethod || "",
      notes: r.notes || "",
    });
    setIsDialogOpen(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description || !form.amount) {
      toast({ title: "Preencha a descrição e o valor", variant: "destructive" }); return;
    }
    if (editingRecord) updateMut.mutate({ id: editingRecord.id, data: form });
    else createMut.mutate(form);
  }

  const receitas = allRecords.filter(r => r.type === "receita");
  const despesas = allRecords.filter(r => r.type === "despesa");
  const overdueCount = despesas.filter(r => r.paymentStatus === "pendente" && r.dueDate && r.dueDate < today).length;

  const RecordRow = ({ r }: { r: FinancialRecord }) => {
    const isOverdue = r.paymentStatus === "pendente" && r.dueDate && r.dueDate < today;
    return (
      <div className={`flex items-start gap-3 p-4 rounded-lg border transition-colors hover:bg-muted/30 ${isOverdue ? "border-red-200 bg-red-50/30" : "border-border"}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{r.description}</span>
            {r.category && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{r.category}</span>}
            {isOverdue && <span className="text-xs text-red-600 font-medium">VENCIDO</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {r.patientName && <span className="text-xs text-muted-foreground">Paciente: {r.patientName}</span>}
            {r.supplier && <span className="text-xs text-muted-foreground">Fornecedor: {r.supplier}</span>}
            {r.dueDate && <span className="text-xs text-muted-foreground">Venc.: {fmtDate(r.dueDate)}</span>}
            {r.paymentDate && <span className="text-xs text-muted-foreground">Pago em: {fmtDate(r.paymentDate)}</span>}
            {r.paymentMethod && <span className="text-xs text-muted-foreground">{r.paymentMethod}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-base font-bold ${r.type === "receita" ? "text-green-600" : "text-red-600"}`}>
            {r.type === "receita" ? "+" : "-"}{fmt(r.amount)}
          </span>
          <Badge variant="outline" className={`text-xs ${STATUS_STYLES[r.paymentStatus] || ""}`}>
            {r.paymentStatus === "pago" ? "Pago" : r.paymentStatus === "pendente" ? "Pendente" : "Vencido"}
          </Badge>
          <div className="flex gap-1">
            {r.paymentStatus !== "pago" && (
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-green-600 hover:bg-green-50" onClick={() => payMut.mutate(r.id)}>
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(r)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-destructive hover:bg-red-50" onClick={() => setDeletingRecord(r)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground mt-1">Controle de receitas e contas a pagar</p>
        </div>
      </div>

      {/* Resumo */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex gap-2 items-center">
          <Label className="text-sm">Mês:</Label>
          <Select value={summaryMonth} onValueChange={setSummaryMonth}>
            <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={summaryYear} onValueChange={setSummaryYear}>
            <SelectTrigger className="w-24 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2023, 2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Total Recebido", value: fmt(summary.totalReceitas), icon: TrendingUp, color: "border-l-green-500", textColor: "text-green-600" },
            { label: "Total Despesas", value: fmt(summary.totalDespesas), icon: TrendingDown, color: "border-l-red-500", textColor: "text-red-600" },
            { label: "Saldo", value: fmt(summary.saldo), icon: DollarSign, color: `border-l-${summary.saldo >= 0 ? "emerald" : "red"}-500`, textColor: `text-${summary.saldo >= 0 ? "emerald" : "red"}-600` },
            { label: "Pendente", value: fmt(summary.totalPendente), icon: Wallet, color: "border-l-yellow-500", textColor: "text-yellow-600" },
            { label: "Vencido", value: fmt(summary.totalVencido), icon: AlertTriangle, color: `border-l-${summary.totalVencido > 0 ? "red" : "gray"}-500`, textColor: `text-${summary.totalVencido > 0 ? "red" : "gray"}-600` },
          ].map((c) => (
            <Card key={c.label} className={`border-l-4 ${c.color} shadow-sm`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
                <c.icon className={`h-4 w-4 ${c.textColor}`} />
              </CardHeader>
              <CardContent><div className={`text-xl font-bold ${c.textColor}`}>{c.value}</div></CardContent>
            </Card>
          ))}
        </div>
      )}

      {overdueCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{overdueCount} conta{overdueCount > 1 ? "s" : ""} vencida{overdueCount > 1 ? "s" : ""} aguardando pagamento</span>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="receitas">
            <TrendingUp className="h-4 w-4 mr-2" /> Receitas ({receitas.length})
          </TabsTrigger>
          <TabsTrigger value="despesas">
            <TrendingDown className="h-4 w-4 mr-2" /> Contas a Pagar ({despesas.length})
            {overdueCount > 0 && <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{overdueCount}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="receitas" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Button onClick={() => openCreate("receita")} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Receita
            </Button>
          </div>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : receitas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Nenhuma receita registrada.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {receitas.map(r => <RecordRow key={r.id} r={r} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="despesas" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Button onClick={() => openCreate("despesa")} className="gap-2 bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4" /> Nova Conta a Pagar
            </Button>
          </div>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : despesas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Nenhuma conta a pagar registrada.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Vencidas primeiro */}
              {[...despesas].sort((a, b) => {
                const aOv = a.paymentStatus === "pendente" && a.dueDate && a.dueDate < today;
                const bOv = b.paymentStatus === "pendente" && b.dueDate && b.dueDate < today;
                if (aOv && !bOv) return -1;
                if (!aOv && bOv) return 1;
                return (a.dueDate || "").localeCompare(b.dueDate || "");
              }).map(r => <RecordRow key={r.id} r={r} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog de criação/edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? "Editar Registro" : form.type === "receita" ? "Nova Receita" : "Nova Conta a Pagar"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v, category: "" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa / Conta a Pagar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input placeholder="Ex: Sessão de fisioterapia" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$) *</Label>
                <Input type="number" min="0" step="0.01" placeholder="0,00" value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category || ""} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {(form.type === "receita" ? CATS_RECEITA : CATS_DESPESA).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.type === "despesa" && (
              <div>
                <Label>Fornecedor</Label>
                <Input placeholder="Nome do fornecedor" value={form.supplier}
                  onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))} />
              </div>
            )}
            {form.type === "receita" && (
              <div>
                <Label>Paciente</Label>
                <Select value={form.patientId || "none"} onValueChange={v => setForm(p => ({ ...p, patientId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar paciente..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {(patients as any[]).map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vencimento</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
              </div>
              <div>
                <Label>Data de Pagamento</Label>
                <Input type="date" value={form.paymentDate} onChange={e => setForm(p => ({ ...p, paymentDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.paymentStatus} onValueChange={v => setForm(p => ({ ...p, paymentStatus: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={form.paymentMethod || ""} onValueChange={v => setForm(p => ({ ...p, paymentMethod: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {PAY_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} placeholder="Observações..." value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingRecord ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingRecord} onOpenChange={open => !open && setDeletingRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Registro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deletingRecord?.description}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingRecord && deleteMut.mutate(deletingRecord.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
