import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  accessTokenStore,
  AUTH_EXPIRED_EVENT,
  clearLegacyTokenStorage,
  restoreAccessToken,
} from "../api/client";
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
    let active = true;
    clearLegacyTokenStorage();

    const restoreSession = async () => {
      try {
        const restored = await restoreAccessToken();
        if (!restored) return;
        const currentUser = await authApi.me();
        if (active) setUser(currentUser);
      } catch {
        accessTokenStore.clear();
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void restoreSession();
    return () => {
      active = false;
    };
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
        const session = await authApi.login({ username, password });
        accessTokenStore.set(session.access);
        try {
          setUser(await authApi.me());
        } catch (error) {
          accessTokenStore.clear();
          void authApi.logout().catch(() => undefined);
          throw error;
        }
      },
      updateProfile: async (profile) => {
        const updated = await profileApi.update(profile);
        setUser(updated);
        return updated;
      },
      logout: () => {
        accessTokenStore.clear();
        setUser(null);
        void authApi.logout().catch(() => undefined);
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
