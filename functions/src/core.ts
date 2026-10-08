/**
 * Paid-access domain logic. No Firebase/Stripe imports: everything goes through the small `Store`
 * interface so the same code runs against Firestore in production and an in-memory store in tests.
 *
 * Data (all written ONLY by this code, via the Admin SDK; client rules deny every write):
 *   appConfig/access            { salesOpen, maxPaidUsers, currentPaidUsers, foundingPriceCents }
 *   entitlements/{uid}          { status, accessStartedAt, accessExpiresAt, stripeCustomerId,
 *                                 lastCheckoutSessionId, lastPaymentIntentId, updatedAt, seatHeld, email }
 *   seatReservations/{uid}      short-lived hold taken when checkout starts for a NEW buyer
 *   stripePayments/{sessionId}  idempotency record: one per processed Checkout Session
 *
 * All times are epoch milliseconds in this module; the Firestore adapter converts to Timestamps.
 */

export const DAY_MS = 86_400_000;
/** Access granted by one payment. Exactly 365 days (not a calendar year). */
export const ACCESS_MS = 365 * DAY_MS;
/** Stripe requires Checkout Sessions to live at least 30 minutes. */
export const SESSION_TTL_S = 31 * 60;
/** Seat reservation outlives the Checkout Session slightly, to cover clock skew and webhook latency. */
export const RESERVATION_GRACE_S = 5 * 60;
/** A buyer may not stack more than one extra year on top of what they already have. */
export const MAX_BANKED_MS = ACCESS_MS;

export type EntitlementStatus = 'active' | 'expired' | 'comped' | 'admin';

export interface AccessConfig { salesOpen: boolean; maxPaidUsers: number; currentPaidUsers: number; foundingPriceCents: number }

export interface Entitlement {
  status: EntitlementStatus;
  accessStartedAt: number | null;
  /** null only for `admin`, which never expires. */
  accessExpiresAt: number | null;
  stripeCustomerId: string | null;
  lastCheckoutSessionId: string | null;
  lastPaymentIntentId: string | null;
  updatedAt: number;
  /** True while this account occupies one of the paid seats. Comped/admin accounts never hold a seat. */
  seatHeld: boolean;
  email: string | null;
}

export interface Reservation { uid: string; sessionId: string | null; createdAt: number; expiresAt: number }
export interface PaymentRecord {
  sessionId: string; uid: string; paymentIntentId: string | null; paidAt: number; processedAt: number;
  outcome: 'granted_new' | 'renewed' | 'admin_noop' | 'refund_pending' | 'refunded'; refundId: string | null;
}

export interface Tx {
  config(): Promise<AccessConfig | undefined>;
  setConfig(c: AccessConfig): void;
  entitlement(uid: string): Promise<Entitlement | undefined>;
  setEntitlement(uid: string, e: Entitlement): void;
  reservations(): Promise<Reservation[]>;
  setReservation(r: Reservation): void;
  deleteReservation(uid: string): void;
  payment(sessionId: string): Promise<PaymentRecord | undefined>;
  setPayment(p: PaymentRecord): void;
}
export interface Store { run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> }

export const DEFAULT_CONFIG: AccessConfig = { salesOpen: false, maxPaidUsers: 0, currentPaidUsers: 0, foundingPriceCents: 1000 };

/** Does this entitlement grant access right now? Mirrors `hasAccess()` in firestore.rules. */
export function hasAccessAt(e: Entitlement | undefined, now: number): boolean {
  if (!e) return false;
  if (e.status === 'admin') return true;
  return (e.status === 'active' || e.status === 'comped') && e.accessExpiresAt != null && e.accessExpiresAt > now;
}

/** New expiry for a payment: existing FUTURE expiry + 365 days, otherwise payment time + 365 days. */
export function extendedExpiry(existingExpiresAt: number | null | undefined, paidAt: number): number {
  return Math.max(existingExpiresAt ?? 0, paidAt) + ACCESS_MS;
}

