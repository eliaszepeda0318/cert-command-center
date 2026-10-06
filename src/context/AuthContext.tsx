import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';

interface AuthCtx { user: User | null; loading: boolean; error: string | null; signIn: () => Promise<void>; signOut: () => Promise<void> }
const Ctx = createContext<AuthCtx | null>(null);

async function ensureProfile(u: User) {
  const ref = doc(db, 'users', u.uid);
  if ((await getDoc(ref)).exists()) return;
  await setDoc(ref, {
    displayName: u.displayName, email: u.email, photoURL: u.photoURL,
    settings: { weeklyGoalMinutes: 300, activeCertificationId: 'ccna-200-301' },
    stats: { xp: 0, totalStudyMinutes: 0, ankiSessions: 0 },
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => onAuthStateChanged(auth, async (u) => {
    try { if (u) await ensureProfile(u); setUser(u); } catch (e) { setError((e as Error).message); setUser(u); }
    setLoading(false);
  }), []);
  const signIn = async () => { setError(null); try { await signInWithPopup(auth, googleProvider); } catch (e) { setError((e as Error).message); } };
  return <Ctx.Provider value={{ user, loading, error, signIn, signOut: () => fbSignOut(auth) }}>{children}</Ctx.Provider>;
}
export const useAuth = () => { const c = useContext(Ctx); if (!c) throw new Error('useAuth outside AuthProvider'); return c; };
