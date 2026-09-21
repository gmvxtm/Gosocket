import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, setAccessToken, type Credentials, type Session } from '../api';
import { localStore } from '../local';

interface SessionValue {
  session: Session | null;
  signIn: (credentials: Credentials) => Promise<Session>;
  signOut: (reason?: string) => void;
  reason: string;
}

const SessionContext = createContext<SessionValue | null>(null);

const storageKey = 'offline-requests.session';

/** The token identifies the caller and the username owns whatever is stored in this browser. */
function adopt(session: Session | null) {
  setAccessToken(session?.token ?? '');
  localStore.setOwner(session?.username ?? '');
}

/** A stored session is only useful while the token is still valid. */
function readStoredSession(): Session | null {
  try {
    const stored: Session | null = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
    if (!stored?.token || Date.parse(stored.expiresAt) <= Date.now()) return null;
    return stored;
  } catch {
    return null;
  }
}

function writeStoredSession(session: Session | null) {
  try {
    if (session) window.localStorage.setItem(storageKey, JSON.stringify(session));
    else window.localStorage.removeItem(storageKey);
  } catch {
    // Without storage the session simply lasts as long as the tab.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [session, setSession] = useState<Session | null>(() => {
    const stored = readStoredSession();
    adopt(stored);
    return stored;
  });
  const [reason, setReason] = useState('');

  const signIn = useCallback(async (credentials: Credentials) => {
    const issued = await authApi.login(credentials);
    adopt(issued);
    writeStoredSession(issued);
    setSession(issued);
    setReason('');
    return issued;
  }, []);

  const signOut = useCallback((why = '') => {
    adopt(null);
    writeStoredSession(null);
    setSession(null);
    setReason(why);
    // Cached data belongs to the account that was signed in.
    client.clear();
  }, [client]);

  const value = useMemo(() => ({ session, signIn, signOut, reason }), [session, signIn, signOut, reason]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside a SessionProvider');
  return value;
}