/** A usable owner entitlement: status admin, never expires. Used by the pre-deploy lockout check. */
export const isValidAdminEntitlement = (e: Partial<Entitlement> | undefined): boolean => !!e && e.status === 'admin' && (e.accessExpiresAt ?? null) === null;

const liveReservations = (all: Reservation[], now: number, exceptUid?: string) => all.filter((r) => r.expiresAt > now && r.uid !== exceptUid);

// ---------------------------------------------------------------- checkout (reserve a seat)

export type ReserveResult =
  | { kind: 'sales_closed' } | { kind: 'sold_out' } | { kind: 'already_active'; reason: 'admin' | 'comped' | 'too_much_banked' }
  | { kind: 'ok'; mode: 'new' | 'renewal'; stripeCustomerId: string | null; existingSessionId: string | null; reservation: Reservation | null };

/**
 * Decide whether `uid` may start a Checkout, atomically.
 *  - salesOpen=false blocks EVERY checkout (it is the owner's kill switch).
 *  - A new buyer needs a free seat: currentPaidUsers + other live reservations < maxPaidUsers. A reservation is written in the
 *    same transaction, so simultaneous buyers can never be admitted past the cap.
 *  - A seat holder renewing needs no seat (renewals never change the count).
 */
export async function reserveCheckout(store: Store, p: { uid: string; email: string | null; now: number }): Promise<ReserveResult> {
  return store.run(async (tx) => {
    const cfg = (await tx.config()) ?? DEFAULT_CONFIG;
    const ent = await tx.entitlement(p.uid);
    const all = await tx.reservations();
    for (const r of all) if (r.expiresAt <= p.now) tx.deleteReservation(r.uid); // tidy stale holds

    if (!cfg.salesOpen) return { kind: 'sales_closed' as const };
    if (ent?.status === 'admin') return { kind: 'already_active' as const, reason: 'admin' as const };
    if (ent?.status === 'comped' && hasAccessAt(ent, p.now)) return { kind: 'already_active' as const, reason: 'comped' as const };

    if (ent?.seatHeld) { // renewal
      if (hasAccessAt(ent, p.now) && (ent.accessExpiresAt ?? 0) - p.now > MAX_BANKED_MS) return { kind: 'already_active' as const, reason: 'too_much_banked' as const };
      const mine = all.find((r) => r.uid === p.uid && r.expiresAt > p.now) ?? null;
      return { kind: 'ok' as const, mode: 'renewal' as const, stripeCustomerId: ent.stripeCustomerId, existingSessionId: mine?.sessionId ?? null, reservation: null };
    }

    const mine = all.find((r) => r.uid === p.uid && r.expiresAt > p.now);
    if (mine) return { kind: 'ok' as const, mode: 'new' as const, stripeCustomerId: ent?.stripeCustomerId ?? null, existingSessionId: mine.sessionId, reservation: mine };
    const held = cfg.currentPaidUsers + liveReservations(all, p.now, p.uid).length;
    if (held >= cfg.maxPaidUsers) return { kind: 'sold_out' as const };
    const reservation: Reservation = { uid: p.uid, sessionId: null, createdAt: p.now, expiresAt: p.now + (SESSION_TTL_S + RESERVATION_GRACE_S) * 1000 };
    tx.setReservation(reservation);
    return { kind: 'ok' as const, mode: 'new' as const, stripeCustomerId: ent?.stripeCustomerId ?? null, existingSessionId: null, reservation };
  });
}

/** Remember which Checkout Session belongs to a reservation (so a second click reuses it instead of opening another). */
export async function attachSession(store: Store, uid: string, sessionId: string): Promise<void> {
  await store.run(async (tx) => {
    const r = (await tx.reservations()).find((x) => x.uid === uid);
    if (r) tx.setReservation({ ...r, sessionId });
  });
}
export async function releaseReservation(store: Store, uid: string): Promise<void> {
  await store.run(async (tx) => { tx.deleteReservation(uid); });
}

