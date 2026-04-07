import { useState, ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: ReactNode }) {
  const [isMobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isMobileOpen={isMobileOpen} setMobileOpen={setMobileOpen} />
      
      <div className="md:ml-64 flex flex-col min-h-screen">
        <header className="md:hidden sticky top-0 z-30 flex items-center h-16 px-4 bg-card border-b border-border shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="mr-2">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="font-bold text-lg text-primary flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-sm">V</div>
            VitalFisio
          </div>
        </header>
        
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
