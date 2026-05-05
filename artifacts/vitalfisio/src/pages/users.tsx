import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Users, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, KeyRound,
  Search, CheckCircle2, XCircle, Eye, EyeOff, Shield, UserCheck, Wallet,
  Stethoscope, UserCog, Settings2, ImageIcon, Save,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/contexts/AppSettingsContext";

// ── Types ──────────────────────────────────────────────────────────────────────

type User = {
  id: number; username: string; name: string; email?: string | null;
  phone?: string | null; role: string; active: boolean; createdAt: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const roleConfig: Record<string, { label: string; icon: any; color: string }> = {
  admin:         { label: "Administrador",        icon: Shield,       color: "bg-purple-100 text-purple-800 border-purple-300" },
  profissional:  { label: "Profissional da Saúde",icon: Stethoscope,  color: "bg-blue-100 text-blue-800 border-blue-300" },
  fisioterapeuta:{ label: "Profissional da Saúde",icon: Stethoscope,  color: "bg-blue-100 text-blue-800 border-blue-300" },
  financeiro:    { label: "Financeiro",            icon: Wallet,       color: "bg-green-100 text-green-800 border-green-300" },
  recepcao:      { label: "Recepção",              icon: UserCheck,    color: "bg-cyan-100 text-cyan-800 border-cyan-300" },
};

function RoleBadge({ role }: { role: string }) {
  const cfg = roleConfig[role] || { label: role, icon: UserCog, color: "bg-muted text-muted-foreground" };
  const Icon = cfg.icon;
  return (
    <Badge className={cn("border text-xs gap-1 font-normal", cfg.color)}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </Badge>
  );
}

const emptyForm = { name: "", username: "", email: "", phone: "", password: "", confirmPassword: "", role: "profissional" };

// ── Main Component ─────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [newPwd, setNewPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showEditPwd, setShowEditPwd] = useState(false);

  const { toast } = useToast();
  const qc = useQueryClient();
  const appSettings = useAppSettings();

  // ── System Settings ───────────────────────────────────────────────────────────
  const [sysForm, setSysForm] = useState({
    systemName: appSettings.systemName,
    logoUrl: appSettings.logoUrl || "",
    nomeClinica: appSettings.nomeClinica || "",
  });

  useEffect(() => {
    setSysForm({
      systemName: appSettings.systemName,
      logoUrl: appSettings.logoUrl || "",
      nomeClinica: appSettings.nomeClinica || "",
    });
  }, [appSettings.systemName, appSettings.logoUrl, appSettings.nomeClinica]);

  const saveSettingsMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/settings/system", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "✅ Configurações salvas! Recarregue para ver o novo nome." });
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao salvar", variant: "destructive" }),
  });

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => apiFetch("/api/users"),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/users", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast({ title: "✅ Usuário criado com sucesso!" }); closeDialog(); },
    onError: (e: any) => toast({ title: e.message || "Erro", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => apiFetch(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast({ title: "✅ Usuário atualizado!" }); closeDialog(); },
    onError: (e: any) => toast({ title: e.message || "Erro", variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/users/${id}/toggle-active`, { method: "PATCH", body: "{}" }),
    onSuccess: (u: User) => { qc.invalidateQueries({ queryKey: ["users"] }); toast({ title: u.active ? "✅ Usuário ativado" : "Usuário desativado" }); },
    onError: (e: any) => toast({ title: e.message || "Erro", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast({ title: "Usuário excluído" }); setDeleteUser(null); },
    onError: (e: any) => toast({ title: e.message || "Erro", variant: "destructive" }),
  });

  const resetPwdMut = useMutation({
    mutationFn: ({ id, password }: any) => apiFetch(`/api/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
    onSuccess: (data: any) => { toast({ title: `✅ Senha de ${data.user} redefinida!` }); setResetUser(null); setNewPwd(""); },
    onError: (e: any) => toast({ title: e.message || "Erro", variant: "destructive" }),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  const openCreate = () => { setEditUser(null); setForm({ ...emptyForm }); setDialogOpen(true); };
  const openEdit = (u: User) => {
    setEditUser(u);
    setForm({ name: u.name, username: u.username, email: u.email||"", phone: u.phone||"", password: "", confirmPassword: "", role: u.role });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditUser(null); setForm({ ...emptyForm }); };

  const onSave = () => {
    if (editUser) {
      updateMut.mutate({ id: editUser.id, data: { name: form.name, email: form.email, phone: form.phone, role: form.role } });
    } else {
      if (form.password.length < 6) { toast({ title: "Senha mínima de 6 caracteres", variant: "destructive" }); return; }
      if (form.password !== form.confirmPassword) { toast({ title: "Senhas não conferem", variant: "destructive" }); return; }
      createMut.mutate(form);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    ativos: users.filter(u => u.active).length,
    admins: users.filter(u => u.role === "admin").length,
    profissionais: users.filter(u => u.role === "profissional" || u.role === "fisioterapeuta").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Users className="h-8 w-8 text-purple-600" /> Gestão de Usuários
          </h1>
          <p className="text-muted-foreground mt-1">Controle de acesso e perfis do sistema</p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Novo Usuário
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border shadow-none"><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-purple-600">{stats.total}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total de Usuários</div>
        </CardContent></Card>
        <Card className="border shadow-none"><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.ativos}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Ativos</div>
        </CardContent></Card>
        <Card className="border shadow-none"><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-purple-500">{stats.admins}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Administradores</div>
        </CardContent></Card>
        <Card className="border shadow-none"><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-blue-500">{stats.profissionais}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Profissionais</div>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome, usuário ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* User list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-muted-foreground gap-3">
          <Users className="h-16 w-16 opacity-10" />
          <p>Nenhum usuário encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map(u => (
            <Card key={u.id} className={cn("border shadow-sm hover:shadow-md transition-all", !u.active && "opacity-60")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Avatar */}
                  <div className={cn("w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0",
                    u.role === "admin" ? "bg-purple-500" : u.role === "financeiro" ? "bg-green-500" : "bg-blue-500")}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{u.name}</span>
                      <RoleBadge role={u.role} />
                      {u.active ? (
                        <Badge className="bg-green-50 text-green-700 border-green-200 border text-xs gap-1 font-normal">
                          <CheckCircle2 className="h-3 w-3" /> Ativo
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600 border-gray-200 border text-xs gap-1 font-normal">
                          <XCircle className="h-3 w-3" /> Inativo
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-muted-foreground">
                      <span>@{u.username}</span>
                      {u.email && <span>{u.email}</span>}
                      {u.phone && <span>{u.phone}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 flex-wrap shrink-0">
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => openEdit(u)}>
                      <Edit2 className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => { setResetUser(u); setNewPwd(""); }}>
                      <KeyRound className="h-3.5 w-3.5" /> Senha
                    </Button>
                    <Button variant="outline" size="sm" className={cn("h-8 gap-1 text-xs", u.active ? "text-orange-600 border-orange-300" : "text-green-600 border-green-300")}
                      onClick={() => toggleMut.mutate(u.id)}>
                      {u.active ? <><ToggleRight className="h-3.5 w-3.5" /> Desativar</> : <><ToggleLeft className="h-3.5 w-3.5" /> Ativar</>}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => setDeleteUser(u)}>
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create/Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={o => !o && closeDialog()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editUser ? <><Edit2 className="h-5 w-5 text-blue-600" /> Editar Usuário</> : <><Plus className="h-5 w-5 text-purple-600" /> Novo Usuário</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome completo <span className="text-red-500">*</span></Label>
              <Input className="mt-1" placeholder="Maria da Silva" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            {!editUser && (
              <div>
                <Label>Nome de usuário</Label>
                <Input className="mt-1" placeholder="mariasilva (gerado automaticamente)" value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
              </div>
            )}
            {editUser && (
              <div className="p-2 bg-muted/50 rounded text-sm">
                <span className="text-muted-foreground">Usuário: </span>
                <span className="font-mono font-medium">@{editUser.username}</span>
                <span className="text-xs text-muted-foreground ml-2">(não editável)</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>E-mail</Label>
                <Input type="email" className="mt-1" placeholder="email@exemplo.com" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input className="mt-1" placeholder="(00) 00000-0000" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Perfil de acesso <span className="text-red-500">*</span></Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador — acesso total</SelectItem>
                  <SelectItem value="profissional">Profissional da Saúde — agenda e evolução</SelectItem>
                  <SelectItem value="recepcao">Recepção — agenda e pacientes</SelectItem>
                  <SelectItem value="financeiro">Financeiro — financeiro e relatórios</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!editUser && (
              <>
                <div>
                  <Label>Senha <span className="text-red-500">*</span></Label>
                  <div className="relative mt-1">
                    <Input type={showPwd ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="pr-10" />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full w-10 p-0"
                      onClick={() => setShowPwd(p => !p)}>
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Confirmar senha <span className="text-red-500">*</span></Label>
                  <Input type="password" className="mt-1" placeholder="Repita a senha" value={form.confirmPassword}
                    onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} />
                  {form.confirmPassword && form.password !== form.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Senhas não conferem</p>
                  )}
                </div>
              </>
            )}

            {/* Permissions info */}
            <div className="p-3 bg-muted/50 border rounded text-xs space-y-1.5">
              {form.role === "admin" && (
                <>
                  <p className="font-medium text-purple-700 flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Administrador — acesso completo:</p>
                  <p className="text-muted-foreground">Dashboard, Agenda, Pacientes, Fisioterapeutas, Financeiro, NFSe, Relatórios, Atestados, Aniversariantes, Planner, Gestão de Usuários</p>
                </>
              )}
              {(form.role === "profissional" || form.role === "fisioterapeuta") && (
                <>
                  <p className="font-medium text-blue-700 flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" /> Profissional da Saúde:</p>
                  <p className="text-muted-foreground">Agenda, Pacientes, Relatórios, Rel. Fisioterapêutico, Atestados, Aniversariantes, Planner. Sem acesso ao financeiro completo.</p>
                </>
              )}
              {form.role === "recepcao" && (
                <>
                  <p className="font-medium text-cyan-700 flex items-center gap-1"><UserCheck className="h-3.5 w-3.5" /> Recepção:</p>
                  <p className="text-muted-foreground">Dashboard, Agenda Geral, Fisio. Pélvica, Agenda Bebês, Confirmações, Aniversariantes, Pacientes. Sem acesso a financeiro ou configurações.</p>
                </>
              )}
              {form.role === "financeiro" && (
                <>
                  <p className="font-medium text-green-700 flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> Financeiro:</p>
                  <p className="text-muted-foreground">Dashboard, Financeiro, Pacientes, Aniversariantes, Relatórios, Estoque.</p>
                </>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button className="flex-1 gap-2" onClick={onSave} disabled={createMut.isPending || updateMut.isPending}>
                {editUser ? <><Edit2 className="h-4 w-4" /> Salvar alterações</> : <><Plus className="h-4 w-4" /> Criar usuário</>}
              </Button>
              <Button variant="ghost" onClick={closeDialog}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!resetUser} onOpenChange={o => !o && setResetUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-orange-500" /> Redefinir senha de {resetUser?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nova senha (mínimo 6 caracteres)</Label>
              <div className="relative mt-1">
                <Input type={showEditPwd ? "text" : "password"} placeholder="Nova senha..." value={newPwd}
                  onChange={e => setNewPwd(e.target.value)} className="pr-10" />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full w-10 p-0"
                  onClick={() => setShowEditPwd(p => !p)}>
                  {showEditPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 gap-2" onClick={() => resetPwdMut.mutate({ id: resetUser!.id, password: newPwd })}
                disabled={newPwd.length < 6 || resetPwdMut.isPending}>
                <KeyRound className="h-4 w-4" /> {resetPwdMut.isPending ? "Salvando..." : "Salvar senha"}
              </Button>
              <Button variant="ghost" onClick={() => setResetUser(null)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── System Settings ───────────────────────────────────────────────── */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-purple-600" /> Configurações do Sistema
          </CardTitle>
          <p className="text-xs text-muted-foreground">Nome e identidade visual do sistema exibidos em todo o aplicativo.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Nome do Sistema <span className="text-red-500">*</span></Label>
              <Input className="mt-1" placeholder="CliniSmart" value={sysForm.systemName}
                onChange={e => setSysForm(f => ({ ...f, systemName: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Aparece na sidebar, login, documentos e e-mails.</p>
            </div>
            <div>
              <Label>Nome da Clínica</Label>
              <Input className="mt-1" placeholder="Nome da sua clínica" value={sysForm.nomeClinica}
                onChange={e => setSysForm(f => ({ ...f, nomeClinica: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Usado em atestados e documentos clínicos.</p>
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> URL da Logo (opcional)</Label>
            <Input className="mt-1" type="url" placeholder="https://seusite.com/logo.png" value={sysForm.logoUrl}
              onChange={e => setSysForm(f => ({ ...f, logoUrl: e.target.value }))} />
            <p className="text-xs text-muted-foreground mt-1">Cole o link direto de uma imagem PNG/SVG. Deixe vazio para usar o ícone padrão.</p>
          </div>
          {sysForm.logoUrl && (
            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
              <img src={sysForm.logoUrl} alt="Preview" className="w-12 h-12 rounded-lg object-contain bg-white border" onError={e => (e.currentTarget.style.display = "none")} />
              <div>
                <p className="text-sm font-medium">{sysForm.systemName || "CliniSmart"}</p>
                <p className="text-xs text-muted-foreground">Prévia da logo na sidebar</p>
              </div>
            </div>
          )}
          <Button className="gap-2" onClick={() => saveSettingsMut.mutate({
            systemName: sysForm.systemName || "CliniSmart",
            logoUrl: sysForm.logoUrl || null,
            nomeClinica: sysForm.nomeClinica || null,
          })} disabled={!sysForm.systemName.trim() || saveSettingsMut.isPending}>
            <Save className="h-4 w-4" />
            {saveSettingsMut.isPending ? "Salvando..." : "Salvar configurações"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteUser} onOpenChange={o => !o && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700 flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Excluir usuário?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{deleteUser?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteUser && deleteMut.mutate(deleteUser.id)}
              disabled={deleteMut.isPending}>
              {deleteMut.isPending ? "Excluindo..." : "Confirmar exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