// ---------------------------------------------------------------- webhook (the only paid grant path)

export interface PaymentInput { sessionId: string; uid: string; paymentIntentId: string | null; customerId: string | null; paidAt: number; email: string | null; now: number }
export type PaymentResult =
  | { kind: 'granted_new' | 'renewed'; expiresAt: number }
  | { kind: 'duplicate'; refundPending: boolean }
  | { kind: 'admin_noop' }
  | { kind: 'refund_needed' };

/**
 * Apply one paid Checkout Session. Idempotent on the session id: the idempotency record is written in the SAME transaction
 * as the entitlement, so a duplicate or replayed Stripe event can never add a second year.
 * New buyer => consume the seat reservation and increment currentPaidUsers. Renewal => count unchanged.
 * If a new buyer paid but no seat is available (e.g. reservation lost and the cap was reached) nothing is granted and the
 * caller must refund; the hard cap is never exceeded.
 */
export async function applyPayment(store: Store, p: PaymentInput): Promise<PaymentResult> {
  return store.run(async (tx) => {
    const seen = await tx.payment(p.sessionId);
    if (seen) return { kind: 'duplicate' as const, refundPending: seen.outcome === 'refund_pending' };
    const cfg = (await tx.config()) ?? DEFAULT_CONFIG;
    const ent = await tx.entitlement(p.uid);
    const all = await tx.reservations();
    const record = (outcome: PaymentRecord['outcome']) => tx.setPayment({ sessionId: p.sessionId, uid: p.uid, paymentIntentId: p.paymentIntentId, paidAt: p.paidAt, processedAt: p.now, outcome, refundId: null });

    if (ent?.status === 'admin') { record('admin_noop'); return { kind: 'admin_noop' as const }; } // the owner is never modified by a payment

    const renewal = !!ent?.seatHeld;
    if (!renewal) {
      const mine = all.find((r) => r.uid === p.uid);
      const hadHold = !!mine && mine.sessionId === p.sessionId;
      const free = cfg.maxPaidUsers - cfg.currentPaidUsers - liveReservations(all, p.now, p.uid).length;
      if (!hadHold && free <= 0) { record('refund_pending'); return { kind: 'refund_needed' as const }; }
      tx.setConfig({ ...cfg, currentPaidUsers: cfg.currentPaidUsers + 1 });
      if (mine) tx.deleteReservation(p.uid);
    }
    const stillActive = hasAccessAt(ent, p.paidAt);
    const expiresAt = extendedExpiry(ent?.accessExpiresAt, p.paidAt);
    tx.setEntitlement(p.uid, {
      status: 'active', accessStartedAt: stillActive ? ent?.accessStartedAt ?? p.paidAt : p.paidAt, accessExpiresAt: expiresAt,
      stripeCustomerId: p.customerId ?? ent?.stripeCustomerId ?? null, lastCheckoutSessionId: p.sessionId, lastPaymentIntentId: p.paymentIntentId,
      updatedAt: p.now, seatHeld: true, email: p.email ?? ent?.email ?? null,
    });
    record(renewal ? 'renewed' : 'granted_new');
    return { kind: renewal ? ('renewed' as const) : ('granted_new' as const), expiresAt };
  });
}

export async function markRefunded(store: Store, sessionId: string, refundId: string): Promise<void> {
  await store.run(async (tx) => {
    const r = await tx.payment(sessionId);
    if (r) tx.setPayment({ ...r, outcome: 'refunded', refundId });
  });
}

// ---------------------------------------------------------------- owner/admin operations (used by scripts/access-admin.ts)

