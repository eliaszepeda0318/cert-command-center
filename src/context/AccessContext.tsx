import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import type { AccessConfig, Entitlement } from '../types';

const DAY = 86_400_000;
/** Mirrors the server: you cannot stack more than one extra year onto what you already have. */
const MAX_BANKED_DAYS = 365;

export type AccessState = 'loading' | 'active' | 'comped' | 'admin' | 'expired' | 'none';
interface AccessCtx {
  state: AccessState; /** true when the app may load paid data (the server rules decide for real) */ hasAccess: boolean;
  entitlement: Entitlement | null; config: AccessConfig | null; expiresAt: Date | null; daysRemaining: number | null;
  /** true when this user can start a checkout right now (the server re-checks everything) */ canPurchase: boolean;
  soldOut: boolean; isRenewal: boolean; seatsLeft: number | null; error: string | null;
}
const Ctx = createContext<AccessCtx | null>(null);

/** Reads exactly two small documents: the user's own entitlement and appConfig/access. Nothing else loads for unpaid users. */
export function AccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user!.uid;
  const [ent, setEnt] = useState<Entitlement | null | undefined>(undefined);
  const [config, setConfig] = useState<AccessConfig | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const u1 = onSnapshot(doc(db, 'entitlements', uid), (s) => setEnt(s.exists() ? (s.data() as Entitlement) : null), (e) => { setError(e.message); setEnt(null); });
    const u2 = onSnapshot(doc(db, 'appConfig', 'access'), (s) => setConfig(s.exists() ? (s.data() as AccessConfig) : null), () => setConfig(null));
    return () => { u1(); u2(); };
  }, [uid]);

  // Re-evaluate at the moment access lapses (capped at 24h so long timers stay reliable).
  const expiresMs = ent?.accessExpiresAt?.toMillis() ?? null;
  useEffect(() => {
    if (expiresMs == null || expiresMs <= Date.now()) return;
    const t = setTimeout(() => setNow(Date.now()), Math.min(expiresMs - Date.now() + 500, DAY));
    return () => clearTimeout(t);
  }, [expiresMs, now]);

  const value = useMemo<AccessCtx>(() => {
    const loading = ent === undefined || config === undefined;
    const live = !!ent && (ent.status === 'admin' || ((ent.status === 'active' || ent.status === 'comped') && expiresMs != null && expiresMs > now));
    const state: AccessState = loading ? 'loading' : live ? (ent!.status as 'active' | 'comped' | 'admin') : ent ? 'expired' : 'none';
    const daysRemaining = expiresMs != null ? Math.max(0, Math.ceil((expiresMs - now) / DAY)) : null;
    const isRenewal = !!ent?.seatHeld;
    const open = !!config?.salesOpen;
    const hasSeat = isRenewal || (!!config && config.currentPaidUsers < config.maxPaidUsers);
    const blocked = state === 'admin' || state === 'comped' || (state === 'active' && (daysRemaining ?? 0) > MAX_BANKED_DAYS);
    return {
      state, hasAccess: live, entitlement: ent ?? null, config: config ?? null, expiresAt: expiresMs != null ? new Date(expiresMs) : null, daysRemaining,
      canPurchase: !loading && open && hasSeat && !blocked, soldOut: !loading && (!open || !hasSeat), isRenewal,
      seatsLeft: config ? Math.max(0, config.maxPaidUsers - config.currentPaidUsers) : null, error,
    };
  }, [ent, config, expiresMs, now, error]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAccess = () => { const c = useContext(Ctx); if (!c) throw new Error('useAccess outside AccessProvider'); return c; };
