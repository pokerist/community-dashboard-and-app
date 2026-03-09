import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import apiClient from "./api-client";

type AuthContextValue = {
  permissions: Set<string>;
  modules: Set<string>;
  personas: Set<string>;
  visibleScreens: Set<string>;
  screenCapabilities: Map<
    string,
    {
      section: string;
      requiredPermissions: string[];
      missingPermissions: string[];
      allowed: boolean;
    }
  >;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  permissions: new Set(),
  modules: new Set(),
  personas: new Set(),
  visibleScreens: new Set(),
  screenCapabilities: new Map(),
  loading: false,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [modules, setModules] = useState<Set<string>>(new Set());
  const [personas, setPersonas] = useState<Set<string>>(new Set());
  const [visibleScreens, setVisibleScreens] = useState<Set<string>>(new Set());
  const [screenCapabilities, setScreenCapabilities] = useState<
    Map<
      string,
      {
        section: string;
        requiredPermissions: string[];
        missingPermissions: string[];
        allowed: boolean;
      }
    >
  >(new Map());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    setLoading(true);
    try {
      const res = await apiClient.get<{
        effectivePermissions?: string[];
        effectiveModules?: string[];
        effectivePersonas?: string[];
        visibleScreens?: string[];
        screenCapabilities?: Array<{
          section?: string;
          requiredPermissions?: string[];
          missingPermissions?: string[];
          allowed?: boolean;
        }>;
      }>(
        "/auth/me/access?surface=ADMIN_WEB",
      );
      setPermissions(new Set(res.data.effectivePermissions ?? []));
      setModules(new Set(res.data.effectiveModules ?? []));
      setPersonas(new Set(res.data.effectivePersonas ?? []));
      setVisibleScreens(new Set(res.data.visibleScreens ?? []));
      const capabilities = new Map<
        string,
        {
          section: string;
          requiredPermissions: string[];
          missingPermissions: string[];
          allowed: boolean;
        }
      >();
      for (const item of res.data.screenCapabilities ?? []) {
        const section = String(item?.section ?? "").trim().toLowerCase();
        if (!section) continue;
        capabilities.set(section, {
          section,
          requiredPermissions: Array.isArray(item?.requiredPermissions)
            ? item.requiredPermissions.map((entry) => String(entry))
            : [],
          missingPermissions: Array.isArray(item?.missingPermissions)
            ? item.missingPermissions.map((entry) => String(entry))
            : [],
          allowed: Boolean(item?.allowed),
        });
      }
      setScreenCapabilities(capabilities);
    } catch {
      // silently fail — user may not have permission to read their own perms yet
      setPermissions(new Set());
      setModules(new Set());
      setPersonas(new Set());
      setVisibleScreens(new Set());
      setScreenCapabilities(new Map());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      void refresh();
    }
  }, [refresh]);

  // Listen for login events
  useEffect(() => {
    const handler = () => void refresh();
    window.addEventListener("auth:login", handler);
    return () => window.removeEventListener("auth:login", handler);
  }, [refresh]);

  return <AuthContext.Provider value={{ permissions, modules, personas, visibleScreens, screenCapabilities, loading, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}

/**
 * Check if the current user has a specific permission key.
 * This is a UI convenience — real enforcement is always on the backend.
 */
export function usePermission(key: string): boolean {
  const { permissions } = useContext(AuthContext);
  return permissions.has(key);
}

/**
 * Check if the current user has access to a specific module.
 * This is a UI convenience — real enforcement is always on the backend.
 */
export function useModule(moduleKey: string): boolean {
  const { modules } = useContext(AuthContext);
  return modules.has(moduleKey);
}

/**
 * Check if a dashboard screen/section should be visible for current user.
 * Real enforcement still happens on backend permissions.
 */
export function useScreenVisible(screenKey: string): boolean {
  const { visibleScreens } = useContext(AuthContext);
  return visibleScreens.has(screenKey);
}
