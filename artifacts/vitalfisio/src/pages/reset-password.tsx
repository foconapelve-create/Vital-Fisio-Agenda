import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Eye, EyeOff, CheckCircle2, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { useAppSettings } from "@/contexts/AppSettingsContext";

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { systemName, logoUrl } = useAppSettings();

  const [valid, setValid] = useState<boolean | null>(null);
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setValid(false); return; }
    apiFetch(`/api/auth/validate-token/${token}`)
      .then(data => { setValid(data.valid); setUserName(data.name || ""); })
      .catch(() => setValid(false));
  }, [token]);

  const onSubmit = async () => {
    if (password.length < 6) { setError("Senha deve ter no mínimo 6 caracteres"); return; }
    if (password !== confirm) { setError("Senhas não conferem"); return; }
    setError(""); setLoading(true);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST", body: JSON.stringify({ token, password, confirmPassword: confirm }),
      });
      setSuccess(true);
      setTimeout(() => setLocation("/login"), 3000);
    } catch (e: any) {
      setError(e.message || "Erro ao redefinir senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt={systemName} className="w-16 h-16 rounded-2xl object-contain mx-auto mb-4 shadow-lg bg-white" />
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg">
              <Activity className="h-8 w-8" />
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight">{systemName}</h1>
          <p className="text-muted-foreground mt-2">Sistema Inteligente para Profissionais da Saúde</p>
        </div>

        <Card className="border-none shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl text-center">Redefinir Senha</CardTitle>
            <CardDescription className="text-center">
              {valid === null ? "Validando link..." : valid ? `Olá, ${userName}. Crie uma nova senha.` : "Link inválido ou expirado"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {valid === null && (
              <div className="flex justify-center py-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            )}

            {valid === false && (
              <div className="space-y-4 text-center">
                <div className="flex justify-center"><div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center"><XCircle className="h-8 w-8 text-red-600" /></div></div>
                <p className="text-sm text-muted-foreground">Este link de redefinição de senha é inválido ou expirou (30 minutos). Solicite um novo link na tela de login.</p>
                <Button className="w-full gap-2" onClick={() => setLocation("/login")}><ArrowLeft className="h-4 w-4" /> Voltar ao login</Button>
              </div>
            )}

            {valid === true && !success && (
              <div className="space-y-4">
                <div>
                  <Label>Nova senha <span className="text-red-500">*</span></Label>
                  <div className="relative mt-1">
                    <Input type={showPwd ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={password}
                      onChange={e => { setPassword(e.target.value); setError(""); }} className="pr-10" />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full w-10 p-0"
                      onClick={() => setShowPwd(p => !p)}>
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Confirmar senha <span className="text-red-500">*</span></Label>
                  <Input type="password" className="mt-1" placeholder="Repita a senha" value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError(""); }} />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button className="w-full h-11 text-base" onClick={onSubmit} disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</> : "Salvar nova senha"}
                </Button>
                <Button variant="ghost" size="sm" className="w-full gap-2" onClick={() => setLocation("/login")}>
                  <ArrowLeft className="h-4 w-4" /> Voltar ao login
                </Button>
              </div>
            )}

            {success && (
              <div className="space-y-4 text-center">
                <div className="flex justify-center"><div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center"><CheckCircle2 className="h-8 w-8 text-green-600" /></div></div>
                <h3 className="font-semibold">Senha redefinida com sucesso!</h3>
                <p className="text-sm text-muted-foreground">Você será redirecionado para o login em instantes...</p>
                <Button className="w-full gap-2" onClick={() => setLocation("/login")}><ArrowLeft className="h-4 w-4" /> Ir para o login</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
