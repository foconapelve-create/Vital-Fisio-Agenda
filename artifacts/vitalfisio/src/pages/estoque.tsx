import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Plus, Pencil, Trash2, ArrowDown, ArrowUp, AlertTriangle,
  Search, RefreshCw, CalendarClock, DollarSign, Boxes,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Item = {
  id: number; name: string; category: string; currentQty: number; unit: string;
  minQty: number; supplier?: string | null; unitCost?: number | null;
  expiryDate?: string | null; notes?: string | null; isLowStock: boolean;
};

type Movement = {
  id: number; itemId: number; itemName: string; unit: string;
  type: string; qty: number; responsavel?: string | null;
  notes?: string | null; date: string; createdAt: string;
};

type Summary = { total: number; lowStock: number; expiringSoon: number; totalValue: number };

const CATEGORIES = ["geral","material_clinico","medicamento","equipamento","limpeza","escritorio","outro"];
const CAT_LABELS: Record<string, string> = {
  geral:"Geral", material_clinico:"Material Clínico", medicamento:"Medicamento",
  equipamento:"Equipamento", limpeza:"Limpeza", escritorio:"Escritório", outro:"Outro",
};
const UNITS = ["unidade","caixa","frasco","rolo","pacote","par","litro","ml","kg","g","metro","outro"];

