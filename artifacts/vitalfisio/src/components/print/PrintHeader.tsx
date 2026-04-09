import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PrintHeaderProps {
  title: string;
  subtitle?: string;
  date?: Date;
}

export function PrintHeader({ title, subtitle, date = new Date() }: PrintHeaderProps) {
  return (
    <div className="print-only border-b border-gray-300 pb-4 mb-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded bg-teal-600 flex items-center justify-center text-white font-bold text-sm">V</div>
            <span className="text-xl font-bold text-teal-700">VitalFisio</span>
          </div>
          <p className="text-xs text-gray-500">Clínica de Fisioterapia</p>
        </div>
        <div className="text-right">
          <h1 className="text-lg font-bold text-gray-800">{title}</h1>
          {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
          <p className="text-xs text-gray-400 mt-1">
            Emitido em {format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </div>
    </div>
  );
}
