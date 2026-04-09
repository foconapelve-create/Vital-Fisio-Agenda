import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface AppSettings {
  systemName: string;
  logoUrl: string | null;
  nomeClinica: string | null;
  telefone: string | null;
  email: string | null;
}

const defaults: AppSettings = {
  systemName: "CliniSmart",
  logoUrl: null,
  nomeClinica: null,
  telefone: null,
  email: null,
};

const AppSettingsContext = createContext<AppSettings>(defaults);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaults);

  useEffect(() => {
    apiFetch("/api/settings/public")
      .then((data: any) => setSettings({ ...defaults, ...data }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.title = settings.systemName;
  }, [settings.systemName]);

  return (
    <AppSettingsContext.Provider value={settings}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}

export function useAppName() {
  return useContext(AppSettingsContext).systemName;
}