const fmtDate = (s?: string | null) => {
  if (!s) return "-";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

const fmtCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const emptyItem = {
  name: "", category: "material_clinico", currentQty: "0", unit: "unidade",
  minQty: "1", supplier: "", unitCost: "", expiryDate: "", notes: "",
};

const today = format(new Date(), "yyyy-MM-dd");

export default function Estoque() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState("itens");

  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [itemForm, setItemForm] = useState(emptyItem);

  const [movOpen, setMovOpen] = useState(false);
  const [movItem, setMovItem] = useState<Item | null>(null);
  const [movForm, setMovForm] = useState({ type: "entrada", qty: "", responsavel: "", notes: "", date: today });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
  };

  const { data: summary } = useQuery<Summary>({
    queryKey: ["inventory-summary"],
    queryFn: () => apiFetch("/api/inventory/summary"),
  });

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["inventory-items", filter],
    queryFn: () => apiFetch(`/api/inventory/items${filter !== "all" ? `?filter=${filter}` : ""}`),
  });

  const { data: movements = [], isLoading: movLoading } = useQuery<Movement[]>({
    queryKey: ["inventory-movements"],
    queryFn: () => apiFetch("/api/inventory/movements"),
    enabled: tab === "movimentacoes",
  });

  const createMut = useMutation({
    mutationFn: (d: any) => apiFetch("/api/inventory/items", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { toast({ title: "Item cadastrado com sucesso!" }); invalidate(); setItemOpen(false); },
    onError: (e: any) => toast({ title: e.message || "Erro ao cadastrar", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => apiFetch(`/api/inventory/items/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Item atualizado!" }); invalidate(); setItemOpen(false); setEditingItem(null); },
    onError: (e: any) => toast({ title: e.message || "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/inventory/items/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Item removido" }); invalidate(); setDeletingItem(null); },
    onError: (e: any) => toast({ title: e.message || "Erro ao remover", variant: "destructive" }),
  });

  const movMut = useMutation({
    mutationFn: (d: any) => apiFetch("/api/inventory/movements", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: (data: any) => {
      toast({ title: `Movimentação registrada! Novo estoque: ${data.newQty} ${movItem?.unit}` });
      invalidate();
      setMovOpen(false);
      setMovItem(null);
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao registrar movimentação", variant: "destructive" }),
  });

  function openCreate() {
    setEditingItem(null);
    setItemForm(emptyItem);
    setItemOpen(true);
  }

  function openEdit(item: Item) {
    setEditingItem(item);
    setItemForm({
      name: item.name, category: item.category,
      currentQty: String(item.currentQty), unit: item.unit,
      minQty: String(item.minQty), supplier: item.supplier || "",
      unitCost: item.unitCost != null ? String(item.unitCost) : "",
      expiryDate: item.expiryDate || "", notes: item.notes || "",
    });
    setItemOpen(true);
  }

  function openMov(item: Item) {
    setMovItem(item);
    setMovForm({ type: "entrada", qty: "", responsavel: "", notes: "", date: today });
    setMovOpen(true);
  }

  function handleItemSubmit() {
    if (!itemForm.name.trim()) {
      toast({ title: "Nome do item é obrigatório", variant: "destructive" }); return;
    }
    const payload = {
      name: itemForm.name, category: itemForm.category,
      currentQty: parseFloat(itemForm.currentQty) || 0,
      unit: itemForm.unit, minQty: parseFloat(itemForm.minQty) || 0,
      supplier: itemForm.supplier || null,
      unitCost: itemForm.unitCost ? parseFloat(itemForm.unitCost) : null,
      expiryDate: itemForm.expiryDate || null, notes: itemForm.notes || null,
    };
    if (editingItem) updateMut.mutate({ id: editingItem.id, data: payload });
    else createMut.mutate(payload);
  }

  function handleMovSubmit() {
    if (!movForm.qty || parseFloat(movForm.qty) <= 0) {
      toast({ title: "Informe uma quantidade válida", variant: "destructive" }); return;
    }
    movMut.mutate({ itemId: movItem?.id, type: movForm.type, qty: parseFloat(movForm.qty), responsavel: movForm.responsavel || null, notes: movForm.notes || null, date: movForm.date });
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const t = search.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(t) || (i.supplier || "").toLowerCase().includes(t) || CAT_LABELS[i.category]?.toLowerCase().includes(t));
  }, [items, search]);

  const isExpired = (d?: string | null) => d && d < today;
  const isExpiringSoon = (d?: string | null) => {
    if (!d) return false;
    const diff = (new Date(d).getTime() - Date.now()) / 86400000;
    return diff >= 0 && diff <= 30;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-8 w-8 text-primary" /> Controle de Material e Estoque
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie materiais, insumos e estoque da clínica</p>
        </div>
        <Button className="gap-1.5" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Novo Item
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total de Itens", value: summary?.total ?? 0, icon: Boxes, color: "text-primary" },
          { label: "Estoque Baixo", value: summary?.lowStock ?? 0, icon: AlertTriangle, color: summary?.lowStock ? "text-orange-600" : "text-muted-foreground" },
          { label: "Venc. em 30 dias", value: summary?.expiringSoon ?? 0, icon: CalendarClock, color: summary?.expiringSoon ? "text-red-600" : "text-muted-foreground" },
          { label: "Valor Estimado", value: fmtCurrency(summary?.totalValue ?? 0), icon: DollarSign, color: "text-teal-600", isText: true },
        ].map(s => (
          <Card key={s.label} className="border shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={cn("h-4 w-4", s.color)} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="itens" className="gap-1.5"><Package className="h-3.5 w-3.5" /> Itens</TabsTrigger>
          <TabsTrigger value="movimentacoes" className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Movimentações</TabsTrigger>
        </TabsList>

        {/* ── ITENS TAB ─────────────────────────────────────── */}
        <TabsContent value="itens" className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar item, fornecedor ou categoria..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex rounded-lg border overflow-hidden text-xs">
              {[
                { v: "all", l: "Todos" },
                { v: "low_stock", l: "Estoque Baixo" },
                { v: "expiring", l: "Venc. em 30d" },
                { v: "expired", l: "Vencidos" },
              ].map(f => (
                <button key={f.v} onClick={() => setFilter(f.v)}
                  className={cn("px-3 py-1.5 font-medium transition-colors",
                    filter === f.v ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                  {f.l}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Package className="h-14 w-14 opacity-20" />
              <p className="text-base font-medium">Nenhum item encontrado</p>
              <Button variant="outline" size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" /> Cadastrar primeiro item</Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Item</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Categoria</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Qtd Atual</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Qtd Mín</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Fornecedor</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Validade</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => {
                    const expired = isExpired(item.expiryDate);
                    const expiring = isExpiringSoon(item.expiryDate);
                    return (
                      <tr key={item.id} className={cn("border-b last:border-0 hover:bg-muted/30", idx % 2 === 0 ? "" : "bg-muted/10")}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <span className="font-medium">{item.name}</span>
                              {item.isLowStock && <AlertTriangle className="h-3.5 w-3.5 text-orange-500 inline ml-1.5" title="Estoque baixo" />}
                              {expired && <Badge variant="outline" className="ml-2 text-[10px] bg-red-50 text-red-700 border-red-200">Vencido</Badge>}
                              {!expired && expiring && <Badge variant="outline" className="ml-2 text-[10px] bg-amber-50 text-amber-700 border-amber-200">Vence em breve</Badge>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{CAT_LABELS[item.category] || item.category}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("font-semibold", item.isLowStock ? "text-orange-600" : "text-foreground")}>
                            {item.currentQty}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground hidden md:table-cell">{item.minQty} {item.unit}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{item.supplier || "-"}</td>
                        <td className={cn("px-4 py-3 hidden lg:table-cell", expired ? "text-red-600 font-medium" : expiring ? "text-amber-600" : "text-muted-foreground")}>
                          {fmtDate(item.expiryDate)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50" title="Entrada/Saída" onClick={() => openMov(item)}>
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingItem(item)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── MOVIMENTAÇÕES TAB ─────────────────────────────── */}
        <TabsContent value="movimentacoes" className="space-y-4">
          {movLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded animate-pulse" />)}</div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <RefreshCw className="h-12 w-12 opacity-20" />
              <p className="font-medium">Nenhuma movimentação registrada</p>
              <p className="text-sm">Use o botão de movimentação em qualquer item para registrar entrada ou saída.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Item</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Qtd</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Responsável</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m, idx) => (
                    <tr key={m.id} className={cn("border-b last:border-0 hover:bg-muted/30", idx % 2 === 0 ? "" : "bg-muted/10")}>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(m.date)}</td>
                      <td className="px-4 py-3 font-medium">{m.itemName}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={cn("gap-1 text-xs", m.type === "entrada" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>
                          {m.type === "entrada" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                          {m.type === "entrada" ? "Entrada" : "Saída"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">{m.qty} <span className="text-xs text-muted-foreground font-normal">{m.unit}</span></td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{m.responsavel || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{m.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Item Dialog ─────────────────────────────────────── */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Item" : "Novo Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome do Material / Produto *</Label>
              <Input placeholder="Ex: Bandagem elástica, Álcool 70%, Agulha..." value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Categoria</Label>
                <Select value={itemForm.category} onValueChange={v => setItemForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Unidade de Medida</Label>
                <Select value={itemForm.unit} onValueChange={v => setItemForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Quantidade Atual</Label>
                <Input type="number" min="0" step="0.01" value={itemForm.currentQty} onChange={e => setItemForm(f => ({ ...f, currentQty: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Quantidade Mínima (alerta)</Label>
                <Input type="number" min="0" step="0.01" value={itemForm.minQty} onChange={e => setItemForm(f => ({ ...f, minQty: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Valor Unitário (R$)</Label>
                <Input type="number" min="0" step="0.01" placeholder="0,00" value={itemForm.unitCost} onChange={e => setItemForm(f => ({ ...f, unitCost: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Data de Validade</Label>
                <Input type="date" value={itemForm.expiryDate} onChange={e => setItemForm(f => ({ ...f, expiryDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Fornecedor</Label>
              <Input placeholder="Nome do fornecedor" value={itemForm.supplier} onChange={e => setItemForm(f => ({ ...f, supplier: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Observações</Label>
              <Textarea placeholder="Informações adicionais sobre o item..." rows={2} value={itemForm.notes} onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)}>Cancelar</Button>
            <Button onClick={handleItemSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {editingItem ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Movement Dialog ──────────────────────────────────── */}
      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Movimentação — {movItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo de Movimentação *</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setMovForm(f => ({ ...f, type: "entrada" }))}
                  className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                    movForm.type === "entrada" ? "bg-green-50 border-green-400 text-green-700" : "hover:bg-muted")}>
                  <ArrowDown className="h-4 w-4" /> Entrada
                </button>
                <button
                  onClick={() => setMovForm(f => ({ ...f, type: "saida" }))}
                  className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                    movForm.type === "saida" ? "bg-red-50 border-red-400 text-red-700" : "hover:bg-muted")}>
                  <ArrowUp className="h-4 w-4" /> Saída
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Quantidade * <span className="text-muted-foreground">({movItem?.unit})</span>
                </Label>
                <Input type="number" min="0.01" step="0.01" placeholder="0" value={movForm.qty} onChange={e => setMovForm(f => ({ ...f, qty: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Data *</Label>
                <Input type="date" value={movForm.date} onChange={e => setMovForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            {movItem && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                Estoque atual: <strong>{movItem.currentQty} {movItem.unit}</strong>
                {movForm.qty && parseFloat(movForm.qty) > 0 && (
                  <> → <strong className={movForm.type === "entrada" ? "text-green-600" : "text-red-600"}>
                    {movForm.type === "entrada"
                      ? movItem.currentQty + parseFloat(movForm.qty)
                      : movItem.currentQty - parseFloat(movForm.qty)} {movItem.unit}
                  </strong></>
                )}
              </p>
            )}
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Responsável</Label>
              <Input placeholder="Nome de quem registrou" value={movForm.responsavel} onChange={e => setMovForm(f => ({ ...f, responsavel: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Observação</Label>
              <Input placeholder="Motivo ou observação (opcional)" value={movForm.notes} onChange={e => setMovForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovOpen(false)}>Cancelar</Button>
            <Button onClick={handleMovSubmit} disabled={movMut.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ────────────────────────────────────── */}
      <AlertDialog open={!!deletingItem} onOpenChange={open => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deletingItem?.name}</strong>? Todo o histórico de movimentações também será removido. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingItem && deleteMut.mutate(deletingItem.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
