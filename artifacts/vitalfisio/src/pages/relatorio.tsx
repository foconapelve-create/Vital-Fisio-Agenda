import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAppSettings } from "@/contexts/AppSettingsContext";

type Patient = { id: number; name: string; phone: string; birthDate?: string | null; notes?: string | null };
type Therapist = { id: number; name: string; specialty?: string | null };

const TIPOS_RELATORIO = [
  "Relatório Fisioterapêutico",
  "Relatório Fonoaudiológico",
  "Relatório Psicológico",
  "Relatório Nutricional",
  "Relatório Médico",
  "Relatório de Enfermagem",
  "Relatório de Terapia Ocupacional",
  "Relatório Multiprofissional",
  "Relatório Personalizado",
];

const fmtDate = (s?: string | null) => {
  if (!s) return "-";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

export default function Relatorio() {
  const { toast } = useToast();
  const { systemName, nomeClinica } = useAppSettings();
  const printRef = useRef<HTMLDivElement>(null);

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["patients"],
    queryFn: () => apiFetch("/api/patients"),
  });

  const { data: therapists = [] } = useQuery<Therapist[]>({
    queryKey: ["therapists"],
    queryFn: () => apiFetch("/api/therapists"),
  });

  const { data: me } = useQuery<any>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/auth/me"),
  });

  const [form, setForm] = useState({
    clinicName: nomeClinica || systemName,
    patientId: "",
    therapistId: "",
    reportDate: new Date().toISOString().split("T")[0],
    tipoRelatorio: "Relatório Fisioterapêutico",
    title: "",
    mainText: "",
    diagnosis: "",
    treatment: "",
    evolution: "",
    conclusion: "",
  });

  useEffect(() => {
    if (me && (me.role === "profissional" || me.role === "fisioterapeuta")) {
      const matched = (therapists as Therapist[]).find(t =>
        t.name.toLowerCase().includes((me.name || "").toLowerCase().split(" ")[0]) ||
        (me.name || "").toLowerCase().includes(t.name.toLowerCase().split(" ")[0])
      );
      if (matched) setForm(f => ({ ...f, therapistId: String(matched.id) }));
    }
  }, [me, therapists]);

  const selectedPatient = (patients as Patient[]).find(p => p.id === parseInt(form.patientId));
  const selectedTherapist = (therapists as Therapist[]).find(t => t.id === parseInt(form.therapistId));

  function handlePrint() {
    if (!form.mainText && !form.treatment && !form.evolution) {
      toast({ title: "Preencha o conteúdo do relatório antes de imprimir", variant: "destructive" });
      return;
    }
    window.print();
  }

  const F = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="text-sm font-medium">{value || "-"}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatório Clínico</h1>
          <p className="text-muted-foreground mt-1">Elabore e imprima relatórios clínicos profissionais</p>
        </div>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" /> Imprimir / PDF
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulário */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Dados do Relatório</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Tipo de Relatório</Label>
                <Select value={form.tipoRelatorio} onValueChange={v => setForm(p => ({ ...p, tipoRelatorio: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_RELATORIO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nome da Clínica</Label>
                <Input value={form.clinicName} onChange={e => setForm(p => ({ ...p, clinicName: e.target.value }))} />
              </div>
              <div>
                <Label>Título Personalizado <span className="text-muted-foreground text-xs">(opcional — usa o tipo se vazio)</span></Label>
                <Input placeholder={form.tipoRelatorio} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={form.reportDate} onChange={e => setForm(p => ({ ...p, reportDate: e.target.value }))} />
              </div>
              <div>
                <Label>Paciente</Label>
                <Select value={form.patientId} onValueChange={v => setForm(p => ({ ...p, patientId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar paciente..." /></SelectTrigger>
                  <SelectContent>
                    {(patients as Patient[]).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fisioterapeuta Responsável</Label>
                <Select value={form.therapistId} onValueChange={v => setForm(p => ({ ...p, therapistId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar fisioterapeuta..." /></SelectTrigger>
                  <SelectContent>
                    {(therapists as Therapist[]).map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Conteúdo Clínico</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Diagnóstico / Queixa Principal</Label>
                <Textarea rows={2} value={form.diagnosis} onChange={e => setForm(p => ({ ...p, diagnosis: e.target.value }))}
                  placeholder="Descreva o diagnóstico ou queixa principal..." />
              </div>
              <div>
                <Label>Tratamento Realizado</Label>
                <Textarea rows={3} value={form.treatment} onChange={e => setForm(p => ({ ...p, treatment: e.target.value }))}
                  placeholder="Descreva as técnicas e procedimentos aplicados..." />
              </div>
              <div>
                <Label>Evolução do Paciente</Label>
                <Textarea rows={3} value={form.evolution} onChange={e => setForm(p => ({ ...p, evolution: e.target.value }))}
                  placeholder="Descreva a evolução clínica do paciente..." />
              </div>
              <div>
                <Label>Conclusão / Observações Finais</Label>
                <Textarea rows={2} value={form.conclusion} onChange={e => setForm(p => ({ ...p, conclusion: e.target.value }))}
                  placeholder="Considerações finais e recomendações..." />
              </div>
              <div>
                <Label>Texto Livre Adicional</Label>
                <Textarea rows={3} value={form.mainText} onChange={e => setForm(p => ({ ...p, mainText: e.target.value }))}
                  placeholder="Informações adicionais..." />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview do relatório */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Pré-visualização
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={printRef} id="print-area" className="bg-white text-black p-6 border border-gray-200 rounded text-sm space-y-5 font-serif">
                {/* Cabeçalho */}
                <div className="text-center border-b-2 border-gray-800 pb-4">
                  <h1 className="text-2xl font-bold uppercase">{form.clinicName || systemName}</h1>
                  {selectedTherapist?.specialty && (
                    <p className="text-sm text-gray-600">{selectedTherapist.specialty}</p>
                  )}
                  <h2 className="text-lg font-semibold mt-2 uppercase">{form.title || form.tipoRelatorio}</h2>
                </div>

                {/* Dados do paciente */}
                {selectedPatient && (
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <p className="font-semibold text-xs uppercase mb-2 text-gray-500">Dados do Paciente</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="font-medium">Nome:</span> {selectedPatient.name}</div>
                      <div><span className="font-medium">Telefone:</span> {selectedPatient.phone}</div>
                      {selectedPatient.birthDate && (
                        <div><span className="font-medium">Data de Nascimento:</span> {fmtDate(selectedPatient.birthDate)}</div>
                      )}
                      <div><span className="font-medium">Data do Relatório:</span> {fmtDate(form.reportDate)}</div>
                    </div>
                  </div>
                )}

                {/* Conteúdo */}
                {form.diagnosis && (
                  <div>
                    <p className="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">Diagnóstico / Queixa Principal</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{form.diagnosis}</p>
                  </div>
                )}
                {form.treatment && (
                  <div>
                    <p className="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">Tratamento Realizado</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{form.treatment}</p>
                  </div>
                )}
                {form.evolution && (
                  <div>
                    <p className="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">Evolução do Paciente</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{form.evolution}</p>
                  </div>
                )}
                {form.conclusion && (
                  <div>
                    <p className="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">Conclusão</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{form.conclusion}</p>
                  </div>
                )}
                {form.mainText && (
                  <div>
                    <p className="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">Observações</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{form.mainText}</p>
                  </div>
                )}

                {/* Assinatura */}
                <div className="pt-6 mt-6 border-t border-gray-400">
                  <div className="flex justify-between items-end">
                    <div className="text-xs text-gray-500">
                      {form.clinicName} — {fmtDate(form.reportDate)}
                    </div>
                    <div className="text-center">
                      <div className="border-t border-gray-600 pt-2 px-8">
                        <p className="font-semibold text-sm">{selectedTherapist?.name || "__________________________"}</p>
                        <p className="text-xs text-gray-600">
                          {selectedTherapist?.specialty || "Profissional Responsável"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <style>{`
        @media print {
          body > * { display: none !important; }
          #print-area { display: block !important; position: fixed; top: 0; left: 0; width: 100%; padding: 20mm; }
          #print-area, #print-area * { color: black !important; background: white !important; }
        }
      `}</style>
    </div>
  );
}
