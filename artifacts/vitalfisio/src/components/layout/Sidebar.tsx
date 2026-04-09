import { useLocation } from "wouter";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, CalendarDays, Users, UserRound, FileBarChart,
  Wallet, FileText, LogOut, X, CheckCircle2, ClipboardList, Cake, LayoutGrid, Receipt, UserCog,
} from "lucide-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/contexts/AppSettingsContext";

const adminItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/confirmacoes", label: "Confirmações", icon: CheckCircle2 },
  { href: "/aniversariantes", label: "Aniversariantes", icon: Cake },
  { href: "/patients", label: "Pacientes", icon: Users },
  { href: "/therapists", label: "Profissionais", icon: UserRound },
  { href: "/financial", label: "Financeiro", icon: Wallet },
  { href: "/fiscal", label: "Nota Fiscal (NFSe)", icon: Receipt },
  { href: "/reports", label: "Relatórios", icon: FileBarChart },
  { href: "/relatorio", label: "Relatório Clínico", icon: FileText },
  { href: "/atestados", label: "Documentos Clínicos", icon: ClipboardList },
  { href: "/planner", label: "Planner de Conteúdo", icon: LayoutGrid },
  { href: "/users", label: "Usuários", icon: UserCog },
];

const profissionalItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/aniversariantes", label: "Aniversariantes", icon: Cake },
  { href: "/patients", label: "Pacientes", icon: Users },
  { href: "/reports", label: "Relatórios", icon: FileBarChart },
  { href: "/relatorio", label: "Relatório Clínico", icon: FileText },
  { href: "/atestados", label: "Documentos Clínicos", icon: ClipboardList },
  { href: "/planner", label: "Planner de Conteúdo", icon: LayoutGrid },
];

const financeiroItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/aniversariantes", label: "Aniversariantes", icon: Cake },
  { href: "/financial", label: "Financeiro", icon: Wallet },
  { href: "/fiscal", label: "Nota Fiscal (NFSe)", icon: Receipt },
  { href: "/patients", label: "Pacientes", icon: Users },
  { href: "/reports", label: "Relatórios", icon: FileBarChart },
];

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  profissional: "Profissional da Saúde",
  fisioterapeuta: "Profissional da Saúde",
  financeiro: "Financeiro",
};

function getNavItems(role: string) {
  if (role === "fisioterapeuta" || role === "profissional") return profissionalItems;
  if (role === "financeiro") return financeiroItems;
  return adminItems;
}

export function Sidebar({ isMobileOpen, setMobileOpen }: { isMobileOpen: boolean; setMobileOpen: (v: boolean) => void }) {
  const [location] = useLocation();
  const { data: user } = useGetMe();
  const logout = useLogout();
  const [, setLoc] = useLocation();
  const { systemName, logoUrl } = useAppSettings();

  const role = (user as any)?.role || "admin";
  const navItems = getNavItems(role);
  const initial = systemName.charAt(0).toUpperCase();

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => setLoc("/login") });
  };

  const SidebarContent = (
    <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      <div className="p-5 flex items-center justify-between">
        <h2 className="text-xl font-bold text-sidebar-primary flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={systemName} className="w-8 h-8 rounded-lg object-contain bg-white" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center text-primary-foreground">
              <span className="font-bold text-lg leading-none">{initial}</span>
            </div>
          )}
          {systemName}
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

      <div className="p-3 border-t border-sidebar-border">
        <div className="px-3 py-2 mb-1">
          <p className="text-sm font-medium text-sidebar-foreground">{(user as any)?.name || "Usuário"}</p>
          <p className="text-xs text-sidebar-foreground/60">{roleLabels[role] || role}</p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sidebar-foreground hover:text-red-600 hover:bg-red-50"
          onClick={handleLogout}
          disabled={logout.isPending}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        {SidebarContent}
      </div>
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="relative flex w-64 flex-col">
            {SidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
