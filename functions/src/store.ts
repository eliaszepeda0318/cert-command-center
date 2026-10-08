import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { AccessConfig, Entitlement, PaymentRecord, Reservation, Store, Tx } from './core';

/** Fields stored as Firestore Timestamps (domain code uses epoch milliseconds). */
const TS_FIELDS = new Set(['accessStartedAt', 'accessExpiresAt', 'updatedAt', 'createdAt', 'expiresAt', 'paidAt', 'processedAt']);

/** The Timestamp class of whichever firebase-admin copy owns `db` (scripts and functions each have their own copy). */
export interface TimestampClass { fromMillis(ms: number): unknown }
const isTs = (v: unknown): v is { toMillis(): number } => typeof (v as { toMillis?: unknown })?.toMillis === 'function';
const decode = <T>(o: Record<string, unknown>): T =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, TS_FIELDS.has(k) && isTs(v) ? v.toMillis() : v])) as T;

export const PATHS = { config: 'appConfig/access', entitlements: 'entitlements', reservations: 'seatReservations', payments: 'stripePayments' } as const;

/**
 * Firestore-backed Store. Each `run` is ONE Firestore transaction: reads happen first, writes are buffered and applied at
 * the end, and Firestore retries the whole function if another transaction touched the same documents. That is what makes the
 * seat cap hold under simultaneous purchases. Admin SDK only; security rules do not apply (and deny all client writes).
 */
export function firestoreStore(db: Firestore, Timestamp: TimestampClass): Store {
  const encode = (o: object): Record<string, unknown> =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, TS_FIELDS.has(k) && typeof v === 'number' ? Timestamp.fromMillis(v) : v]));
  return {
    run: (fn) => db.runTransaction(async (t: Transaction) => {
      const writes: Array<() => void> = [];
      const tx: Tx = {
        config: async () => { const s = await t.get(db.doc(PATHS.config)); return s.exists ? decode<AccessConfig>(s.data()!) : undefined; },
        setConfig: (c) => { writes.push(() => t.set(db.doc(PATHS.config), c)); },
        entitlement: async (uid) => { const s = await t.get(db.doc(`${PATHS.entitlements}/${uid}`)); return s.exists ? decode<Entitlement>(s.data()!) : undefined; },
        setEntitlement: (uid, e) => { writes.push(() => t.set(db.doc(`${PATHS.entitlements}/${uid}`), encode(e))); },
        reservations: async () => (await t.get(db.collection(PATHS.reservations))).docs.map((d) => decode<Reservation>(d.data())),
        setReservation: (r) => { writes.push(() => t.set(db.doc(`${PATHS.reservations}/${r.uid}`), encode(r))); },
        deleteReservation: (uid) => { writes.push(() => t.delete(db.doc(`${PATHS.reservations}/${uid}`))); },
        payment: async (id) => { const s = await t.get(db.doc(`${PATHS.payments}/${id}`)); return s.exists ? decode<PaymentRecord>(s.data()!) : undefined; },
        setPayment: (p) => { writes.push(() => t.set(db.doc(`${PATHS.payments}/${p.sessionId}`), encode(p))); },
      };
      const out = await fn(tx);
      writes.forEach((w) => w()); // all reads are done; now apply writes
      return out;
    }),
  };
}
