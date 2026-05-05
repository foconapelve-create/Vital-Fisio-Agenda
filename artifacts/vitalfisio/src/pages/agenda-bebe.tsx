import { AgendaEspecializada } from "@/components/AgendaEspecializada";
import { useAppSettings } from "@/contexts/AppSettingsContext";

export default function AgendaBebe() {
  const { nomeClinica, systemName } = useAppSettings();
  return (
    <AgendaEspecializada
      agendaType="bebe"
      title="Agenda — Bebês"
      clinicName={nomeClinica || systemName}
    />
  );
}
