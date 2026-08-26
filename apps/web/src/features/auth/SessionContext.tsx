import { anonymousSession, type Session, type SessionUser } from "@canmedseg/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { acceptConsent as postConsent, fetchSession, logout as postLogout } from "./authApi";

type SessionState = {
  session: Session;
  loading: boolean;
  /** La API no responde: la app queda usable como visitante. */
  offline: boolean;
  user: SessionUser | null;
  refresh: () => Promise<void>;
  acceptConsent: () => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(() => anonymousSession());
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setSession(await fetchSession());
      setOffline(false);
    } catch (error) {
      console.error("No se pudo obtener la sesión", error);
      setSession(anonymousSession());
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const acceptConsent = useCallback(async () => {
    setSession(await postConsent());
  }, []);

  const logout = useCallback(async () => {
    setSession(await postLogout());
  }, []);

  const value = useMemo<SessionState>(() => {
    const user = session.authenticated ? session.user : null;
    return {
      session,
      loading,
      offline,
      user,
      refresh,
      acceptConsent,
      logout,
    };
  }, [session, loading, offline, refresh, acceptConsent, logout]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  }
  return context;
}
