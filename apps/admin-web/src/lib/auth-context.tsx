import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import apiClient from "./api-client";

type AuthContextValue = {
  permissions: Set<string>;
  modules: Set<string>;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  permissions: new Set(),
  modules: new Set(),
  loading: false,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [modules, setModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const userId = localStorage.getItem("auth_user_id");
    if (!userId) return;

    setLoading(true);
    try {
      const res = await apiClient.get<{ permissions: string[]; modules: string[] }>(
        `/admin/users/${userId}/resolve-permissions`,
      );
      setPermissions(new Set(res.data.permissions ?? []));
      setModules(new Set(res.data.modules ?? []));
    } catch {
      // silently fail — user may not have permission to read their own perms yet
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

  return (
    <AuthContext.Provider value={{ permissions, modules, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
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
