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

  const userRole = (user as any).role || "admin";
  if (roles && !roles.includes(userRole)) {
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
