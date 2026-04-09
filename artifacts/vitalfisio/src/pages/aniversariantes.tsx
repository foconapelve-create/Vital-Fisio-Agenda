import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { useAppName } from "@/contexts/AppSettingsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Cake, MessageCircle, Gift, History, Search, Settings2,
  Phone, Calendar, Clock, CheckCircle2, FileDown, PartyPopper,
  AlertCircle, Mail, Send, Users, Zap,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { PrintHeader } from "@/components/print/PrintHeader";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type BirthdayPatient = {
  id: number; name: string; phone: string; email?: string | null;
  contactPreference?: string | null;
  birthDate: string; age: number | null;
  lastAppointment: { date: string; time: string; status: string } | null;
  nextAppointment: { date: string; time: string; status: string } | null;
  congratsSent: boolean; whatsappSent: boolean; emailSent: boolean; discountOffered: boolean;
};

type BirthdaySettings = {
  id: number;
  messageTemplate: string;
  emailSubject: string | null;
  emailTemplateDay: string | null;
  emailTemplateMonth: string | null;
  whatsappTemplateMonth: string | null;
  discountDefaultPercent: number;
  discountDefaultValue: number | null;
  discountDefaultType: string;
  discountDefaultExpiryDays: number;
};

type BirthdayAction = {
  id: number; patient_id: number; patient_name: string;
  action_type: string; message_sent: string | null;
  discount_value: string | null; discount_type: string | null;
  performed_by: string | null; action_date: string; action_time: string;
  channel: string | null; message_type: string | null; created_at: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const fmtDate = (s: string) => { if (!s) return "-"; const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const fmtDateTime = (d: string, t: string) => `${fmtDate(d)} às ${t}`;
const dayOf = (bd: string) => bd ? parseInt(bd.slice(8, 10)) : 0;
const monthOf = (bd: string) => bd ? parseInt(bd.slice(5, 7)) : 0;
const today = format(new Date(), "yyyy-MM-dd");
const todayDay = parseInt(today.slice(8, 10));
const todayMonth = parseInt(today.slice(5, 7));

function isValidEmail(email?: string | null) {
  if (!email || !email.trim()) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

const DEFAULT_WA_TEMPLATE = `🎂 *Feliz Aniversário, {nome}!*

Toda a equipe da {clinica} deseja que seu dia seja repleto de alegria, saúde e realizações!

🎁 Para comemorar essa data especial, preparamos um presente: *{desconto} de desconto* nos nossos planos de tratamento.

Aproveite esse cuidado exclusivo que você merece. Entre em contato para saber mais! 💚`;

const DEFAULT_EMAIL_SUBJECT = "Feliz aniversário! Temos um presente especial para você 🎉";
const DEFAULT_EMAIL_BODY = `Olá, {nome}!

Hoje é um momento especial e toda a nossa equipe quer te desejar um feliz aniversário, com muita saúde, felicidade e bem-estar.

Para comemorar essa data, preparamos um presente para você:
🎁 {desconto} de desconto nos nossos planos de tratamento.

Será um prazer cuidar de você nesse novo ciclo com toda atenção e qualidade que você merece.

Se quiser saber mais, é só responder este e-mail ou entrar em contato com a nossa equipe.

Com carinho,
{clinica}`;

// ── ContactBadge ───────────────────────────────────────────────────────────────

function ContactBadge({ pref }: { pref?: string | null }) {
  if (pref === "email") return <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"><Mail className="h-2.5 w-2.5 mr-1" /> E-mail</Badge>;
  if (pref === "ambos") return <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200"><Zap className="h-2.5 w-2.5 mr-1" /> WhatsApp + E-mail</Badge>;
  return <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200"><MessageCircle className="h-2.5 w-2.5 mr-1" /> WhatsApp</Badge>;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Aniversariantes() {
  const appName = useAppName();
  const [tab, setTab] = useState<"dia" | "mes" | "historico">("dia");
  const [search, setSearch] = useState("");
  const [filterDay, setFilterDay] = useState("");

  // Dialogs
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resendConfirmOpen, setResendConfirmOpen] = useState(false);
  const [resendAction, setResendAction] = useState<() => void>(() => () => {});

  const [selectedPatient, setSelectedPatient] = useState<BirthdayPatient | null>(null);
  const [waMsgEdit, setWaMsgEdit] = useState("");
  const [emailSubjectEdit, setEmailSubjectEdit] = useState("");
  const [emailBodyEdit, setEmailBodyEdit] = useState("");
  const [discountForm, setDiscountForm] = useState({ value: "", type: "percent", expiry: "", notes: "" });
  const [settingsForm, setSettingsForm] = useState<Partial<BirthdaySettings>>({});
  const [isMonthMsg, setIsMonthMsg] = useState(false);

  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: todayList = [], isLoading: loadingToday } = useQuery<BirthdayPatient[]>({
    queryKey: ["birthdays-today"],
    queryFn: () => apiFetch("/api/birthdays/today"),
    refetchInterval: 300000,
  });

  const { data: monthList = [], isLoading: loadingMonth } = useQuery<BirthdayPatient[]>({
    queryKey: ["birthdays-month"],
    queryFn: () => apiFetch("/api/birthdays/month"),
    refetchInterval: 300000,
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery<BirthdayAction[]>({
    queryKey: ["birthday-actions"],
    queryFn: () => apiFetch("/api/birthday-actions"),
  });

  const { data: settings } = useQuery<BirthdaySettings>({
    queryKey: ["birthday-settings"],
    queryFn: () => apiFetch("/api/birthday-settings"),
  });

  const { data: bdStats } = useQuery<{ whatsappSentToday: number; emailSentToday: number; pendingToday: number; totalToday: number }>({
    queryKey: ["birthday-stats"],
    queryFn: () => apiFetch("/api/birthday-actions/stats"),
    refetchInterval: 60000,
  });

  const { data: me } = useQuery<any>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/auth/me"),
  });

  const { data: clinicSettings } = useQuery<any>({
    queryKey: ["clinic-settings"],
    queryFn: () => apiFetch("/api/clinic-settings"),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const actionMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/birthday-actions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["birthdays-today"] });
      qc.invalidateQueries({ queryKey: ["birthdays-month"] });
      qc.invalidateQueries({ queryKey: ["birthday-actions"] });
      qc.invalidateQueries({ queryKey: ["birthday-stats"] });
    },
    onError: (e: any) => toast({ title: e.message || "Erro", variant: "destructive" }),
  });

  const settingsMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/birthday-settings", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Configurações salvas!" });
      qc.invalidateQueries({ queryKey: ["birthday-settings"] });
      setSettingsOpen(false);
    },
    onError: (e: any) => toast({ title: e.message || "Erro", variant: "destructive" }),
  });

  // ── Build messages ─────────────────────────────────────────────────────────

  const discountText = (s?: BirthdaySettings | null) => {
    if (!s) return "10%";
    return s.discountDefaultType === "percent"
      ? `${s.discountDefaultPercent}%`
      : `R$ ${s.discountDefaultValue}`;
  };

  const buildWAMessage = (p: BirthdayPatient, isMonth?: boolean) => {
    const template = (isMonth ? settings?.whatsappTemplateMonth : null) || settings?.messageTemplate || DEFAULT_WA_TEMPLATE;
    return template
      .replace(/\{nome\}/gi, p.name)
      .replace(/\{desconto\}/gi, discountText(settings))
      .replace(/\{clinica\}/gi, clinicSettings?.nomeClinica || appName);
  };

  const buildEmailBody = (p: BirthdayPatient) => {
    const template = settings?.emailTemplateDay || DEFAULT_EMAIL_BODY;
    return template
      .replace(/\{nome\}/gi, p.name)
      .replace(/\{desconto\}/gi, discountText(settings))
      .replace(/\{clinica\}/gi, clinicSettings?.nomeClinica || appName);
  };

  const buildEmailSubject = () => settings?.emailSubject || DEFAULT_EMAIL_SUBJECT;

  // ── Open dialogs ───────────────────────────────────────────────────────────

  const tryOpenWhatsApp = (p: BirthdayPatient, isMonth = false) => {
    if (!p.phone || p.phone.trim() === "") {
      toast({ title: "Paciente sem telefone cadastrado", variant: "destructive" }); return;
    }
    const doOpen = () => {
      setSelectedPatient(p); setIsMonthMsg(isMonth);
      setWaMsgEdit(buildWAMessage(p, isMonth)); setWhatsappOpen(true);
    };
    if (p.whatsappSent) {
      setResendAction(() => doOpen);
      setResendConfirmOpen(true);
    } else { doOpen(); }
  };

  const tryOpenEmail = (p: BirthdayPatient) => {
    if (!isValidEmail(p.email)) {
      toast({ title: !p.email ? "Paciente sem e-mail cadastrado" : "E-mail inválido no cadastro do paciente", variant: "destructive" }); return;
    }
    const doOpen = () => {
      setSelectedPatient(p);
      setEmailSubjectEdit(buildEmailSubject());
      setEmailBodyEdit(buildEmailBody(p));
      setEmailOpen(true);
    };
    if (p.emailSent) {
      setResendAction(() => doOpen);
      setResendConfirmOpen(true);
    } else { doOpen(); }
  };

  const openDiscount = (p: BirthdayPatient) => {
    setSelectedPatient(p);
    setDiscountForm({
      value: String(settings?.discountDefaultPercent || 10),
      type: settings?.discountDefaultType || "percent",
      expiry: "", notes: "",
    });
    setDiscountOpen(true);
  };

  const openSettings = () => {
    setSettingsForm({
      messageTemplate: settings?.messageTemplate || DEFAULT_WA_TEMPLATE,
      emailSubject: settings?.emailSubject || DEFAULT_EMAIL_SUBJECT,
      emailTemplateDay: settings?.emailTemplateDay || DEFAULT_EMAIL_BODY,
      emailTemplateMonth: settings?.emailTemplateMonth || "",
      whatsappTemplateMonth: settings?.whatsappTemplateMonth || "",
      discountDefaultPercent: settings?.discountDefaultPercent || 10,
      discountDefaultValue: settings?.discountDefaultValue ?? undefined,
      discountDefaultType: settings?.discountDefaultType || "percent",
      discountDefaultExpiryDays: settings?.discountDefaultExpiryDays || 30,
    });
    setSettingsOpen(true);
  };

  // ── Send actions ───────────────────────────────────────────────────────────

  const sendWhatsApp = () => {
    const phone = selectedPatient!.phone.replace(/\D/g, "");
    const waPhone = phone.startsWith("55") ? phone : `55${phone}`;
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(waMsgEdit)}`, "_blank");
    actionMut.mutate({
      patientId: selectedPatient!.id, actionType: "congratulations",
      messageSent: waMsgEdit, performedBy: me?.name || me?.username,
      actionDate: today, actionTime: format(new Date(), "HH:mm"),
      channel: "whatsapp", messageType: isMonthMsg ? "mes" : "dia",
    });
    setWhatsappOpen(false);
    toast({ title: "✅ Parabéns enviado via WhatsApp!" });
  };

  const sendEmail = () => {
    const mailto = `mailto:${selectedPatient!.email}?subject=${encodeURIComponent(emailSubjectEdit)}&body=${encodeURIComponent(emailBodyEdit)}`;
    window.open(mailto, "_blank");
    actionMut.mutate({
      patientId: selectedPatient!.id, actionType: "congratulations",
      messageSent: `[E-mail] ${emailSubjectEdit}`, performedBy: me?.name || me?.username,
      actionDate: today, actionTime: format(new Date(), "HH:mm"),
      channel: "email", messageType: "dia",
    });
    setEmailOpen(false);
    toast({ title: "✅ E-mail de parabéns preparado!" });
  };

  const sendBoth = (p: BirthdayPatient) => {
    if (!p.phone && !isValidEmail(p.email)) {
      toast({ title: "Paciente sem telefone nem e-mail válido cadastrado", variant: "destructive" }); return;
    }
    // Send WA first if available
    if (p.phone) {
      const waMsg = buildWAMessage(p);
      const phone = p.phone.replace(/\D/g, "");
      const waPhone = phone.startsWith("55") ? phone : `55${phone}`;
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`, "_blank");
      actionMut.mutate({
        patientId: p.id, actionType: "congratulations", messageSent: waMsg,
        performedBy: me?.name || me?.username, actionDate: today,
        actionTime: format(new Date(), "HH:mm"), channel: "whatsapp", messageType: "dia",
      });
    }
    // Then open email
    if (isValidEmail(p.email)) {
      const subject = buildEmailSubject();
      const body = buildEmailBody(p);
      const mailto = `mailto:${p.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setTimeout(() => window.open(mailto, "_blank"), 500);
      actionMut.mutate({
        patientId: p.id, actionType: "congratulations",
        messageSent: `[E-mail] ${subject}`, performedBy: me?.name || me?.username,
        actionDate: today, actionTime: format(new Date(), "HH:mm"), channel: "email", messageType: "dia",
      });
    }
    toast({ title: "✅ Parabéns enviados por WhatsApp e E-mail!" });
  };

  const registerDiscount = () => {
    actionMut.mutate({
      patientId: selectedPatient!.id, actionType: "discount",
      discountValue: discountForm.value, discountType: discountForm.type,
      discountExpiry: discountForm.expiry, discountNotes: discountForm.notes,
      performedBy: me?.name || me?.username,
      actionDate: today, actionTime: format(new Date(), "HH:mm"),
      channel: "interno",
    });
    setDiscountOpen(false);
    toast({ title: "🎁 Desconto registrado com sucesso!" });
  };

  // ── Filters ────────────────────────────────────────────────────────────────

  const filteredToday = useMemo(() => {
    let list = todayList;
    if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [todayList, search]);

  const filteredMonth = useMemo(() => {
    let list = monthList.filter(p => dayOf(p.birthDate) !== todayDay);
    if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    if (filterDay) list = list.filter(p => dayOf(p.birthDate).toString() === filterDay);
    return list;
  }, [monthList, search, filterDay]);

  // ── Export ─────────────────────────────────────────────────────────────────

  const exportExcel = () => {
    const list = tab === "dia" ? filteredToday : filteredMonth;
    const headers = ["Nome", "Aniversário", "Telefone", "E-mail", "Preferência", "WhatsApp Enviado", "E-mail Enviado", "Desconto", "Último Atendimento", "Próximo Agendamento"];
    const rows = list.map(p => [
      p.name, fmtDate(p.birthDate), p.phone || "-", p.email || "-",
      p.contactPreference || "whatsapp",
      p.whatsappSent ? "Sim" : "Não", p.emailSent ? "Sim" : "Não",
      p.discountOffered ? "Sim" : "Não",
      p.lastAppointment ? fmtDate(p.lastAppointment.date) : "-",
      p.nextAppointment ? fmtDate(p.nextAppointment.date) : "-",
    ]);
    const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `aniversariantes-${tab}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Lista exportada!" });
  };

  const exportHistoryExcel = () => {
    const headers = ["Paciente", "Canal", "Tipo de Mensagem", "Ação", "Responsável", "Data", "Hora"];
    const rows = history.map((a: BirthdayAction) => [
      a.patient_name || `#${a.patient_id}`,
      a.channel === "email" ? "E-mail" : a.channel === "whatsapp" ? "WhatsApp" : a.channel || "-",
      a.message_type === "mes" ? "Aniversariante do Mês" : "Aniversariante do Dia",
      a.action_type === "congratulations" ? "Parabéns enviado" : `Desconto: ${a.discount_value}${a.discount_type === "percent" ? "%" : " R$"}`,
      a.performed_by || "-", fmtDate(a.action_date), a.action_time || "-",
    ]);
    const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `historico-aniversariantes.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Histórico exportado!" });
  };

  // ── Patient Card ───────────────────────────────────────────────────────────

  const PatientCard = ({ p, showAllInfo = true }: { p: BirthdayPatient; showAllInfo?: boolean }) => {
    const isTodayBD = dayOf(p.birthDate) === todayDay;
    const pref = p.contactPreference || "whatsapp";

    const hasPhone = !!(p.phone?.trim());
    const hasEmail = isValidEmail(p.email);

    const canWA = hasPhone && (pref === "whatsapp" || pref === "ambos");
    const canEmail = hasEmail && (pref === "email" || pref === "ambos");
    const noContact = !hasPhone && !hasEmail;

    return (
      <Card className={cn("border shadow-sm transition-all hover:shadow-md", isTodayBD ? "border-pink-300 bg-pink-50/30 dark:bg-pink-950/10" : "")}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Birthday badge */}
            <div className={cn("shrink-0 w-14 h-14 rounded-full flex flex-col items-center justify-center font-bold text-sm border-2", isTodayBD ? "bg-pink-100 border-pink-400 text-pink-700" : "bg-blue-50 border-blue-200 text-blue-700")}>
              <span className="text-lg leading-none">{dayOf(p.birthDate).toString().padStart(2, "0")}</span>
              <span className="text-[10px] uppercase">{MONTHS[monthOf(p.birthDate) - 1]?.slice(0, 3)}</span>
            </div>

            <div className="flex-1 min-w-0">
              {/* Name + age */}
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <h3 className="font-semibold text-base flex items-center gap-2 flex-wrap">
                    {isTodayBD && <PartyPopper className="h-4 w-4 text-pink-500 shrink-0" />}
                    <span className="truncate">{p.name}</span>
                    {p.age && <span className="text-muted-foreground text-sm font-normal shrink-0">· {p.age} anos</span>}
                  </h3>
                  {/* Contact info */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {hasPhone ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {p.phone}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-orange-500">
                        <Phone className="h-3 w-3" /> Sem telefone
                      </div>
                    )}
                    {p.email ? (
                      hasEmail ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" /> {p.email}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-orange-500">
                          <Mail className="h-3 w-3" /> E-mail inválido
                        </div>
                      )
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
                        <Mail className="h-3 w-3" /> Sem e-mail
                      </div>
                    )}
                  </div>
                </div>

                {/* Status badges */}
                <div className="flex flex-wrap gap-1 shrink-0">
                  <ContactBadge pref={pref} />
                  {p.whatsappSent && (
                    <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] gap-1">
                      <CheckCircle2 className="h-2.5 w-2.5" /> WA
                    </Badge>
                  )}
                  {p.emailSent && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] gap-1">
                      <CheckCircle2 className="h-2.5 w-2.5" /> E-mail
                    </Badge>
                  )}
                  {p.discountOffered && (
                    <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] gap-1">
                      <Gift className="h-2.5 w-2.5" /> Desconto
                    </Badge>
                  )}
                </div>
              </div>

              {/* Appointments */}
              {showAllInfo && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Último atend.: {p.lastAppointment ? fmtDate(p.lastAppointment.date) : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Próximo: {p.nextAppointment ? fmtDateTime(p.nextAppointment.date, p.nextAppointment.time) : "—"}
                  </span>
                </div>
              )}

              {/* No contact warning */}
              {noContact && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Cadastro incompleto — sem telefone nem e-mail
                </div>
              )}
            </div>

            {/* Action buttons column */}
            <div className="flex flex-col gap-1.5 shrink-0 min-w-[120px]">
              {/* WhatsApp */}
              {(canWA || (!hasEmail && hasPhone)) && (
                <Button size="sm"
                  className={cn("gap-1.5 text-xs h-8 w-full justify-start",
                    p.whatsappSent ? "bg-green-100 text-green-800 hover:bg-green-200 border border-green-300" : "bg-[#25D366] hover:bg-[#128C7E] text-white")}
                  onClick={() => tryOpenWhatsApp(p)}>
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                  {p.whatsappSent ? "Reenviar WA" : "WhatsApp"}
                </Button>
              )}

              {/* Email */}
              {(canEmail || (!hasPhone && hasEmail)) && (
                <Button size="sm"
                  className={cn("gap-1.5 text-xs h-8 w-full justify-start",
                    p.emailSent ? "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-300" : "bg-blue-500 hover:bg-blue-600 text-white")}
                  onClick={() => tryOpenEmail(p)}>
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {p.emailSent ? "Reenviar E-mail" : "E-mail"}
                </Button>
              )}

              {/* Both */}
              {canWA && canEmail && !p.whatsappSent && !p.emailSent && (
                <Button size="sm" variant="outline"
                  className="gap-1.5 text-xs h-8 w-full justify-start text-purple-700 border-purple-300 hover:bg-purple-50"
                  onClick={() => sendBoth(p)}>
                  <Send className="h-3.5 w-3.5 shrink-0" /> Enviar ambos
                </Button>
              )}

              {/* Discount */}
              <Button size="sm" variant="outline"
                className={cn("gap-1.5 text-xs h-8 w-full justify-start", p.discountOffered ? "border-purple-300 text-purple-700 hover:bg-purple-50" : "")}
                onClick={() => openDiscount(p)}>
                <Gift className="h-3.5 w-3.5 shrink-0" />
                {p.discountOffered ? "Ver desconto" : "Desconto"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const currentMonthName = MONTHS[todayMonth - 1];

  return (
    <div className="space-y-6">
      <PrintHeader title={`Aniversariantes — ${currentMonthName}`} />

      {/* Header */}
      <div className="no-print">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Cake className="h-8 w-8 text-pink-500" /> Aniversariantes
            </h1>
            <p className="text-muted-foreground mt-1">
              {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={tab === "historico" ? exportHistoryExcel : exportExcel}>
              <FileDown className="h-4 w-4" /> Excel/CSV
            </Button>
            {(me?.role === "admin" || me?.role === "fisioterapeuta") && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={openSettings}>
                <Settings2 className="h-4 w-4" /> Configurações
              </Button>
            )}
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <Card className="border shadow-none">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-pink-600">{todayList.length}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                <PartyPopper className="h-3 w-3" /> Aniversariantes hoje
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-none">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-[#25D366]">{bdStats?.whatsappSentToday ?? 0}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                <MessageCircle className="h-3 w-3" /> WA enviados hoje
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-none">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{bdStats?.emailSentToday ?? 0}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                <Mail className="h-3 w-3" /> E-mails enviados hoje
              </div>
            </CardContent>
          </Card>
          <Card className={cn("border shadow-none", (bdStats?.pendingToday ?? 0) > 0 ? "border-orange-300 bg-orange-50/30" : "")}>
            <CardContent className="p-3 text-center">
              <div className={cn("text-2xl font-bold", (bdStats?.pendingToday ?? 0) > 0 ? "text-orange-600" : "text-muted-foreground")}>{bdStats?.pendingToday ?? 0}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                <Users className="h-3 w-3" /> Faltam ser contatados
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary badges */}
        <div className="flex gap-3 mt-4 flex-wrap">
          <div className={cn("flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border", todayList.length > 0 ? "bg-pink-100 text-pink-800 border-pink-300" : "bg-muted text-muted-foreground border-border")}>
            <PartyPopper className="h-4 w-4" />
            {todayList.length === 0 ? "Nenhum aniversariante hoje" : `${todayList.length} aniversariante${todayList.length !== 1 ? "s" : ""} hoje`}
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <Cake className="h-4 w-4" />
            {monthList.length} em {currentMonthName}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mt-4 p-3 bg-muted/40 rounded-lg border border-border">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {tab === "mes" && (
            <Input type="number" placeholder="Dia" min="1" max="31"
              className="w-20" value={filterDay} onChange={e => setFilterDay(e.target.value)} />
          )}
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setSearch(""); setFilterDay(""); }}>
        <TabsList className="grid w-full sm:w-auto grid-cols-3 no-print">
          <TabsTrigger value="dia" className="gap-2">
            <PartyPopper className="h-3.5 w-3.5" /> Do Dia
            {todayList.length > 0 && (
              <Badge className="ml-1 bg-pink-500 text-white text-[10px] h-4 w-4 p-0 flex items-center justify-center rounded-full">
                {todayList.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="mes" className="gap-2"><Cake className="h-3.5 w-3.5" /> Do Mês</TabsTrigger>
          <TabsTrigger value="historico" className="gap-2"><History className="h-3.5 w-3.5" /> Histórico</TabsTrigger>
        </TabsList>

        {/* TAB: DO DIA */}
        <TabsContent value="dia" className="mt-6">
          {loadingToday ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : filteredToday.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Cake className="h-16 w-16 opacity-10" />
              <div className="text-center">
                <p className="font-medium">Nenhum aniversariante hoje</p>
                <p className="text-sm text-muted-foreground/70">Volte amanhã!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredToday.map(p => <PatientCard key={p.id} p={p} showAllInfo />)}
            </div>
          )}
        </TabsContent>

        {/* TAB: DO MÊS */}
        <TabsContent value="mes" className="mt-6">
          {todayList.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-pink-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                <PartyPopper className="h-4 w-4" /> Hoje — {fmtDate(today)}
              </h3>
              <div className="space-y-2">
                {todayList.map(p => <PatientCard key={p.id} p={p} showAllInfo={false} />)}
              </div>
              {filteredMonth.length > 0 && <div className="h-px bg-border my-4" />}
            </div>
          )}
          {loadingMonth ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : filteredMonth.length === 0 && todayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Cake className="h-16 w-16 opacity-10" />
              <p className="font-medium">Nenhum aniversariante este mês</p>
            </div>
          ) : filteredMonth.length > 0 ? (
            <div>
              {todayList.length > 0 && (
                <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Outros dias do mês
                </h3>
              )}
              <div className="space-y-2">
                {filteredMonth.map(p => <PatientCard key={p.id} p={p} showAllInfo={false} />)}
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* TAB: HISTÓRICO */}
        <TabsContent value="historico" className="mt-6">
          <div className="space-y-3">
            {loadingHistory ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <History className="h-12 w-12 opacity-10" />
                <p>Nenhuma ação registrada ainda</p>
              </div>
            ) : (
              history.map((action: BirthdayAction) => {
                const isWA = action.channel === "whatsapp";
                const isEmail = action.channel === "email";
                const isDiscount = action.action_type === "discount";
                return (
                  <Card key={action.id} className="border shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                          isDiscount ? "bg-purple-100 text-purple-700" :
                          isEmail ? "bg-blue-100 text-blue-700" :
                          "bg-green-100 text-green-700"
                        )}>
                          {isDiscount ? <Gift className="h-5 w-5" /> : isEmail ? <Mail className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{action.patient_name || `Paciente #${action.patient_id}`}</div>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 mt-0.5">
                            <span>
                              {isDiscount
                                ? `Desconto ${action.discount_value}${action.discount_type === "percent" ? "%" : " R$"}`
                                : isEmail ? "Parabéns por e-mail" : "Parabéns por WhatsApp"}
                            </span>
                            {action.message_type && (
                              <span className="capitalize">{action.message_type === "mes" ? "Aniversariante do mês" : "Aniversariante do dia"}</span>
                            )}
                            <span>Por: {action.performed_by || "—"}</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0 text-right">
                          <div>{fmtDate(action.action_date)}</div>
                          <div>{action.action_time}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── WhatsApp Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={whatsappOpen} onOpenChange={setWhatsappOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-[#25D366]" />
              Enviar parabéns via WhatsApp — {selectedPatient?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Mensagem (editável)</Label>
              <Textarea rows={10} value={waMsgEdit} onChange={e => setWaMsgEdit(e.target.value)}
                className="font-mono text-sm resize-none" />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Você pode editar a mensagem antes de enviar. O WhatsApp Web será aberto.
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white" onClick={sendWhatsApp}>
                <MessageCircle className="h-4 w-4" /> Abrir WhatsApp e Enviar
              </Button>
              <Button variant="ghost" onClick={() => setWhatsappOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Email Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Enviar parabéns por e-mail — {selectedPatient?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPatient?.email && (
              <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded px-3 py-2 text-blue-700">
                <Mail className="h-4 w-4 shrink-0" /> Para: <strong>{selectedPatient.email}</strong>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Assunto</Label>
              <Input value={emailSubjectEdit} onChange={e => setEmailSubjectEdit(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Corpo do e-mail (editável)</Label>
              <Textarea rows={14} value={emailBodyEdit} onChange={e => setEmailBodyEdit(e.target.value)}
                className="font-mono text-sm resize-none" />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Ao clicar em enviar, o cliente de e-mail padrão será aberto com a mensagem preenchida.
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={sendEmail}>
                <Mail className="h-4 w-4" /> Abrir e-mail e Enviar
              </Button>
              <Button variant="ghost" onClick={() => setEmailOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Re-send confirmation ───────────────────────────────────────────── */}
      <AlertDialog open={resendConfirmOpen} onOpenChange={setResendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar reenvio</AlertDialogTitle>
            <AlertDialogDescription>
              Você já enviou parabéns por este canal hoje. Deseja reenviar mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setResendConfirmOpen(false); resendAction(); }}>
              Reenviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Discount Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-600" />
              Oferecer desconto — {selectedPatient?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Tipo de Desconto</Label>
                <Select value={discountForm.type} onValueChange={v => setDiscountForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  {discountForm.type === "percent" ? "Percentual (%)" : "Valor (R$)"}
                </Label>
                <Input type="number" min="0"
                  placeholder={discountForm.type === "percent" ? "Ex: 10" : "Ex: 50"}
                  value={discountForm.value}
                  onChange={e => setDiscountForm(f => ({ ...f, value: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Validade da oferta</Label>
              <Input type="date" value={discountForm.expiry}
                onChange={e => setDiscountForm(f => ({ ...f, expiry: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Observações</Label>
              <Textarea rows={2} placeholder="Detalhes do desconto..." value={discountForm.notes}
                onChange={e => setDiscountForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 gap-2" onClick={registerDiscount}>
                <CheckCircle2 className="h-4 w-4" /> Registrar Desconto
              </Button>
              <Button variant="ghost" onClick={() => setDiscountOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Settings Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" /> Configurações de Aniversário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded px-3 py-2">
              Use as variáveis: <code className="bg-blue-100 px-1 rounded">{"{nome}"}</code> <code className="bg-blue-100 px-1 rounded">{"{desconto}"}</code> <code className="bg-blue-100 px-1 rounded">{"{clinica}"}</code>
            </div>

            {/* WhatsApp templates */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2"><MessageCircle className="h-4 w-4 text-[#25D366]" /> Modelo WhatsApp — Aniversariante do Dia</h3>
              <Textarea rows={8} value={settingsForm.messageTemplate || ""}
                onChange={e => setSettingsForm(f => ({ ...f, messageTemplate: e.target.value }))}
                className="font-mono text-xs" />
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2"><MessageCircle className="h-4 w-4 text-[#25D366]" /> Modelo WhatsApp — Aniversariante do Mês <span className="text-xs font-normal text-muted-foreground">(opcional, usa o modelo acima se vazio)</span></h3>
              <Textarea rows={6} value={settingsForm.whatsappTemplateMonth || ""}
                onChange={e => setSettingsForm(f => ({ ...f, whatsappTemplateMonth: e.target.value }))}
                className="font-mono text-xs" placeholder="Deixe vazio para usar o mesmo modelo do dia..." />
            </div>

            {/* Email templates */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Mail className="h-4 w-4 text-blue-600" /> Modelo E-mail — Assunto padrão</h3>
              <Input value={settingsForm.emailSubject || ""}
                onChange={e => setSettingsForm(f => ({ ...f, emailSubject: e.target.value }))}
                placeholder={DEFAULT_EMAIL_SUBJECT} />
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Mail className="h-4 w-4 text-blue-600" /> Modelo E-mail — Aniversariante do Dia</h3>
              <Textarea rows={10} value={settingsForm.emailTemplateDay || ""}
                onChange={e => setSettingsForm(f => ({ ...f, emailTemplateDay: e.target.value }))}
                className="font-mono text-xs" placeholder={DEFAULT_EMAIL_BODY} />
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Mail className="h-4 w-4 text-blue-600" /> Modelo E-mail — Aniversariante do Mês <span className="text-xs font-normal text-muted-foreground">(opcional)</span></h3>
              <Textarea rows={6} value={settingsForm.emailTemplateMonth || ""}
                onChange={e => setSettingsForm(f => ({ ...f, emailTemplateMonth: e.target.value }))}
                className="font-mono text-xs" placeholder="Deixe vazio para usar o mesmo modelo do dia..." />
            </div>

            {/* Discount defaults */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Gift className="h-4 w-4 text-purple-600" /> Desconto Padrão</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Percentual (%)</Label>
                  <Input type="number" min="0" max="100"
                    value={settingsForm.discountDefaultPercent || ""}
                    onChange={e => setSettingsForm(f => ({ ...f, discountDefaultPercent: parseInt(e.target.value) }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Tipo padrão</Label>
                  <Select value={settingsForm.discountDefaultType || "percent"}
                    onValueChange={v => setSettingsForm(f => ({ ...f, discountDefaultType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentual</SelectItem>
                      <SelectItem value="fixed">Valor fixo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Validade (dias)</Label>
                  <Input type="number" min="1"
                    value={settingsForm.discountDefaultExpiryDays || ""}
                    onChange={e => setSettingsForm(f => ({ ...f, discountDefaultExpiryDays: parseInt(e.target.value) }))} />
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t pt-4">
              <Button className="flex-1 gap-2" onClick={() => settingsMut.mutate(settingsForm)} disabled={settingsMut.isPending}>
                <CheckCircle2 className="h-4 w-4" />
                {settingsMut.isPending ? "Salvando..." : "Salvar Configurações"}
              </Button>
              <Button variant="ghost" onClick={() => setSettingsOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
