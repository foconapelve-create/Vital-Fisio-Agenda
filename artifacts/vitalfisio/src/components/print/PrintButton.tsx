import { Printer, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface PrintButtonProps {
  title?: string;
  filename?: string;
  variant?: "outline" | "default" | "ghost";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
  showPdfButton?: boolean;
}

export function PrintButton({
  title,
  filename,
  variant = "outline",
  size = "sm",
  className = "",
  showPdfButton = true,
}: PrintButtonProps) {
  const handlePrint = () => {
    const originalTitle = document.title;
    if (filename) document.title = filename;
    else if (title) document.title = `VitalFisio - ${title} - ${format(new Date(), "yyyy-MM-dd")}`;
    window.print();
    document.title = originalTitle;
  };

  return (
    <div className={`flex gap-2 no-print ${className}`}>
      <Button variant={variant} size={size} onClick={handlePrint} className="gap-1.5">
        <Printer className="h-4 w-4" />
        <span className="hidden sm:inline">Imprimir</span>
      </Button>
      {showPdfButton && (
        <Button variant={variant} size={size} onClick={handlePrint} className="gap-1.5">
          <FileDown className="h-4 w-4" />
          <span className="hidden sm:inline">Salvar PDF</span>
        </Button>
      )}
    </div>
  );
}
