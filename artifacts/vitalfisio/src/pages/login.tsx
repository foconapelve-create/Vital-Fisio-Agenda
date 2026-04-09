import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Eye, EyeOff, Mail, ArrowLeft, UserPlus, KeyRound, CheckCircle2, Loader2, Copy, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/contexts/AppSettingsContext";

const loginSchema = z.object({
  username: z.string().min(1, "Usuário é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});
type LoginForm = z.infer<typeof loginSchema>;

type Modal = "none" | "forgot" | "register";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const login = useLogin();
  const { systemName, logoUrl } = useAppSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [modal, setModal] = useState<Modal>("none");

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");

  // Register state
  const [regForm, setRegForm] = useState({
    name: "", username: "", email: "", phone: "", password: "", confirmPassword: "", role: "profissional",
  });
  const [regLoading, setRegLoading] = useState(false);
  const [regShowPwd, setRegShowPwd] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    login.mutate({ data }, {
      onSuccess: () => {
        setLocation("/");
      },
      onError: (err) => {
        toast({ title: "Erro no login", description: (err as any).error?.error || "Credenciais inválidas", variant: "destructive" });
        setIsLoading(false);
      }
    });
  };

  const onForgot = async () => {
    if (!forgotEmail.trim()) { toast({ title: "Informe seu e-mail", variant: "destructive" }); return; }
    setForgotLoading(true);
    try {
      const data = await apiFetch("/api/auth/forgot-password", {
        method: "POST", body: JSON.stringify({ email: forgotEmail }),
      });
      if (data.token) {
        setResetToken(data.token);
        setResetEmail(forgotEmail);
      } else {
        toast({ title: "✅ " + data.message });
        setModal("none");
      }
    } catch (e: any) {
      toast({ title: e.message || "E-mail não encontrado", variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  const copyResetLink = () => {
    const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, "");
    const link = `${base}/reset-password/${resetToken}`;
    navigator.clipboard.writeText(link).then(() => toast({ title: "Link copiado!" }));
  };

  const openResetLink = () => {
    const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, "");
    window.location.href = `${base}/reset-password/${resetToken}`;
  };

  const openResetEmail = () => {
    if (!resetToken || !resetEmail) return;
    const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, "");
    const link = `${base}/reset-password/${resetToken}`;
    const subject = `Redefinição de senha — ${systemName}`;
    const body = `Olá!\n\nClique no link abaixo para redefinir sua senha (válido por 30 minutos):\n\n${link}\n\nSe não solicitou, ignore este e-mail.\n\nEquipe ${systemName}`;
    window.open(`mailto:${resetEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
  };

  const onRegister = async () => {
    if (!regForm.name.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    if (!regForm.email.trim() && !regForm.username.trim()) { toast({ title: "Informe e-mail ou usuário", variant: "destructive" }); return; }
    if (regForm.password.length < 6) { toast({ title: "Senha mínima de 6 caracteres", variant: "destructive" }); return; }
    if (regForm.password !== regForm.confirmPassword) { toast({ title: "Senhas não conferem", variant: "destructive" }); return; }
    setRegLoading(true);
    try {
      await apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(regForm) });
      setRegSuccess(true);
    } catch (e: any) {
      toast({ title: e.message || "Erro ao criar conta", variant: "destructive" });
    } finally {
      setRegLoading(false);
    }
  };

  const resetForgot = () => { setForgotEmail(""); setResetToken(null); setResetEmail(""); setModal("none"); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt={systemName} className="w-16 h-16 rounded-2xl object-contain mx-auto mb-4 shadow-lg bg-white" />
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg">
              <Activity className="h-8 w-8" />
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{systemName}</h1>
          <p className="text-muted-foreground mt-2">Sistema Inteligente para Profissionais da Saúde</p>
        </div>

        <Card className="border-none shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-semibold text-center">Acesso ao Sistema</CardTitle>
            <CardDescription className="text-center">Insira suas credenciais para continuar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="username" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuário ou E-mail</FormLabel>
                    <FormControl>
                      <Input placeholder="seu@email.com ou usuário" {...field} disabled={isLoading} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPwd ? "text" : "password"} placeholder="••••••••" {...field} disabled={isLoading} className="h-11 pr-10" />
                        <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-11 w-10 p-0" onClick={() => setShowPwd(p => !p)}>
                          {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full h-11 text-base" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Entrando...</> : "Entrar"}
                </Button>
              </form>
            </Form>

            <div className="flex flex-col gap-2 pt-2 border-t">
              <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground hover:text-foreground" onClick={() => { setForgotEmail(""); setResetToken(null); setModal("forgot"); }}>
                <KeyRound className="h-4 w-4" /> Esqueci minha senha
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => { setRegForm({ name:"",username:"",email:"",phone:"",password:"",confirmPassword:"",role:"profissional" }); setRegSuccess(false); setModal("register"); }}>
                <UserPlus className="h-4 w-4" /> Criar nova conta
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} {systemName} · Todos os direitos reservados
        </p>
      </div>

      {/* ── Forgot Password Modal ─────────────────────────────────────────── */}
      <Dialog open={modal === "forgot"} onOpenChange={o => !o && resetForgot()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Esqueci minha senha
            </DialogTitle>
          </DialogHeader>

          {!resetToken ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Informe seu e-mail cadastrado. Você receberá um link para redefinir sua senha.</p>
              <div>
                <Label>E-mail cadastrado</Label>
                <Input type="email" className="mt-1" placeholder="seu@email.com" value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && onForgot()} />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={onForgot} disabled={forgotLoading}>
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                  {forgotLoading ? "Gerando link..." : "Enviar link de redefinição"}
                </Button>
                <Button variant="ghost" onClick={resetForgot}><ArrowLeft className="h-4 w-4" /></Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                Link de redefinição gerado! Válido por 30 minutos.
              </div>
              <p className="text-sm text-muted-foreground">Para {resetEmail}, use uma das opções abaixo:</p>
              <div className="flex flex-col gap-2">
                <Button className="gap-2" onClick={openResetLink}>
                  <ExternalLink className="h-4 w-4" /> Abrir página de redefinição
                </Button>
                <Button variant="outline" className="gap-2" onClick={openResetEmail}>
                  <Mail className="h-4 w-4" /> Enviar link por e-mail
                </Button>
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={copyResetLink}>
                  <Copy className="h-3.5 w-3.5" /> Copiar link
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="w-full" onClick={resetForgot}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao login
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Register Modal ────────────────────────────────────────────────── */}
      <Dialog open={modal === "register"} onOpenChange={o => !o && setModal("none")}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Criar nova conta
            </DialogTitle>
          </DialogHeader>

          {regSuccess ? (
            <div className="space-y-4 text-center py-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h3 className="font-semibold text-lg">Conta criada com sucesso!</h3>
              <p className="text-sm text-muted-foreground">Sua conta foi criada. Aguarde a ativação por um administrador (se necessário) e faça login.</p>
              <Button className="w-full" onClick={() => setModal("none")}>Ir para o login</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Nome completo <span className="text-red-500">*</span></Label>
                <Input className="mt-1" placeholder="Maria da Silva" value={regForm.name}
                  onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Usuário</Label>
                  <Input className="mt-1" placeholder="mariasilva" value={regForm.username}
                    onChange={e => setRegForm(f => ({ ...f, username: e.target.value }))} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input className="mt-1" placeholder="(00) 00000-0000" value={regForm.phone}
                    onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" className="mt-1" placeholder="maria@email.com" value={regForm.email}
                  onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Tipo de usuário <span className="text-red-500">*</span></Label>
                <Select value={regForm.role} onValueChange={v => setRegForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profissional">Profissional da Saúde</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Senha <span className="text-red-500">*</span></Label>
                <div className="relative mt-1">
                  <Input type={regShowPwd ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={regForm.password}
                    onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))} className="pr-10" />
                  <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full w-10 p-0"
                    onClick={() => setRegShowPwd(p => !p)}>
                    {regShowPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label>Confirmar senha <span className="text-red-500">*</span></Label>
                <Input type="password" className="mt-1" placeholder="Repita a senha" value={regForm.confirmPassword}
                  onChange={e => setRegForm(f => ({ ...f, confirmPassword: e.target.value }))} />
                {regForm.confirmPassword && regForm.password !== regForm.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Senhas não conferem</p>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1 gap-2" onClick={onRegister} disabled={regLoading}>
                  {regLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {regLoading ? "Criando conta..." : "Criar conta"}
                </Button>
                <Button variant="ghost" onClick={() => setModal("none")}>Cancelar</Button>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Já tem conta? <button className="underline text-primary" onClick={() => setModal("none")}>Fazer login</button>
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
