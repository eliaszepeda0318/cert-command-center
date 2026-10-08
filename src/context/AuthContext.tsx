import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface AuthCtx { user: User | null; loading: boolean; error: string | null; signIn: () => Promise<void>; signOut: () => Promise<void> }
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u); setLoading(false); // no Firestore work here: signed-out visitors and unpaid users cost no database reads or writes
  }), []);
  const signIn = async () => { setError(null); try { await signInWithPopup(auth, googleProvider); } catch (e) { setError((e as Error).message); } };
  return <Ctx.Provider value={{ user, loading, error, signIn, signOut: () => fbSignOut(auth) }}>{children}</Ctx.Provider>;
}
export const useAuth = () => { const c = useContext(Ctx); if (!c) throw new Error('useAuth outside AuthProvider'); return c; };