export async function initConfig(store: Store, p: { maxPaidUsers: number }): Promise<AccessConfig> {
  return store.run(async (tx) => {
    const cur = await tx.config();
    if (cur) return cur; // never overwrite an existing config (it holds the live seat count)
    const c = { ...DEFAULT_CONFIG, maxPaidUsers: p.maxPaidUsers };
    tx.setConfig(c); return c;
  });
}
export async function patchConfig(store: Store, patch: Partial<Pick<AccessConfig, 'salesOpen' | 'maxPaidUsers'>>): Promise<AccessConfig> {
  if (patch.maxPaidUsers !== undefined && (!Number.isInteger(patch.maxPaidUsers) || patch.maxPaidUsers < 0)) throw new Error('maxPaidUsers must be a whole number >= 0');
  return store.run(async (tx) => {
    const cur = await tx.config();
    if (!cur) throw new Error('appConfig/access does not exist yet. Run: npm run access -- init --max <n>');
    const next = { ...cur, ...patch }; // currentPaidUsers and foundingPriceCents are never touched here
    tx.setConfig(next); return next;
  });
}
export async function grantAdmin(store: Store, p: { uid: string; email: string | null; now: number }): Promise<void> {
  await store.run(async (tx) => {
    const cur = await tx.entitlement(p.uid);
    const cfg = await tx.config();
    if (cur?.seatHeld && cfg) tx.setConfig({ ...cfg, currentPaidUsers: Math.max(0, cfg.currentPaidUsers - 1) }); // an admin occupies no seat
    tx.setEntitlement(p.uid, {
      status: 'admin', accessStartedAt: cur?.accessStartedAt ?? p.now, accessExpiresAt: null, stripeCustomerId: cur?.stripeCustomerId ?? null,
      lastCheckoutSessionId: cur?.lastCheckoutSessionId ?? null, lastPaymentIntentId: cur?.lastPaymentIntentId ?? null, updatedAt: p.now, seatHeld: false, email: p.email ?? cur?.email ?? null,
    });
  });
}
/** Comp = free access for N days. Takes no paid seat. Refuses to touch a paying seat holder (release them first) or an admin. */
export async function compUser(store: Store, p: { uid: string; email: string | null; days: number; now: number }): Promise<{ expiresAt: number }> {
  if (!(p.days > 0 && p.days <= 3650)) throw new Error('days must be between 1 and 3650');
  return store.run(async (tx) => {
    const cur = await tx.entitlement(p.uid);
    if (cur?.status === 'admin') throw new Error('Refusing: that account is an admin (never modified).');
    if (cur?.seatHeld) throw new Error('Refusing: that user holds a paid seat. Release the seat first if you really want to convert them to a comp.');
    const expiresAt = p.now + p.days * DAY_MS;
    tx.setEntitlement(p.uid, {
      status: 'comped', accessStartedAt: p.now, accessExpiresAt: expiresAt, stripeCustomerId: cur?.stripeCustomerId ?? null,
      lastCheckoutSessionId: cur?.lastCheckoutSessionId ?? null, lastPaymentIntentId: cur?.lastPaymentIntentId ?? null, updatedAt: p.now, seatHeld: false, email: p.email ?? cur?.email ?? null,
    });
    return { expiresAt };
  });
}
/** Free a paid seat: access ends immediately, currentPaidUsers drops by one, and a live reservation (if any) is dropped. */
export async function releaseSeat(store: Store, p: { uid: string; now: number }): Promise<{ freed: boolean }> {
  return store.run(async (tx) => {
    const cur = await tx.entitlement(p.uid);
    if (!cur) throw new Error('No entitlement for that user.');
    if (cur.status === 'admin') throw new Error('Refusing: that account is an admin (never modified).');
    const cfg = await tx.config();
    if (cur.seatHeld && cfg) tx.setConfig({ ...cfg, currentPaidUsers: Math.max(0, cfg.currentPaidUsers - 1) });
    tx.setEntitlement(p.uid, { ...cur, status: 'expired', accessExpiresAt: p.now, seatHeld: false, updatedAt: p.now });
    tx.deleteReservation(p.uid);
    return { freed: cur.seatHeld };
  });
}
