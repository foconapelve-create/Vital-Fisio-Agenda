import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  FileText, Search, X, ChevronDown, ChevronUp,
  UserRound, Stethoscope, Activity, Zap, Target,
  CheckCircle2, StickyNote, ExternalLink, Calendar,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

type EvolutionRecord = {
  id: number;
  patientId: number;
  therapistId: number;
  appointmentId: number | null;
  date: string;
  content: string;
  therapistName: string;
  therapistSpecialty: string;
  patientName: string;
  createdAt: string;
};

const fmtDate = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

const SECTION_KEYS = ["queixa", "dor", "exame", "procedimentos", "resposta", "conduta", "obs"] as const;
type SectionKey = typeof SECTION_KEYS[number];
const SECTION_LABELS: Record<SectionKey, string> = {
  queixa: "Queixa Principal",
  dor: "Dor (0–10)",
  exame: "Exame Físico",
  procedimentos: "Procedimentos",
  resposta: "Resposta",
  conduta: "Conduta",
  obs: "Observações",
};
const SECTION_ICONS: Record<SectionKey, React.ReactNode> = {
  queixa: <StickyNote className="h-3.5 w-3.5" />,
  dor: <Zap className="h-3.5 w-3.5" />,
  exame: <Stethoscope className="h-3.5 w-3.5" />,
  procedimentos: <Activity className="h-3.5 w-3.5" />,
  resposta: <CheckCircle2 className="h-3.5 w-3.5" />,
  conduta: <Target className="h-3.5 w-3.5" />,
  obs: <FileText className="h-3.5 w-3.5" />,
};

function parseEvolution(content: string): Record<SectionKey, string> | null {
  if (!content.includes("**Queixa:**") && !content.includes("**queixa:**")) return null;
  const result: Record<SectionKey, string> = { queixa: "", dor: "", exame: "", procedimentos: "", resposta: "", conduta: "", obs: "" };
  const patterns: [SectionKey, RegExp][] = [
    ["queixa", /\*\*Queixa:\*\*\s*([\s\S]*?)(?=\*\*|$)/i],
    ["dor", /\*\*Dor:\*\*\s*([\s\S]*?)(?=\*\*|$)/i],
    ["exame", /\*\*Exame Físico:\*\*\s*([\s\S]*?)(?=\*\*|$)/i],
    ["procedimentos", /\*\*Procedimentos:\*\*\s*([\s\S]*?)(?=\*\*|$)/i],
    ["resposta", /\*\*Resposta:\*\*\s*([\s\S]*?)(?=\*\*|$)/i],
    ["conduta", /\*\*Conduta:\*\*\s*([\s\S]*?)(?=\*\*|$)/i],
    ["obs", /\*\*Observações:\*\*\s*([\s\S]*?)(?=\*\*|$)/i],
  ];
  for (const [key, regex] of patterns) {
    const m = content.match(regex);
    if (m) result[key] = m[1].trim();
  }
  return result;
}

