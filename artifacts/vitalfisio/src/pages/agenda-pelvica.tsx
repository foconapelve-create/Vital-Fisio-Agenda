import { AgendaEspecializada } from "@/components/AgendaEspecializada";
import { useAppSettings } from "@/contexts/AppSettingsContext";

export default function AgendaPelvica() {
  const { nomeClinica, systemName } = useAppSettings();
  return (
    <AgendaEspecializada
      agendaType="pelvica"
      title="Agenda — Fisioterapia Pélvica"
      clinicName={nomeClinica || systemName}
    />
  );
}
