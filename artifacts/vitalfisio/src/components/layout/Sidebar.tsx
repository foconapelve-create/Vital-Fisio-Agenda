import { useLocation } from "wouter";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, CalendarDays, Users, UserRound, FileBarChart,
  Wallet, FileText, LogOut, X, CheckCircle2, ClipboardList,
} from "lucide-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

const adminItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/confirmacoes", label: "Confirmações", icon: CheckCircle2 },
  { href: "/patients", label: "Pacientes", icon: Users },
  { href: "/therapists", label: "Fisioterapeutas", icon: UserRound },
  { href: "/financial", label: "Financeiro", icon: Wallet },
  { href: "/reports", label: "Relatórios", icon: FileBarChart },
  { href: "/relatorio", label: "Rel. Fisioterapêutico", icon: FileText },
  { href: "/atestados", label: "Atestados / Declarações", icon: ClipboardList },
];

const fisioterapeutaItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/patients", label: "Pacientes", icon: Users },
  { href: "/reports", label: "Relatórios", icon: FileBarChart },
  { href: "/relatorio", label: "Rel. Fisioterapêutico", icon: FileText },
  { href: "/atestados", label: "Atestados / Declarações", icon: ClipboardList },
];

const financeiroItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/financial", label: "Financeiro", icon: Wallet },
  { href: "/patients", label: "Pacientes", icon: Users },
  { href: "/reports", label: "Relatórios", icon: FileBarChart },
];

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  fisioterapeuta: "Fisioterapeuta",
  financeiro: "Financeiro",
};

export function Sidebar({ isMobileOpen, setMobileOpen }: { isMobileOpen: boolean; setMobileOpen: (v: boolean) => void }) {
  const [location] = useLocation();
  const { data: user } = useGetMe();
  const logout = useLogout();
  const [, setLoc] = useLocation();

  const role = (user as any)?.role || "admin";
  const navItems = role === "fisioterapeuta" ? fisioterapeutaItems : role === "financeiro" ? financeiroItems : adminItems;

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => setLoc("/login") });
  };

  const SidebarContent = (
    <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      <div className="p-5 flex items-center justify-between">
        <h2 className="text-xl font-bold text-sidebar-primary flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center text-primary-foreground">
            <span className="font-bold text-lg leading-none">V</span>
          </div>
          VitalFisio
        </h2>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(false)}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}>
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-sidebar-border mt-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center font-bold text-sidebar-foreground shrink-0">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || "Usuário"}</p>
              <p className="text-xs text-muted-foreground truncate">{roleLabels[role] || role}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive shrink-0">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:flex w-64 h-screen fixed top-0 left-0 z-40">
        {SidebarContent}
      </div>

      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className={cn(
        "fixed top-0 left-0 h-screen w-64 z-50 md:hidden transition-transform duration-300 ease-in-out transform",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {SidebarContent}
      </div>
    </>
  );
}