function DorBadge({ value }: { value: string }) {
  const num = parseInt(value);
  if (isNaN(num)) return <span className="text-sm">{value}</span>;
  const color = num <= 2 ? "bg-green-500" : num <= 4 ? "bg-yellow-400" : num <= 6 ? "bg-orange-400" : "bg-red-500";
  return (
    <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold ${color}`}>
      {num}
    </div>
  );
}

function EvolutionContent({ content, expanded }: { content: string; expanded: boolean }) {
  const parsed = parseEvolution(content);
  if (!parsed) {
    const text = expanded ? content : content.slice(0, 240) + (content.length > 240 ? "…" : "");
    return <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">{text}</p>;
  }
  const fields = SECTION_KEYS.filter(k => parsed[k]);
  const visible = expanded ? fields : fields.slice(0, 3);
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {visible.map(k => (
        <div key={k} className={`rounded-lg p-2.5 bg-muted/40 border border-border/60 ${k === "exame" || k === "procedimentos" || k === "obs" ? "sm:col-span-2" : ""}`}>
          <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {SECTION_ICONS[k]} {SECTION_LABELS[k]}
          </div>
          {k === "dor" ? (
            <div className="flex items-center gap-2"><DorBadge value={parsed[k]} /><span className="text-sm">{parsed[k]}/10</span></div>
          ) : (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{parsed[k]}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Evolucoes() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const { data: evolutions = [], isLoading } = useQuery<EvolutionRecord[]>({
    queryKey: ["evolutions-all"],
    queryFn: () => apiFetch("/api/evolutions?limit=200"),
    refetchInterval: 60000,
  });

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return evolutions as EvolutionRecord[];
    const q = searchQuery.toLowerCase();
    return (evolutions as EvolutionRecord[]).filter(ev =>
      ev.patientName.toLowerCase().includes(q) ||
      ev.therapistName.toLowerCase().includes(q) ||
      ev.content.toLowerCase().includes(q) ||
      fmtDate(ev.date).includes(q)
    );
  }, [evolutions, searchQuery]);

  function toggleExpand(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const groupedByDate = useMemo(() => {
    const groups: Record<string, EvolutionRecord[]> = {};
    for (const ev of filtered) {
      if (!groups[ev.date]) groups[ev.date] = [];
      groups[ev.date].push(ev);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const uniquePatients = useMemo(() =>
    new Set((evolutions as EvolutionRecord[]).map(e => e.patientId)).size,
    [evolutions]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evoluções Clínicas</h1>
          <p className="text-muted-foreground mt-1">Registro de evoluções de todos os pacientes</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{(evolutions as EvolutionRecord[]).length}</p>
            <p className="text-sm text-muted-foreground mt-0.5">Total de Evoluções</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-teal-600">{uniquePatients}</p>
            <p className="text-sm text-muted-foreground mt-0.5">Pacientes com Evolução</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{groupedByDate.length}</p>
            <p className="text-sm text-muted-foreground mt-0.5">Dias com Registro</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por paciente, fisioterapeuta, data ou conteúdo..."
          className="pl-9"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {searchQuery && (
        <p className="text-sm text-muted-foreground -mt-2">
          {filtered.length} resultado(s) para "<span className="font-medium text-foreground">{searchQuery}</span>"
        </p>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5 space-y-3">
                <div className="h-4 w-1/4 bg-muted rounded" />
                <div className="h-16 w-full bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileText className="h-14 w-14 mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium">{searchQuery ? "Nenhum resultado" : "Nenhuma evolução registrada"}</p>
          <p className="text-sm mt-1">{searchQuery ? "Tente um termo diferente" : "Acesse o histórico de um paciente para registrar"}</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setLocation("/patients")}>
            <UserRound className="h-4 w-4" /> Ir para Pacientes
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map(([date, evs]) => (
            <div key={date}>
              {/* Date divider */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2 bg-muted/60 rounded-full px-3 py-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold">{fmtDate(date)}</span>
                  <span className="text-xs text-muted-foreground">· {evs.length} evolução(ões)</span>
                </div>
                <Separator className="flex-1" />
              </div>

              <div className="space-y-3 pl-1">
                {evs.map(ev => {
                  const expanded = expandedIds.has(ev.id);
                  const parsed = parseEvolution(ev.content);
                  const hasMore = parsed
                    ? SECTION_KEYS.filter(k => parsed[k]).length > 3
                    : ev.content.length > 240;

                  return (
                    <Card key={ev.id} className="border border-border hover:shadow-md transition-all">
                      <CardContent className="p-0">
                        {/* Card header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-muted/20 rounded-t-xl">
                          <div className="flex items-center gap-3 flex-wrap min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <UserRound className="h-4 w-4 text-primary" />
                              </div>
                              <span className="font-semibold text-sm truncate max-w-[160px]">{ev.patientName}</span>
                            </div>
                            <Separator orientation="vertical" className="h-4 shrink-0" />
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                              <Stethoscope className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[120px]">{ev.therapistName}</span>
                              {ev.therapistSpecialty && <span className="hidden sm:inline">· {ev.therapistSpecialty}</span>}
                            </div>
                            {ev.appointmentId && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 gap-1 shrink-0">
                                <CheckCircle2 className="h-3 w-3" /> Sessão
                              </Badge>
                            )}
                            {parsed && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 shrink-0">Estruturada</Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-xs text-primary hover:text-primary shrink-0 ml-2"
                            onClick={() => setLocation(`/patients/${ev.patientId}/history`)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Ver Paciente</span>
                          </Button>
                        </div>

                        {/* Card content */}
                        <div className="p-5">
                          <EvolutionContent content={ev.content} expanded={expanded} />
                          {hasMore && (
                            <button
                              className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
                              onClick={() => toggleExpand(ev.id)}
                            >
                              {expanded
                                ? <><ChevronUp className="h-3.5 w-3.5" /> Ver menos</>
                                : <><ChevronDown className="h-3.5 w-3.5" /> Ver completo</>}
                            </button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
