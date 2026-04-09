import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe } from "@workspace/api-client-react";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Patients from "@/pages/patients";
import PatientHistory from "@/pages/patient-history";
import Therapists from "@/pages/therapists";
import Agenda from "@/pages/agenda";
import Reports from "@/pages/reports";
import Financial from "@/pages/financial";
import Relatorio from "@/pages/relatorio";
import Confirmacoes from "@/pages/confirmacoes";
import Atestados from "@/pages/atestados";
import Aniversariantes from "@/pages/aniversariantes";
import Planner from "@/pages/planner";
import Fiscal from "@/pages/fiscal";
import UsersPage from "@/pages/users";
import ResetPassword from "@/pages/reset-password";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType; roles?: string[] }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, error } = useGetMe({ query: { retry: false } });

  useEffect(() => {
    if (!isLoading && !user && error) setLocation("/login");
  }, [user, isLoading, error, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const rawRole = (user as any).role || "admin";
  // 'profissional' has the same permissions as 'fisioterapeuta'
  const userRole = rawRole === "profissional" ? "fisioterapeuta" : rawRole;
  if (roles && !roles.includes(userRole) && !roles.includes(rawRole)) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-lg font-semibold">Acesso não permitido</p>
          <p className="text-muted-foreground mt-1">Você não tem permissão para acessar esta página.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/patients">
        <ProtectedRoute component={Patients} roles={["admin", "fisioterapeuta"]} />
      </Route>
      <Route path="/patients/:id/history">
        <ProtectedRoute component={PatientHistory} roles={["admin", "fisioterapeuta"]} />
      </Route>
      <Route path="/therapists">
        <ProtectedRoute component={Therapists} roles={["admin"]} />
      </Route>
      <Route path="/agenda">
        <ProtectedRoute component={Agenda} roles={["admin", "fisioterapeuta"]} />
      </Route>
      <Route path="/reports">
        <ProtectedRoute component={Reports} />
      </Route>
      <Route path="/financial">
        <ProtectedRoute component={Financial} roles={["admin", "financeiro"]} />
      </Route>
      <Route path="/relatorio">
        <ProtectedRoute component={Relatorio} roles={["admin", "fisioterapeuta"]} />
      </Route>
      <Route path="/confirmacoes">
        <ProtectedRoute component={Confirmacoes} roles={["admin", "fisioterapeuta"]} />
      </Route>
      <Route path="/atestados">
        <ProtectedRoute component={Atestados} roles={["admin", "fisioterapeuta"]} />
      </Route>
      <Route path="/aniversariantes">
        <ProtectedRoute component={Aniversariantes} roles={["admin", "fisioterapeuta", "financeiro"]} />
      </Route>
      <Route path="/planner">
        <ProtectedRoute component={Planner} roles={["admin", "fisioterapeuta"]} />
      </Route>
      <Route path="/fiscal">
        <ProtectedRoute component={Fiscal} roles={["admin", "financeiro"]} />
      </Route>
      <Route path="/users">
        <ProtectedRoute component={UsersPage} roles={["admin"]} />
      </Route>
      <Route path="/reset-password/:token" component={ResetPassword} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
