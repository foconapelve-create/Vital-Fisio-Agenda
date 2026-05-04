import { useState, useMemo, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, Printer, FileDown, Eraser, Save, Eye, Trash2,
  Building2, CheckCircle2, Settings, Search
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { PrintHeader } from "@/components/print/PrintHeader";

const TIPOS_ATENDIMENTO = [
  "Consulta",
  "Avaliação fisioterapêutica",
  "Reavaliação fisioterapêutica",
  "Atendimento fisioterapêutico",
  "Sessão de fisioterapia",
  "Atendimento de fisioterapia pélvica",
  "Atendimento de reabilitação",
  "Procedimento terapêutico",
  "Orientação terapêutica",
  "Atendimento clínico",
  "Acompanhamento terapêutico",
  "Atendimento ambulatorial",
  "Atendimento domiciliar",
  "Retorno",
  "Triagem",
  "Avaliação funcional",
  "Atendimento multiprofissional",
  "Consulta de acompanhamento",
  "Sessão de tratamento",
  "Atendimento individual",
  "Outro",
];

type Patient = { id: number; name: string; phone: string };
type ClinicSettings = { id: number; nomeClinica: string; enderecoClinica: string; telefone?: string; email?: string };
type Attestation = {
  id: number; patientId: number; tipoDocumento: string; dataAtendimento: string;
  horaInicio: string; horaTermino: string; tipoAtendimento: string;
  outroTipoAtendimento?: string | null; observacoes?: string | null;
  profissionalResponsavel: string; registroProfissional?: string | null;
  dataEmissao: string; cidade?: string | null; enderecoClinica?: string | null;
  textoGerado?: string | null; criadoPor?: string | null; createdAt: string;
};

const fmtDate = (s: string) => { if (!s) return ""; const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };

function generateText(form: FormState, patientName: string): string {
  const tipoAtend = form.tipoAtendimento === "Outro" ? (form.outroTipoAtendimento || "atendimento") : form.tipoAtendimento;

  switch (form.tipoDocumento) {
    case "declaracao":
      return `Declaro, para os devidos fins, que o(a) paciente ${patientName} compareceu a atendimento de ${tipoAtend.toLowerCase()} no dia ${fmtDate(form.dataAtendimento)}, no horário de ${form.horaInicio} às ${form.horaTermino}, nesta unidade${form.enderecoClinica ? ` localizada em ${form.enderecoClinica}` : " de saúde"}.`;
    case "atestado":
      return `Atesto, para os devidos fins, que o(a) paciente ${patientName} esteve em atendimento de ${tipoAtend.toLowerCase()} no dia ${fmtDate(form.dataAtendimento)}, no horário de ${form.horaInicio} às ${form.horaTermino}, na clínica${form.enderecoClinica ? ` localizada em ${form.enderecoClinica}` : ""}, necessitando de afastamento conforme avaliação profissional, se aplicável.`;
    case "receituario":
      return form.prescricao || "";
    case "encaminhamento":
      return `Encaminho o(a) paciente ${patientName} para avaliação e acompanhamento em ${form.destinoEspecialidade || "[especialidade/clínica]"}.\n\nMotivo: ${form.motivoEncaminhamento || "-"}\n\nUrgência: ${form.urgencia || "Normal"}`;
    case "solicitacao_exames":
      return `Solicito os seguintes exames para o(a) paciente ${patientName}:\n\n${form.examesSolicitados || "-"}\n\nJustificativa Clínica:\n${form.justificativaExames || "-"}`;
    default:
      return "";
  }
}

type FormState = {
  patientId: string;
  tipoDocumento: string;
  dataAtendimento: string;
  horaInicio: string;
  horaTermino: string;
  tipoAtendimento: string;
  outroTipoAtendimento: string;
  observacoes: string;
  profissionalResponsavel: string;
  registroProfissional: string;
  dataEmissao: string;
  cidade: string;
  enderecoClinica: string;
  prescricao: string;
  validadePrescricao: string;
  destinoEspecialidade: string;
  motivoEncaminhamento: string;
  urgencia: string;
  examesSolicitados: string;
  justificativaExames: string;
};

const emptyForm: FormState = {
  patientId: "", tipoDocumento: "declaracao", dataAtendimento: format(new Date(), "yyyy-MM-dd"),
  horaInicio: "08:00", horaTermino: "08:40", tipoAtendimento: "Sessão de fisioterapia",
  outroTipoAtendimento: "", observacoes: "", profissionalResponsavel: "",
  registroProfissional: "", dataEmissao: format(new Date(), "yyyy-MM-dd"),
  cidade: "", enderecoClinica: "",
  prescricao: "", validadePrescricao: "30",
  destinoEspecialidade: "", motivoEncaminhamento: "", urgencia: "Normal",
  examesSolicitados: "", justificativaExames: "",
};

export default function Atestados() {
  const appName = useAppName();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [customText, setCustomText] = useState("");
  const [textEdited, setTextEdited] = useState(false);
  const [activeTab, setActiveTab] = useState("emitir");
  const [previewDoc, setPreviewDoc] = useState<Attestation | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ nomeClinica: "", enderecoClinica: "", telefone: "", email: "" });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["patients"],
    queryFn: () => apiFetch("/api/patients"),
  });

  const { data: clinicSettings } = useQuery<ClinicSettings>({
    queryKey: ["clinic-settings"],
    queryFn: () => apiFetch("/api/clinic-settings"),
  });

  const { data: me } = useQuery<any>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/auth/me"),
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<Attestation[]>({
    queryKey: ["attestations"],
    queryFn: () => apiFetch("/api/attestations"),
  });

  // Auto-fill clinic settings and professional
  useEffect(() => {
    if (clinicSettings) {
      setForm(f => ({
        ...f,
        enderecoClinica: f.enderecoClinica || clinicSettings.enderecoClinica || "",
        cidade: f.cidade || "",
      }));
      setSettingsForm({
        nomeClinica: clinicSettings.nomeClinica || "",
        enderecoClinica: clinicSettings.enderecoClinica || "",
        telefone: clinicSettings.telefone || "",
        email: clinicSettings.email || "",
      });
    }
  }, [clinicSettings]);

  const saveMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/attestations", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Atestado/Declaração salvo com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["attestations"] });
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao salvar", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/attestations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Removido com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["attestations"] });
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao remover", variant: "destructive" }),
  });

  const settingsMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/clinic-settings", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Configurações salvas" });
      queryClient.invalidateQueries({ queryKey: ["clinic-settings"] });
      setSettingsOpen(false);
    },
    onError: (e: any) => toast({ title: e.message || "Erro", variant: "destructive" }),
  });

  const selectedPatient = useMemo(
    () => patients.find(p => p.id.toString() === form.patientId),
    [patients, form.patientId]
  );

  const generatedText = useMemo(() => {
    if (!selectedPatient) return "";
    const tipo = form.tipoDocumento;
    if ((tipo === "declaracao" || tipo === "atestado") && (!form.dataAtendimento || !form.horaInicio || !form.horaTermino)) return "";
    return generateText(form, selectedPatient.name);
  }, [form, selectedPatient]);

  // Sync customText from auto-generated text (only when the user hasn't manually edited)
  useEffect(() => {
    if (!textEdited) setCustomText(generatedText);
  }, [generatedText, textEdited]);

  // Reset edits when document type changes
  useEffect(() => {
    setTextEdited(false);
  }, [form.tipoDocumento, form.patientId]);

  const handleSave = () => {
    const tipo = form.tipoDocumento;
    const baseValid = !form.patientId || !form.profissionalResponsavel;
    let specificMsg = "";
    if (tipo === "declaracao" || tipo === "atestado") {
      if (!form.dataAtendimento) specificMsg = "Preencha: paciente, data de atendimento e profissional responsável";
    } else if (tipo === "receituario") {
      if (!form.prescricao.trim()) specificMsg = "Preencha: paciente, prescrição e profissional responsável";
    } else if (tipo === "encaminhamento") {
      if (!form.destinoEspecialidade.trim()) specificMsg = "Preencha: paciente, especialidade de destino e profissional responsável";
    } else if (tipo === "solicitacao_exames") {
      if (!form.examesSolicitados.trim()) specificMsg = "Preencha: paciente, exames solicitados e profissional responsável";
    }
    if (baseValid || specificMsg) {
      toast({ title: specificMsg || "Preencha: paciente e profissional responsável", variant: "destructive" });
      return;
    }
    saveMut.mutate({
      ...form,
      patientId: parseInt(form.patientId),
      textoGerado: customText || generatedText,
    });
  };

  const handlePrint = (doc?: Attestation) => {
    const originalTitle = document.title;
    const patient = doc ? patients.find(p => p.id === doc.patientId) : selectedPatient;
    const tipo = doc?.tipoDocumento || form.tipoDocumento;
    const docType = tipoLabel(tipo);
    document.title = `${docType}-${patient?.name || "paciente"}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
    window.print();
    document.title = originalTitle;
  };

  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return history;
    const term = historySearch.toLowerCase();
    return history.filter(h => {
      const patient = patients.find(p => p.id === h.patientId);
      return (patient?.name || "").toLowerCase().includes(term) ||
        h.profissionalResponsavel.toLowerCase().includes(term) ||
        h.tipoDocumento.includes(term);
    });
  }, [history, historySearch, patients]);

  const tipoLabel = (t: string) => {
    const labels: Record<string, string> = {
      declaracao: "Declaração",
      atestado: "Atestado",
      receituario: "Receituário",
      encaminhamento: "Encaminhamento",
      solicitacao_exames: "Solicitação de Exames",
    };
    return labels[t] || t;
  };

  const docTypeLabels: Record<string, string> = {
    declaracao: "DECLARAÇÃO DE COMPARECIMENTO",
    atestado: "ATESTADO",
    receituario: "RECEITUÁRIO",
    encaminhamento: "ENCAMINHAMENTO",
    solicitacao_exames: "SOLICITAÇÃO DE EXAMES",
  };

  // Document preview component (used for print and modal)
  const DocumentPreview = ({ doc, patientName, forPrint = false }: {
    doc?: Attestation; patientName?: string; forPrint?: boolean;
  }) => {
    const d = doc || { ...form, id: 0, createdAt: "" };
    const pName = patientName || selectedPatient?.name || "[Paciente]";
    const text = doc ? (doc.textoGerado || generateText(d as any, pName)) : (customText || generateText(d as any, pName));
    const docType = docTypeLabels[d.tipoDocumento] || d.tipoDocumento.toUpperCase();
    const settings = clinicSettings;
    const isReceituario = d.tipoDocumento === "receituario";

    return (
      <div className={`bg-white border border-gray-200 rounded-lg ${forPrint ? "print-doc" : "shadow"}`}
        style={{ fontFamily: "Georgia, serif", maxWidth: "700px", margin: "0 auto" }}>
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-6 px-8 pt-8">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-bold text-xl text-gray-800">{settings?.nomeClinica || appName}</div>
              {settings?.enderecoClinica && (
                <div className="text-xs text-gray-500 mt-0.5">{settings.enderecoClinica}</div>
              )}
              {settings?.telefone && (
                <div className="text-xs text-gray-500">{settings.telefone}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Data de emissão:</div>
              <div className="text-sm font-medium text-gray-700">{fmtDate(d.dataEmissao)}</div>
              {d.cidade && <div className="text-xs text-gray-500">{d.cidade}</div>}
            </div>
          </div>
        </div>

        {/* Patient info */}
        <div className="px-8 mb-4">
          <p className="text-sm text-gray-700"><span className="font-semibold">Paciente:</span> {pName}</p>
        </div>

        {/* Title */}
        <div className="text-center mb-8 px-8">
          <h1 className="text-xl font-bold text-gray-800 tracking-widest uppercase border-b-2 border-gray-400 pb-2 inline-block px-8">
            {docType}
          </h1>
        </div>

        {/* Body */}
        <div className="px-8 mb-8">
          {isReceituario && (
            <p className="text-xs text-gray-500 uppercase font-bold mb-2">Rx:</p>
          )}
          <p className="text-base text-gray-700 leading-relaxed text-justify whitespace-pre-wrap" style={{ lineHeight: "2" }}>
            {text}
          </p>
          {d.observacoes && (
            <div className="mt-6 p-4 bg-gray-50 rounded border-l-4 border-gray-400">
              <p className="text-sm text-gray-600 italic">{d.observacoes}</p>
            </div>
          )}
        </div>

        {/* Footer / Signature */}
        <div className="px-8 pb-8">
          <div className="mt-16 pt-4 border-t border-gray-400 text-center">
            <div className="text-sm text-gray-700 font-medium">{d.profissionalResponsavel}</div>
            {d.registroProfissional && (
              <div className="text-xs text-gray-500 mt-1">Reg. Profissional: {d.registroProfissional}</div>
            )}
            <div className="text-xs text-gray-400 mt-2">Assinatura</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Print-only header */}
      <div className="print-only">
        <PrintHeader
          title={tipoLabel(form.tipoDocumento)}
          subtitle={selectedPatient?.name}
        />
        {<DocumentPreview forPrint />}
      </div>

      {/* Screen content — hidden in print */}
      <div className="no-print">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Documentos Clínicos</h1>
            <p className="text-muted-foreground mt-1">Emissão de atestados, declarações, receituários, encaminhamentos e solicitações de exames</p>
          </div>
          <div className="flex gap-2">
            {me?.role === "admin" && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSettingsOpen(true)}>
                <Settings className="h-4 w-4" /> Configurações da Clínica
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full sm:w-auto grid-cols-2">
            <TabsTrigger value="emitir" className="gap-2">
              <FileText className="h-3.5 w-3.5" /> Emitir Documento
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <Eye className="h-3.5 w-3.5" /> Histórico
            </TabsTrigger>
          </TabsList>

          {/* ── TAB: EMITIR ─────────────────────────────────────────── */}
          <TabsContent value="emitir" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Dados do Documento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Tipo de documento */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo de Documento</Label>
                      <Select value={form.tipoDocumento} onValueChange={v => setForm(f => ({ ...f, tipoDocumento: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="declaracao">Declaração de Comparecimento</SelectItem>
                          <SelectItem value="atestado">Atestado</SelectItem>
                          <SelectItem value="receituario">Receituário</SelectItem>
                          <SelectItem value="encaminhamento">Encaminhamento</SelectItem>
                          <SelectItem value="solicitacao_exames">Solicitação de Exames</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Data de Emissão</Label>
                      <Input type="date" value={form.dataEmissao} onChange={e => setForm(f => ({ ...f, dataEmissao: e.target.value }))} />
                    </div>
                  </div>

                  {/* Paciente */}
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Paciente *</Label>
                    <Select value={form.patientId} onValueChange={v => setForm(f => ({ ...f, patientId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione um paciente" /></SelectTrigger>
                      <SelectContent>
                        {patients.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Campos específicos para Declaração e Atestado */}
                  {["declaracao", "atestado"].includes(form.tipoDocumento) && (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Data Atendimento *</Label>
                          <Input type="date" value={form.dataAtendimento} onChange={e => setForm(f => ({ ...f, dataAtendimento: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Hora Início</Label>
                          <Input type="time" value={form.horaInicio} onChange={e => setForm(f => ({ ...f, horaInicio: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Hora Término</Label>
                          <Input type="time" value={form.horaTermino} onChange={e => setForm(f => ({ ...f, horaTermino: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo de Atendimento *</Label>
                        <Select value={form.tipoAtendimento} onValueChange={v => setForm(f => ({ ...f, tipoAtendimento: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TIPOS_ATENDIMENTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {form.tipoAtendimento === "Outro" && (
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Especifique o tipo</Label>
                          <Input placeholder="Descreva o tipo de atendimento..." value={form.outroTipoAtendimento}
                            onChange={e => setForm(f => ({ ...f, outroTipoAtendimento: e.target.value }))} />
                        </div>
                      )}
                    </>
                  )}

                  {/* Texto editável — Declaração / Atestado */}
                  {["declaracao", "atestado"].includes(form.tipoDocumento) && selectedPatient && customText && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <Label className="text-xs font-medium text-muted-foreground block">
                          Texto do Documento
                          {textEdited && <span className="ml-2 text-primary font-semibold">(editado)</span>}
                        </Label>
                        {textEdited && (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                            onClick={() => { setCustomText(generatedText); setTextEdited(false); }}
                          >
                            Restaurar padrão
                          </button>
                        )}
                      </div>
                      <Textarea
                        rows={5}
                        value={customText}
                        onChange={e => { setCustomText(e.target.value); setTextEdited(true); }}
                        className="text-sm leading-relaxed"
                        placeholder="Texto gerado automaticamente conforme os dados acima..."
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        O texto é gerado automaticamente. Você pode editar livremente antes de salvar ou imprimir.
                      </p>
                    </div>
                  )}

                  {/* Campos específicos para Receituário */}
                  {form.tipoDocumento === "receituario" && (
                    <>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Prescrição *</Label>
                        <Textarea rows={5} placeholder={"Ex:\nAmoxicilina 500mg – 1 cápsula de 8/8h por 7 dias\nIbuprofeno 400mg – 1 comprimido de 12/12h se dor"}
                          value={form.prescricao} onChange={e => setForm(f => ({ ...f, prescricao: e.target.value }))} />
                      </div>
                      <div className="w-40">
                        <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Validade (dias)</Label>
                        <Input type="number" min="1" value={form.validadePrescricao}
                          onChange={e => setForm(f => ({ ...f, validadePrescricao: e.target.value }))} />
                      </div>
                    </>
                  )}

                  {/* Campos específicos para Encaminhamento */}
                  {form.tipoDocumento === "encaminhamento" && (
                    <>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Especialidade / Clínica de Destino *</Label>
                        <Input placeholder="Ex: Ortopedista, Clínica de Neurologia..." value={form.destinoEspecialidade}
                          onChange={e => setForm(f => ({ ...f, destinoEspecialidade: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Motivo do Encaminhamento *</Label>
                        <Textarea rows={3} placeholder="Descreva o motivo clínico do encaminhamento..."
                          value={form.motivoEncaminhamento} onChange={e => setForm(f => ({ ...f, motivoEncaminhamento: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Urgência</Label>
                        <Select value={form.urgencia} onValueChange={v => setForm(f => ({ ...f, urgencia: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Normal">Normal</SelectItem>
                            <SelectItem value="Urgente">Urgente</SelectItem>
                            <SelectItem value="Emergência">Emergência</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {/* Campos específicos para Solicitação de Exames */}
                  {form.tipoDocumento === "solicitacao_exames" && (
                    <>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Exames Solicitados * (um por linha)</Label>
                        <Textarea rows={4} placeholder={"Ex:\nHemograma completo\nRaio-X coluna lombar AP e Perfil\nRessonância magnética de ombro direito"}
                          value={form.examesSolicitados} onChange={e => setForm(f => ({ ...f, examesSolicitados: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Justificativa Clínica</Label>
                        <Textarea rows={2} placeholder="Justificativa para a solicitação..."
                          value={form.justificativaExames} onChange={e => setForm(f => ({ ...f, justificativaExames: e.target.value }))} />
                      </div>
                    </>
                  )}

                  {/* Profissional */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Profissional Responsável *</Label>
                      <Input placeholder="Nome completo" value={form.profissionalResponsavel}
                        onChange={e => setForm(f => ({ ...f, profissionalResponsavel: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">N° Registro (CREFITO)</Label>
                      <Input placeholder="Ex: 123456-F" value={form.registroProfissional}
                        onChange={e => setForm(f => ({ ...f, registroProfissional: e.target.value }))} />
                    </div>
                  </div>

                  {/* Localização */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cidade</Label>
                      <Input placeholder="Cidade" value={form.cidade}
                        onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Endereço da Clínica</Label>
                      <Input placeholder="Endereço completo" value={form.enderecoClinica}
                        onChange={e => setForm(f => ({ ...f, enderecoClinica: e.target.value }))} />
                    </div>
                  </div>

                  {/* Observações */}
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Observações Adicionais</Label>
                    <Textarea placeholder="Observações opcionais a serem incluídas no documento..." rows={2}
                      value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    <Button onClick={handleSave} disabled={saveMut.isPending} className="gap-2">
                      <Save className="h-4 w-4" />
                      {saveMut.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => handlePrint()}>
                      <Printer className="h-4 w-4" /> Imprimir
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => handlePrint()}>
                      <FileDown className="h-4 w-4" /> Salvar PDF
                    </Button>
                    <Button variant="ghost" className="gap-2 text-muted-foreground"
                      onClick={() => setForm({ ...emptyForm, enderecoClinica: clinicSettings?.enderecoClinica || "" })}>
                      <Eraser className="h-4 w-4" /> Limpar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Preview */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pré-visualização</h2>
                </div>
                {selectedPatient ? (
                  <DocumentPreview />
                ) : (
                  <div className="h-[400px] border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <FileText className="h-12 w-12 opacity-20" />
                    <p className="text-sm">Selecione um paciente e preencha os dados para ver a pré-visualização</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── TAB: HISTÓRICO ──────────────────────────────────────── */}
          <TabsContent value="historico" className="mt-6">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar por paciente ou profissional..."
                  value={historySearch} onChange={e => setHistorySearch(e.target.value)} />
              </div>

              {historyLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                  <FileText className="h-12 w-12 opacity-20" />
                  <p className="text-sm">Nenhum atestado ou declaração emitido ainda</p>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("emitir")}>
                    Emitir primeiro documento
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredHistory.map(doc => {
                    const patient = patients.find(p => p.id === doc.patientId);
                    const tipoAtend = doc.tipoAtendimento === "Outro" ? (doc.outroTipoAtendimento || "Outro") : doc.tipoAtendimento;
                    return (
                      <Card key={doc.id} className="border shadow-sm print-avoid-break">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={
                                  doc.tipoDocumento === "declaracao" ? "bg-blue-100 text-blue-800 border-blue-200" :
                                  doc.tipoDocumento === "atestado" ? "bg-green-100 text-green-800 border-green-200" :
                                  doc.tipoDocumento === "receituario" ? "bg-purple-100 text-purple-800 border-purple-200" :
                                  doc.tipoDocumento === "encaminhamento" ? "bg-orange-100 text-orange-800 border-orange-200" :
                                  "bg-cyan-100 text-cyan-800 border-cyan-200"
                                }>
                                  {tipoLabel(doc.tipoDocumento)}
                                </Badge>
                                <span className="font-medium text-sm">{patient?.name || `Paciente #${doc.patientId}`}</span>
                                <span className="text-xs text-muted-foreground">· {tipoAtend}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                                {["declaracao", "atestado"].includes(doc.tipoDocumento) && doc.dataAtendimento && (
                                  <span>Atendimento: {fmtDate(doc.dataAtendimento)} — {doc.horaInicio} às {doc.horaTermino}</span>
                                )}
                                <span>Profissional: {doc.profissionalResponsavel}</span>
                                {doc.criadoPor && <span>Por: {doc.criadoPor}</span>}
                              </div>
                              <div className="text-xs text-muted-foreground/60 mt-0.5">
                                Emitido em: {fmtDate(doc.dataEmissao)}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-8 w-8"
                                title="Visualizar" onClick={() => setPreviewDoc(doc)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8"
                                title="Imprimir" onClick={() => {
                                  setPreviewDoc(doc);
                                  setTimeout(() => handlePrint(doc), 100);
                                }}>
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-red-50"
                                title="Remover" onClick={() => deleteMut.mutate(doc.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview Dialog */}
      {previewDoc && (
        <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {tipoLabel(previewDoc.tipoDocumento)} — {patients.find(p => p.id === previewDoc.patientId)?.name}
              </DialogTitle>
            </DialogHeader>
            <DocumentPreview
              doc={previewDoc}
              patientName={patients.find(p => p.id === previewDoc.patientId)?.name}
            />
            <div className="flex gap-2 mt-4 no-print">
              <Button className="gap-2" onClick={() => handlePrint(previewDoc)}>
                <Printer className="h-4 w-4" /> Imprimir
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => handlePrint(previewDoc)}>
                <FileDown className="h-4 w-4" /> Salvar PDF
              </Button>
              <Button variant="ghost" onClick={() => setPreviewDoc(null)}>Fechar</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Clinic Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Configurações da Clínica
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome da Clínica</Label>
              <Input value={settingsForm.nomeClinica} onChange={e => setSettingsForm(f => ({ ...f, nomeClinica: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Endereço Completo</Label>
              <Input placeholder="Rua, Número, Bairro, Cidade - Estado" value={settingsForm.enderecoClinica}
                onChange={e => setSettingsForm(f => ({ ...f, enderecoClinica: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Telefone</Label>
                <Input placeholder="(XX) XXXXX-XXXX" value={settingsForm.telefone}
                  onChange={e => setSettingsForm(f => ({ ...f, telefone: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">E-mail</Label>
                <Input type="email" placeholder="clinica@email.com" value={settingsForm.email}
                  onChange={e => setSettingsForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <Button onClick={() => settingsMut.mutate(settingsForm)} disabled={settingsMut.isPending} className="gap-2 flex-1">
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
