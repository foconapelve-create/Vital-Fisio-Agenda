import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  UserRound,
  FileBarChart,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/patients", label: "Pacientes", icon: Users },
  { href: "/therapists", label: "Fisioterapeutas", icon: UserRound },
  { href: "/reports", label: "Relatórios", icon: FileBarChart },
];

export function Sidebar({ isMobileOpen, setMobileOpen }: { isMobileOpen: boolean; setMobileOpen: (v: boolean) => void }) {
  const [location] = useLocation();
  const { data: user } = useGetMe();
  const logout = useLogout();
  const [loc, setLoc] = useLocation();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setLoc("/login");
      }
    });
  };

  const SidebarContent = (
    <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      <div className="p-6 flex items-center justify-between">
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

      <div className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-sidebar-border mt-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center font-bold text-sidebar-foreground">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || 'Usuário'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.role || 'Admin'}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex w-64 h-screen fixed top-0 left-0 z-40">
        {SidebarContent}
      </div>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div 
        className={cn(
          "fixed top-0 left-0 h-screen w-64 z-50 md:hidden transition-transform duration-300 ease-in-out transform",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {SidebarContent}
      </div>
    </>
  );
}
