import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { CheckCircle2, XCircle, Loader2, CalendarDays, Clock, User, Stethoscope, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/contexts/AppSettingsContext";

type AppointmentInfo = {
  patientName: string;
  therapistName: string;
  date: string;
  time: string;
  status: string;
  notes?: string | null;
};

type Phase = "loading" | "info" | "confirmed" | "cancelled" | "already_done" | "error" | "expired";

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${d} de ${months[parseInt(m) - 1]} de ${y}`;
}

export default function Confirmar() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token") ?? "";

  const { systemName, logoUrl } = useAppSettings();

  const [phase, setPhase] = useState<Phase>("loading");
  const [info, setInfo] = useState<AppointmentInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    if (!token) {
      setPhase("error");
      setErrorMsg("Link inválido. Nenhum token encontrado.");
      return;
    }

    fetch(`/api/confirm?token=${encodeURIComponent(token)}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 410) { setPhase("expired"); return; }
          setPhase("error");
          setErrorMsg(data.error || "Link inválido.");
          return;
        }
        setInfo(data as AppointmentInfo);
        if (data.status === "confirmado" || data.status === "presente") {
          setPhase("already_done");
        } else if (data.status === "cancelado") {
          setPhase("already_done");
        } else {
          setPhase("info");
        }
      })
      .catch(() => {
        setPhase("error");
        setErrorMsg("Não foi possível carregar os dados da consulta. Tente novamente.");
      });
  }, [token]);

  const handleConfirm = async () => {
    setIsActing(true);
    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase("error");
        setErrorMsg(data.error || "Erro ao confirmar.");
      } else {
        setPhase("confirmed");
      }
    } catch {
      setPhase("error");
      setErrorMsg("Erro de conexão. Tente novamente.");
    } finally {
      setIsActing(false);
    }
  };

  const handleCancel = async () => {
    setIsActing(true);
    try {
      const res = await fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase("error");
        setErrorMsg(data.error || "Erro ao cancelar.");
      } else {
        setPhase("cancelled");
      }
    } catch {
      setPhase("error");
      setErrorMsg("Erro de conexão. Tente novamente.");
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex flex-col items-center justify-center p-4">
      {/* Header / Brand */}
      <div className="mb-8 flex flex-col items-center gap-2">
        {logoUrl ? (
          <img src={logoUrl} alt={systemName} className="h-14 w-14 object-contain rounded-2xl shadow" />
        ) : (
          <div className="h-14 w-14 bg-teal-600 rounded-2xl flex items-center justify-center shadow">
            <Stethoscope className="h-7 w-7 text-white" />
          </div>
        )}
        <span className="text-xl font-bold text-slate-800">{systemName || "CliniSmart"}</span>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Loading */}
        {phase === "loading" && (
          <div className="p-8 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 text-teal-600 animate-spin" />
            <p className="text-slate-600 text-sm">Carregando informações da consulta…</p>
          </div>
        )}

        {/* Info + action buttons */}
        {phase === "info" && info && (
          <>
            <div className="bg-teal-600 px-6 py-5 text-white">
              <p className="text-sm font-medium opacity-80 mb-1">Confirmação de consulta</p>
              <h2 className="text-xl font-bold">Olá, {info.patientName.split(" ")[0]}! 👋</h2>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-slate-600 text-sm">Você tem uma consulta agendada. Por favor, confirme sua presença:</p>

              <div className="rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-200">
                <div className="flex items-center gap-3 px-4 py-3">
                  <CalendarDays className="h-4 w-4 text-teal-600 shrink-0" />
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Data</p>
                    <p className="text-sm font-semibold text-slate-800">{formatDate(info.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <Clock className="h-4 w-4 text-teal-600 shrink-0" />
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Horário</p>
                    <p className="text-sm font-semibold text-slate-800">{info.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <User className="h-4 w-4 text-teal-600 shrink-0" />
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Profissional</p>
                    <p className="text-sm font-semibold text-slate-800">{info.therapistName}</p>
                  </div>
                </div>
                {info.notes && (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <Stethoscope className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Observações</p>
                      <p className="text-sm text-slate-700">{info.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-12 text-base rounded-xl gap-2"
                  onClick={handleConfirm}
                  disabled={isActing}
                >
                  {isActing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                  ✅ Confirmar presença
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-red-200 text-red-600 hover:bg-red-50 font-semibold h-12 text-base rounded-xl gap-2"
                  onClick={handleCancel}
                  disabled={isActing}
                >
                  {isActing ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5" />}
                  ❌ Cancelar consulta
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Confirmed */}
        {phase === "confirmed" && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Presença confirmada!</h2>
              <p className="text-slate-500 text-sm">
                Obrigado, {info?.patientName.split(" ")[0]}! Sua presença foi confirmada.<br />
                Aguardamos você na clínica. 😊
              </p>
            </div>
            {info && (
              <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
                <strong>{formatDate(info.date)}</strong> às <strong>{info.time}</strong>
              </div>
            )}
          </div>
        )}

        {/* Cancelled */}
        {phase === "cancelled" && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-9 w-9 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Consulta cancelada</h2>
              <p className="text-slate-500 text-sm">
                Recebemos o seu cancelamento. Para reagendar, entre em contato com a clínica.
              </p>
            </div>
          </div>
        )}

        {/* Already done */}
        {phase === "already_done" && info && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-slate-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Consulta já processada</h2>
              <p className="text-slate-500 text-sm">
                Este link já foi utilizado. O status atual da sua consulta é:{" "}
                <strong>{info.status === "confirmado" || info.status === "presente" ? "✅ Confirmada" : "❌ Cancelada"}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Expired */}
        {phase === "expired" && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-9 w-9 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Link expirado</h2>
              <p className="text-slate-500 text-sm">
                Este link de confirmação expirou (validade de 48h).<br />
                Entre em contato com a clínica para confirmar sua presença.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-9 w-9 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Link inválido</h2>
              <p className="text-slate-500 text-sm">{errorMsg || "Este link não é válido. Verifique a mensagem recebida."}</p>
            </div>
          </div>
        )}

        <div className="px-6 pb-6 pt-0 text-center">
          <p className="text-[11px] text-slate-400">{systemName || "CliniSmart"} · Sistema de Agendamento</p>
        </div>
      </div>
    </div>
  );
}
