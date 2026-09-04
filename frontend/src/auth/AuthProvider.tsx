import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { AUTH_EXPIRED_EVENT, tokenStore } from "../api/client";
import { authApi } from "../api/endpoints";
import { profileApi, type EditableProfile } from "../api/profile";
import type { User } from "../api/types";

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  updateProfile: (profile: EditableProfile) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.getAccess()) {
      setIsLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () =>
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login: async (username, password) => {
        const tokens = await authApi.login({ username, password });
        tokenStore.set(tokens.access, tokens.refresh);
        setUser(await authApi.me());
      },
      updateProfile: async (profile) => {
        const updated = await profileApi.update(profile);
        setUser(updated);
        return updated;
      },
      logout: () => {
        tokenStore.clear();
        setUser(null);
      },
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
