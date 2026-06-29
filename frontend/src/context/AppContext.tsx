import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { HistoryItem, User } from '../types';
import { historyStore, purgeUserData, sessionStore, usersStore } from '../lib/storage';
import { uid } from '../lib/utils';

interface SignupInput {
  name: string;
  username: string;
  password: string;
}

interface AppContextValue {
  user: User | null;
  ready: boolean;
  login: (username: string, password: string) => { ok: boolean; error?: string };
  signup: (input: SignupInput) => { ok: boolean; error?: string };
  logout: () => void;
  deleteAccount: () => void;
  setPreferredLanguage: (langId: string) => void;
  updateProfile: (patch: Partial<Pick<User, 'name' | 'username'>>) => { ok: boolean; error?: string };
  changePassword: (current: string, next: string) => { ok: boolean; error?: string };
  logActivity: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Restore the session on first load.
  useEffect(() => {
    const id = sessionStore.get();
    if (id) {
      const found = usersStore.all().find((u) => u.id === id);
      if (found) setUser(found);
    }
    setReady(true);
  }, []);

  const login = useCallback((username: string, password: string) => {
    const found = usersStore.findByUsername(username.trim());
    if (!found) return { ok: false, error: 'No account found with that username.' };
    if (found.password !== password) return { ok: false, error: 'Incorrect password.' };
    sessionStore.set(found.id);
    setUser(found);
    return { ok: true };
  }, []);

  const signup = useCallback(({ name, username, password }: SignupInput) => {
    const cleanName = name.trim();
    const cleanUser = username.trim();
    if (!cleanName || !cleanUser || !password) return { ok: false, error: 'All fields are required.' };
    if (usersStore.findByUsername(cleanUser)) {
      return { ok: false, error: 'That username is already taken.' };
    }
    const newUser: User = {
      id: uid('u_'),
      name: cleanName,
      username: cleanUser,
      password,
      preferredLanguage: '', // chosen on the next screen
      createdAt: Date.now(),
    };
    usersStore.add(newUser);
    sessionStore.set(newUser.id);
    setUser(newUser);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    sessionStore.clear();
    setUser(null);
  }, []);

  const deleteAccount = useCallback(() => {
    if (!user) return;
    purgeUserData(user.id);
    usersStore.remove(user.id);
    sessionStore.clear();
    setUser(null);
  }, [user]);

  // Persist a partial change to the current user.
  const persist = useCallback((next: User) => {
    usersStore.update(next);
    setUser(next);
  }, []);

  const setPreferredLanguage = useCallback(
    (langId: string) => {
      if (!user) return;
      persist({ ...user, preferredLanguage: langId });
    },
    [user, persist],
  );

  const updateProfile = useCallback(
    (patch: Partial<Pick<User, 'name' | 'username'>>) => {
      if (!user) return { ok: false, error: 'Not signed in.' };
      const nextUsername = patch.username?.trim();
      if (nextUsername && nextUsername.toLowerCase() !== user.username.toLowerCase()) {
        if (usersStore.findByUsername(nextUsername)) {
          return { ok: false, error: 'That username is already taken.' };
        }
      }
      persist({
        ...user,
        name: patch.name?.trim() || user.name,
        username: nextUsername || user.username,
      });
      return { ok: true };
    },
    [user, persist],
  );

  const changePassword = useCallback(
    (current: string, next: string) => {
      if (!user) return { ok: false, error: 'Not signed in.' };
      if (user.password !== current) return { ok: false, error: 'Current password is incorrect.' };
      if (next.length < 4) return { ok: false, error: 'New password must be at least 4 characters.' };
      persist({ ...user, password: next });
      return { ok: true };
    },
    [user, persist],
  );

  const logActivity = useCallback(
    (item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
      if (!user) return;
      historyStore.add(user.id, item);
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

/** Access the app/auth context. */
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}
