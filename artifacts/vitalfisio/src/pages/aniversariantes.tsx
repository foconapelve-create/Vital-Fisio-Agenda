import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Cake, MessageCircle, Gift, History, Search, Settings2,
  Phone, Calendar, Clock, ChevronDown, CheckCircle2,
  FileDown, Filter, Star, PartyPopper, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { PrintHeader } from "@/components/print/PrintHeader";

type BirthdayPatient = {
  id: number; name: string; phone: string; birthDate: string; age: number | null;
  lastAppointment: { date: string; time: string; status: string } | null;
  nextAppointment: { date: string; time: string; status: string } | null;
  congratsSent: boolean; discountOffered: boolean;
};

type BirthdaySettings = {
  id: number; messageTemplate: string;
  discountDefaultPercent: number; discountDefaultValue: number | null;
  discountDefaultType: string; discountDefaultExpiryDays: number;
};

type BirthdayAction = {
  id: number; patientId: number; patient_name: string;
  actionType: string; messageSent: string | null;
  discountValue: string | null; discountType: string | null;
  performedBy: string | null; actionDate: string; actionTime: string; createdAt: string;
};

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const fmtDate = (s: string) => { if (!s) return "-"; const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const fmtDateTime = (d: string, t: string) => `${fmtDate(d)} às ${t}`;
const dayOf = (bd: string) => bd ? parseInt(bd.slice(8, 10)) : 0;
const monthOf = (bd: string) => bd ? parseInt(bd.slice(5, 7)) : 0;
const today = format(new Date(), "yyyy-MM-dd");
const todayDay = parseInt(today.slice(8, 10));
const todayMonth = parseInt(today.slice(5, 7));

export default function Aniversariantes() {
  const [tab, setTab] = useState<"dia" | "mes" | "historico">("dia");
  const [search, setSearch] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterTherapist, setFilterTherapist] = useState("all");
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<BirthdayPatient | null>(null);
  const [waMsgEdit, setWaMsgEdit] = useState("");
  const [discountForm, setDiscountForm] = useState({ value: "", type: "percent", expiry: "", notes: "" });
  const [settingsForm, setSettingsForm] = useState<Partial<BirthdaySettings>>({});
  const { toast } = useToast();
  const qc = useQueryClient();

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

  const { data: me } = useQuery<any>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/auth/me"),
  });

  const { data: therapists = [] } = useQuery<any[]>({
    queryKey: ["therapists"],
    queryFn: () => apiFetch("/api/therapists"),
  });

  const { data: clinicSettings } = useQuery<any>({
    queryKey: ["clinic-settings"],
    queryFn: () => apiFetch("/api/clinic-settings"),
  });

  const actionMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/birthday-actions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["birthdays-today"] });
      qc.invalidateQueries({ queryKey: ["birthdays-month"] });
      qc.invalidateQueries({ queryKey: ["birthday-actions"] });
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

  // Build WhatsApp message from template
  const buildMessage = (patient: BirthdayPatient) => {
    const discountText = settings?.discountDefaultType === "percent"
      ? `${settings?.discountDefaultPercent}%`
      : `R$ ${settings?.discountDefaultValue}`;
    const template = settings?.messageTemplate || "";
    return template
      .replace(/\{nome\}/gi, patient.name)
      .replace(/\{desconto\}/gi, discountText)
      .replace(/\{clinica\}/gi, clinicSettings?.nomeClinica || "VitalFisio");
  };

  const openWhatsapp = (p: BirthdayPatient) => {
    setSelectedPatient(p);
    setWaMsgEdit(buildMessage(p));
    setWhatsappOpen(true);
  };

  const openDiscount = (p: BirthdayPatient) => {
    setSelectedPatient(p);
    setDiscountForm({
      value: String(settings?.discountDefaultPercent || 10),
      type: settings?.discountDefaultType || "percent",
      expiry: "",
      notes: "",
    });
    setDiscountOpen(true);
  };

  const openSettings = () => {
    setSettingsForm({
      messageTemplate: settings?.messageTemplate || "",
      discountDefaultPercent: settings?.discountDefaultPercent || 10,
      discountDefaultValue: settings?.discountDefaultValue ?? undefined,
      discountDefaultType: settings?.discountDefaultType || "percent",
      discountDefaultExpiryDays: settings?.discountDefaultExpiryDays || 30,
    });
    setSettingsOpen(true);
  };

  const sendWhatsapp = () => {
    const phone = selectedPatient!.phone.replace(/\D/g, "");
    const whatsappPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const url = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(waMsgEdit)}`;
    window.open(url, "_blank");

    actionMut.mutate({
      patientId: selectedPatient!.id,
      actionType: "congratulations",
      messageSent: waMsgEdit,
      performedBy: me?.name || me?.username,
      actionDate: today,
      actionTime: format(new Date(), "HH:mm"),
    });

    setWhatsappOpen(false);
    toast({ title: "Parabéns enviado via WhatsApp!" });
  };

  const registerDiscount = () => {
    actionMut.mutate({
      patientId: selectedPatient!.id,
      actionType: "discount",
      discountValue: discountForm.value,
      discountType: discountForm.type,
      discountExpiry: discountForm.expiry,
      discountNotes: discountForm.notes,
      performedBy: me?.name || me?.username,
      actionDate: today,
      actionTime: format(new Date(), "HH:mm"),
    });
    setDiscountOpen(false);
    toast({ title: "Desconto registrado com sucesso!" });
  };

  // Filters
  const filteredToday = useMemo(() => {
    let list = todayList;
    if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    if (filterTherapist !== "all") list = list.filter(p => (p as any).therapistId?.toString() === filterTherapist);
    return list;
  }, [todayList, search, filterTherapist]);

  const filteredMonth = useMemo(() => {
    let list = monthList.filter(p => {
      const d = dayOf(p.birthDate);
      return d !== todayDay; // hide today's in month tab (already in day tab)
    });
    if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    if (filterDay) list = list.filter(p => dayOf(p.birthDate).toString() === filterDay);
    if (filterTherapist !== "all") list = list.filter(p => (p as any).therapistId?.toString() === filterTherapist);
    return list;
  }, [monthList, search, filterDay, filterTherapist]);

  const exportPDF = () => { window.print(); };

  const exportExcel = () => {
    const list = tab === "dia" ? filteredToday : filteredMonth;
    const headers = ["Nome", "Aniversário", "Telefone", "Idade", "Último Atendimento", "Próximo Agendamento"];
    const rows = list.map(p => [
      p.name, fmtDate(p.birthDate), p.phone, p.age ? `${p.age} anos` : "-",
      p.lastAppointment ? fmtDate(p.lastAppointment.date) : "-",
      p.nextAppointment ? fmtDate(p.nextAppointment.date) : "-",
    ]);
    const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aniversariantes-${tab === "dia" ? "hoje" : MONTHS[todayMonth - 1]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Lista exportada!" });
  };

  const PatientCard = ({ p, showAllInfo = true }: { p: BirthdayPatient; showAllInfo?: boolean }) => {
    const isToday = dayOf(p.birthDate) === todayDay;
    return (
      <Card className={`border shadow-sm transition-all hover:shadow-md ${isToday ? "border-pink-300 bg-pink-50/30 dark:bg-pink-950/10" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Birthday badge */}
            <div className={`shrink-0 w-14 h-14 rounded-full flex flex-col items-center justify-center font-bold text-sm border-2 ${isToday ? "bg-pink-100 border-pink-400 text-pink-700" : "bg-blue-50 border-blue-200 text-blue-700"}`}>
              <span className="text-lg leading-none">{dayOf(p.birthDate).toString().padStart(2, "0")}</span>
              <span className="text-[10px] uppercase">{MONTHS[monthOf(p.birthDate) - 1]?.slice(0, 3)}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="font-semibold text-base flex items-center gap-2 flex-wrap">
                    {isToday && <PartyPopper className="h-4 w-4 text-pink-500" />}
                    {p.name}
                    {p.age && <span className="text-muted-foreground text-sm font-normal">· {p.age} anos</span>}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Phone className="h-3 w-3" /> {p.phone}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {p.congratsSent && (
                    <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">
                      <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Parabéns enviado
                    </Badge>
                  )}
                  {p.discountOffered && (
                    <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px]">
                      <Gift className="h-2.5 w-2.5 mr-1" /> Desconto oferecido
                    </Badge>
                  )}
                </div>
              </div>

              {showAllInfo && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Último atend.: {p.lastAppointment ? fmtDate(p.lastAppointment.date) : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Próximo: {p.nextAppointment ? fmtDateTime(p.nextAppointment.date, p.nextAppointment.time) : "—"}
                  </span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <Button
                size="sm"
                className={`gap-1.5 text-xs h-8 ${p.congratsSent ? "bg-green-100 text-green-800 hover:bg-green-200 border border-green-300" : "bg-green-500 hover:bg-green-600 text-white"}`}
                onClick={() => openWhatsapp(p)}>
                <MessageCircle className="h-3.5 w-3.5" />
                {p.congratsSent ? "Reenviar" : "Enviar parabéns"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={`gap-1.5 text-xs h-8 ${p.discountOffered ? "border-purple-300 text-purple-700 hover:bg-purple-50" : ""}`}
                onClick={() => openDiscount(p)}>
                <Gift className="h-3.5 w-3.5" />
                {p.discountOffered ? "Desconto registrado" : "Oferecer desconto"}
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
              <Cake className="h-8 w-8 text-pink-500" />
              Aniversariantes
            </h1>
            <p className="text-muted-foreground mt-1">
              {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportPDF}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportExcel}>
              <FileDown className="h-4 w-4" /> Excel/CSV
            </Button>
            {(me?.role === "admin" || me?.role === "fisioterapeuta") && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={openSettings}>
                <Settings2 className="h-4 w-4" /> Configurações
              </Button>
            )}
          </div>
        </div>

        {/* Counter badges */}
        <div className="flex gap-3 mt-4 flex-wrap">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${todayList.length > 0 ? "bg-pink-100 text-pink-800 border-pink-300" : "bg-muted text-muted-foreground border-border"}`}>
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
            <Input
              type="number" placeholder="Dia" min="1" max="31"
              className="w-20" value={filterDay} onChange={e => setFilterDay(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setSearch(""); setFilterDay(""); }}>
        <TabsList className="grid w-full sm:w-auto grid-cols-3 no-print">
          <TabsTrigger value="dia" className="gap-2">
            <PartyPopper className="h-3.5 w-3.5" />
            Do Dia
            {todayList.length > 0 && (
              <Badge className="ml-1 bg-pink-500 text-white text-[10px] h-4 w-4 p-0 flex items-center justify-center rounded-full">
                {todayList.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="mes" className="gap-2">
            <Cake className="h-3.5 w-3.5" />
            Do Mês
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-3.5 w-3.5" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* TAB: DO DIA */}
        <TabsContent value="dia" className="mt-6">
          {loadingToday ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
            </div>
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
          {/* Today's first (highlight) */}
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
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
            </div>
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
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <History className="h-12 w-12 opacity-10" />
                <p>Nenhuma ação registrada ainda</p>
              </div>
            ) : (
              history.map((action: any) => (
                <Card key={action.id} className="border shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${action.action_type === "congratulations" ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"}`}>
                        {action.action_type === "congratulations" ? <MessageCircle className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{action.patient_name || `Paciente #${action.patient_id}`}</div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                          <span>{action.action_type === "congratulations" ? "Parabéns enviado" : `Desconto oferecido${action.discount_value ? ` — ${action.discount_value}${action.discount_type === "percent" ? "%" : " R$"}` : ""}`}</span>
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
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* WhatsApp Dialog */}
      <Dialog open={whatsappOpen} onOpenChange={setWhatsappOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Enviar parabéns via WhatsApp — {selectedPatient?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Mensagem (editável)</Label>
              <Textarea
                rows={12}
                value={waMsgEdit}
                onChange={e => setWaMsgEdit(e.target.value)}
                className="font-mono text-sm resize-none"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Você pode editar a mensagem antes de enviar. Ao clicar em enviar, o WhatsApp será aberto.
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white" onClick={sendWhatsapp}>
                <MessageCircle className="h-4 w-4" /> Abrir WhatsApp e Enviar
              </Button>
              <Button variant="ghost" onClick={() => setWhatsappOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
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
                <Input
                  type="number" min="0"
                  placeholder={discountForm.type === "percent" ? "Ex: 10" : "Ex: 50"}
                  value={discountForm.value}
                  onChange={e => setDiscountForm(f => ({ ...f, value: e.target.value }))}
                />
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

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" /> Configurações de Aniversário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Mensagem padrão de parabéns
                <span className="ml-2 text-[10px] text-blue-500">Use: {"{nome}"} {"{desconto}"} {"{clinica}"}</span>
              </Label>
              <Textarea
                rows={10}
                value={settingsForm.messageTemplate || ""}
                onChange={e => setSettingsForm(f => ({ ...f, messageTemplate: e.target.value }))}
                className="font-mono text-xs"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Desconto padrão (%)</Label>
                <Input type="number" min="0" max="100"
                  value={settingsForm.discountDefaultPercent || ""}
                  onChange={e => setSettingsForm(f => ({ ...f, discountDefaultPercent: parseInt(e.target.value) }))}
                />
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
                  onChange={e => setSettingsForm(f => ({ ...f, discountDefaultExpiryDays: parseInt(e.target.value) }))}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <Button className="flex-1 gap-2" onClick={() => settingsMut.mutate(settingsForm)} disabled={settingsMut.isPending}>
                <CheckCircle2 className="h-4 w-4" />
                {settingsMut.isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="ghost" onClick={() => setSettingsOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
