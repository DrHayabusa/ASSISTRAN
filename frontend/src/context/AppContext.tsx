import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { HistoryItem } from '../types';
import { historyStore } from '../lib/storage';
import { authApi, clearToken, getToken, setToken, type PublicUser } from '../lib/api';

interface SignupInput {
  name: string;
  username: string;
  password: string;
}
type Result = { ok: boolean; error?: string };

interface AppContextValue {
  user: PublicUser | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<Result>;
  signup: (input: SignupInput) => Promise<Result>;
  logout: () => void;
  deleteAccount: () => Promise<void>;
  setPreferredLanguage: (langId: string) => void;
  updateProfile: (patch: { name?: string; username?: string }) => Promise<Result>;
  changePassword: (current: string, next: string) => Promise<Result>;
  logActivity: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);

  // Restore the session from a stored JWT.
  useEffect(() => {
    let active = true;
    (async () => {
      if (getToken()) {
        try {
          const { user } = await authApi.me();
          if (active) setUser(user);
        } catch {
          clearToken(); // expired/invalid
        }
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<Result> => {
    try {
      const { token, user } = await authApi.login({ username, password });
      setToken(token);
      setUser(user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMsg(e, 'Login failed.') };
    }
  }, []);

  const signup = useCallback(async ({ name, username, password }: SignupInput): Promise<Result> => {
    try {
      const { token, user } = await authApi.signup({ name, username, password });
      setToken(token);
      setUser(user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMsg(e, 'Could not create account.') };
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    try {
      await authApi.deleteAccount();
    } catch {
      /* best effort */
    }
    clearToken();
    setUser(null);
  }, []);

  // Optimistic local update + persist to the server.
  const setPreferredLanguage = useCallback((langId: string) => {
    setUser((u) => (u ? { ...u, preferredLanguage: langId } : u));
    authApi.updateProfile({ preferredLanguage: langId }).catch(() => undefined);
  }, []);

  const updateProfile = useCallback(async (patch: { name?: string; username?: string }): Promise<Result> => {
    try {
      const { user } = await authApi.updateProfile(patch);
      setUser(user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMsg(e, 'Update failed.') };
    }
  }, []);

  const changePassword = useCallback(async (current: string, next: string): Promise<Result> => {
    try {
      await authApi.changePassword({ current, next });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMsg(e, 'Could not change password.') };
    }
  }, []);

  const logActivity = useCallback(
    (item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
      if (user) historyStore.add(user.id, item);
    },
    [user],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      ready,
      login,
      signup,
      logout,
      deleteAccount,
      setPreferredLanguage,
      updateProfile,
      changePassword,
      logActivity,
    }),
    [user, ready, login, signup, logout, deleteAccount, setPreferredLanguage, updateProfile, changePassword, logActivity],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}
