/**
 * Paid-access logic tests (seat cap, idempotent payments, renewals, comp/admin, release).
 *   npm run test:access            -> in-memory store with optimistic concurrency (no setup needed)
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run test:access   -> same suite against the real Firestore adapter (needs the emulator)
 */
import assert from 'node:assert/strict';
import { type AccessConfig, ACCESS_MS, DAY_MS, MAX_BANKED_MS, applyPayment, attachSession, compUser, extendedExpiry, grantAdmin, hasAccessAt, initConfig, patchConfig, releaseReservation, releaseSeat, reserveCheckout, type PaymentInput, type Store } from '../functions/src/core';
import { MemStore } from './memStore';

const T0 = Date.UTC(2026, 9, 8, 12, 0, 0);
let n = 0, ok = 0;
async function test(name: string, fn: () => Promise<void>) { n++; try { await fn(); ok++; console.log(`  ok  ${name}`); } catch (e) { console.error(`FAIL  ${name}\n`, e); process.exitCode = 1; } }

async function makeStore(): Promise<{ s: Store; mem: MemStore | null; cfg: () => Promise<AccessConfig>; ent: (uid: string) => Promise<any>; payments: () => Promise<number> }> {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    const { initializeApp, getApps } = await import('firebase-admin/app');
    const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
    const { firestoreStore } = await import('../functions/src/store');
    if (!getApps().length) initializeApp({ projectId: 'demo-cert-access' });
    const db = getFirestore();
    for (const c of ['appConfig', 'entitlements', 'seatReservations', 'stripePayments']) { const snap = await db.collection(c).get(); await Promise.all(snap.docs.map((d) => d.ref.delete())); }
    return {
      s: firestoreStore(db, Timestamp), mem: null,
      cfg: async () => (await db.doc('appConfig/access').get()).data() as any,
      ent: async (uid) => { const d = (await db.doc(`entitlements/${uid}`).get()).data(); return d && { ...d, accessExpiresAt: d.accessExpiresAt?.toMillis?.() ?? null }; },
      payments: async () => (await db.collection('stripePayments').get()).size,
    };
  }
  const mem = new MemStore();
  return { s: mem, mem, cfg: async () => mem.config as any, ent: async (uid) => mem.ents.get(uid), payments: async () => mem.pays.size };
}

let sid = 0;
const pay = (uid: string, over: Partial<PaymentInput> = {}): PaymentInput => ({ sessionId: `cs_${++sid}`, uid, paymentIntentId: `pi_${sid}`, customerId: `cus_${uid}`, paidAt: T0, email: `${uid}@x.test`, now: T0, ...over });
/** Reserve then pay, like a real purchase. */
async function buy(s: Store, uid: string, at = T0, over: Partial<PaymentInput> = {}) {
  const r = await reserveCheckout(s, { uid, email: null, now: at });
  assert.equal(r.kind, 'ok', `reserve for ${uid}: ${r.kind}`);
  const sessionId = `cs_${++sid}`;
  if (r.kind === 'ok' && r.reservation) await attachSession(s, uid, sessionId);
  return applyPayment(s, pay(uid, { sessionId, paidAt: at, now: at, ...over }));
}
async function open(max: number) { const x = await makeStore(); await initConfig(x.s, { maxPaidUsers: max }); await patchConfig(x.s, { salesOpen: true }); return x; }

async function main() {
  process.on("exit", () => { if (process.env.SHOW_RETRIES) console.log("(done)"); });
  console.log('Entitlement basics');
  await test('extendedExpiry: future expiry + 365d; expired/new = payment time + 365d', async () => {
    assert.equal(extendedExpiry(T0 + 10 * DAY_MS, T0), T0 + 10 * DAY_MS + ACCESS_MS);
    assert.equal(extendedExpiry(T0 - DAY_MS, T0), T0 + ACCESS_MS);
    assert.equal(extendedExpiry(null, T0), T0 + ACCESS_MS);
  });
  await test('hasAccessAt: unpaid, active, expired, comped, admin', async () => {
    const e = (status: any, exp: number | null) => ({ status, accessExpiresAt: exp }) as any;
    assert.equal(hasAccessAt(undefined, T0), false);
    assert.equal(hasAccessAt(e('active', T0 + 1), T0), true);
    assert.equal(hasAccessAt(e('active', T0), T0), false);
    assert.equal(hasAccessAt(e('expired', T0 + DAY_MS), T0), false);
    assert.equal(hasAccessAt(e('comped', T0 + DAY_MS), T0), true);
    assert.equal(hasAccessAt(e('comped', T0 - 1), T0), false);
    assert.equal(hasAccessAt(e('admin', null), T0), true);
  });

  console.log('Checkout gate + payment');
  await test('brand-new unpaid user has no entitlement (blocked)', async () => {
    const { ent } = await open(5); assert.equal(await ent('nobody'), undefined);
  });
  await test('successful payment grants exactly 365 days and takes one seat', async () => {
    const { s, ent, cfg } = await open(5);
    const r = await buy(s, 'alice');
    assert.equal(r.kind, 'granted_new');
    const e = await ent('alice');
    assert.equal(e.status, 'active'); assert.equal(e.accessExpiresAt, T0 + ACCESS_MS); assert.equal(e.accessStartedAt, T0);
    assert.equal(e.stripeCustomerId, 'cus_alice'); assert.ok(e.lastCheckoutSessionId && e.lastPaymentIntentId); assert.equal(e.seatHeld, true);
    assert.equal((await cfg()).currentPaidUsers, 1);
  });
  await test('duplicate webhook (same session) does not add a second year or seat', async () => {
    const { s, ent, cfg, payments } = await open(5);
    const input = pay('alice');
    await reserveCheckout(s, { uid: 'alice', email: null, now: T0 }); await attachSession(s, 'alice', input.sessionId);
    assert.equal((await applyPayment(s, input)).kind, 'granted_new');
    for (let i = 0; i < 3; i++) assert.equal((await applyPayment(s, input)).kind, 'duplicate');
    assert.equal((await ent('alice')).accessExpiresAt, T0 + ACCESS_MS);
    assert.equal((await cfg()).currentPaidUsers, 1); assert.equal(await payments(), 1);
  });
  await test('concurrent duplicate deliveries still grant once', async () => {
    const { s, ent, cfg } = await open(5);
    const input = pay('alice');
    await reserveCheckout(s, { uid: 'alice', email: null, now: T0 }); await attachSession(s, 'alice', input.sessionId);
    const out = await Promise.all(Array.from({ length: 6 }, () => applyPayment(s, input)));
    assert.equal(out.filter((o) => o.kind === 'granted_new').length, 1); assert.equal(out.filter((o) => o.kind === 'duplicate').length, 5);
    assert.equal((await ent('alice')).accessExpiresAt, T0 + ACCESS_MS); assert.equal((await cfg()).currentPaidUsers, 1);
  });
  await test('second unique new user increments the seat count', async () => {
    const { s, cfg } = await open(5); await buy(s, 'alice'); await buy(s, 'bob');
    assert.equal((await cfg()).currentPaidUsers, 2);
  });

  console.log('Renewals');
  await test('early renewal = existing future expiry + 365d, seat count unchanged', async () => {
    const { s, ent, cfg } = await open(5); await buy(s, 'alice');
    const later = T0 + 200 * DAY_MS; // 165 days left
    const r = await buy(s, 'alice', later); assert.equal(r.kind, 'renewed');
    const e = await ent('alice');
    assert.equal(e.accessExpiresAt, T0 + 2 * ACCESS_MS); assert.equal(e.accessStartedAt, T0);
    assert.equal((await cfg()).currentPaidUsers, 1);
  });
  await test('renewal after expiry = payment time + 365d, seat count unchanged', async () => {
    const { s, ent, cfg } = await open(5); await buy(s, 'alice');
    const later = T0 + 400 * DAY_MS; const r = await buy(s, 'alice', later);
    assert.equal(r.kind, 'renewed'); const e = await ent('alice');
    assert.equal(e.accessExpiresAt, later + ACCESS_MS); assert.equal(e.accessStartedAt, later); assert.equal((await cfg()).currentPaidUsers, 1);
  });
  await test('cannot bank more than one extra year', async () => {
    const { s } = await open(5); await buy(s, 'alice'); await buy(s, 'alice', T0 + DAY_MS); // ~2 years banked now
    const r = await reserveCheckout(s, { uid: 'alice', email: null, now: T0 + 2 * DAY_MS });
    assert.deepEqual(r, { kind: 'already_active', reason: 'too_much_banked' }); assert.ok(MAX_BANKED_MS === ACCESS_MS);
  });
  await test('expired seat holder can renew even when sold out', async () => {
    const { s } = await open(1); await buy(s, 'alice');
    const r = await reserveCheckout(s, { uid: 'alice', email: null, now: T0 + 400 * DAY_MS });
    assert.equal(r.kind, 'ok'); if (r.kind === 'ok') assert.equal(r.mode, 'renewal');
  });

  console.log('Capacity');
  await test('sold out (current >= max) refuses checkout and creates no reservation', async () => {
    const { s, mem } = await open(1); await buy(s, 'alice');
    const r = await reserveCheckout(s, { uid: 'bob', email: null, now: T0 });
    assert.deepEqual(r, { kind: 'sold_out' }); if (mem) assert.equal(mem.res.size, 0);
  });
  await test('raising maxPaidUsers allows another checkout', async () => {
    const { s } = await open(1); await buy(s, 'alice');
    assert.equal((await reserveCheckout(s, { uid: 'bob', email: null, now: T0 })).kind, 'sold_out');
    await patchConfig(s, { maxPaidUsers: 2 });
    assert.equal((await reserveCheckout(s, { uid: 'bob', email: null, now: T0 })).kind, 'ok');
  });
  await test('salesOpen=false blocks every checkout, including renewals', async () => {
    const { s } = await open(5); await buy(s, 'alice'); await patchConfig(s, { salesOpen: false });
    assert.deepEqual(await reserveCheckout(s, { uid: 'bob', email: null, now: T0 }), { kind: 'sales_closed' });
    assert.deepEqual(await reserveCheckout(s, { uid: 'alice', email: null, now: T0 + 400 * DAY_MS }), { kind: 'sales_closed' });
  });
  await test('missing appConfig/access fails closed (sales closed)', async () => {
    const { s } = await makeStore(); assert.deepEqual(await reserveCheckout(s, { uid: 'x', email: null, now: T0 }), { kind: 'sales_closed' });
  });
  await test('open reservations count against the cap; they expire and free the seat', async () => {
    const { s } = await open(1);
    assert.equal((await reserveCheckout(s, { uid: 'alice', email: null, now: T0 })).kind, 'ok');
    assert.equal((await reserveCheckout(s, { uid: 'bob', email: null, now: T0 + 60_000 })).kind, 'sold_out');
    assert.equal((await reserveCheckout(s, { uid: 'bob', email: null, now: T0 + 40 * 60_000 })).kind, 'ok'); // alice's hold expired
  });
  await test('a failed checkout start releases the seat immediately', async () => {
    const { s } = await open(1); await reserveCheckout(s, { uid: 'alice', email: null, now: T0 }); await releaseReservation(s, 'alice');
    assert.equal((await reserveCheckout(s, { uid: 'bob', email: null, now: T0 })).kind, 'ok');
  });
  await test('clicking twice reuses the same reservation/session', async () => {
    const { s, mem } = await open(2); await reserveCheckout(s, { uid: 'alice', email: null, now: T0 }); await attachSession(s, 'alice', 'cs_open');
    const r = await reserveCheckout(s, { uid: 'alice', email: null, now: T0 + 1000 });
    assert.equal(r.kind, 'ok'); if (r.kind === 'ok') assert.equal(r.existingSessionId, 'cs_open'); if (mem) assert.equal(mem.res.size, 1);
  });
  await test('10 simultaneous new buyers with 3 seats: exactly 3 admitted, count never exceeds the cap', async () => {
    const { s, cfg } = await open(3);
    const out = await Promise.all(Array.from({ length: 10 }, (_, i) => reserveCheckout(s, { uid: `u${i}`, email: null, now: T0 })));
    const admitted = out.map((r, i) => [r, i] as const).filter(([r]) => r.kind === 'ok').map(([, i]) => `u${i}`);
    assert.equal(admitted.length, 3); assert.equal(out.filter((r) => r.kind === 'sold_out').length, 7);
    await Promise.all(admitted.map((u, i) => applyPayment(s, pay(u, { sessionId: `cs_race_${i}` })).catch(() => null)));
    assert.ok((await cfg()).currentPaidUsers <= 3);
  });
  await test('simultaneous payments for the held seats all succeed; count equals seats sold', async () => {
    const { s, cfg } = await open(3); const ids = ['a', 'b', 'c'];
    await Promise.all(ids.map((u, i) => reserveCheckout(s, { uid: u, email: null, now: T0 }).then(() => attachSession(s, u, `cs_h${i}`))));
    const out = await Promise.all(ids.map((u, i) => applyPayment(s, pay(u, { sessionId: `cs_h${i}` }))));
    assert.ok(out.every((o) => o.kind === 'granted_new')); assert.equal((await cfg()).currentPaidUsers, 3);
  });
  await test('paid with no reservation and no free seat: nothing granted, refund requested, cap intact', async () => {
    const { s, ent, cfg } = await open(1); await buy(s, 'alice');
    const input = pay('zed'); const r = await applyPayment(s, input);
    assert.equal(r.kind, 'refund_needed'); assert.equal(await ent('zed'), undefined); assert.equal((await cfg()).currentPaidUsers, 1);
    assert.deepEqual(await applyPayment(s, input), { kind: 'duplicate', refundPending: true }); // retried delivery re-attempts the refund, grants nothing
  });
  await test('paid with no reservation but a free seat is still granted (late webhook after reservation expiry)', async () => {
    const { s, cfg } = await open(2); const r = await applyPayment(s, pay('late'));
    assert.equal(r.kind, 'granted_new'); assert.equal((await cfg()).currentPaidUsers, 1);
  });

  console.log('Comp, admin, release');
  await test('comped user: access for N days, no seat used; cannot buy while comp is active', async () => {
    const { s, ent, cfg } = await open(1); await compUser(s, { uid: 'carol', email: 'c@x.test', days: 30, now: T0 });
    const e = await ent('carol'); assert.equal(e.status, 'comped'); assert.equal(hasAccessAt(e, T0 + DAY_MS), true); assert.equal(hasAccessAt(e, T0 + 31 * DAY_MS), false);
    assert.equal((await cfg()).currentPaidUsers, 0);
    assert.deepEqual(await reserveCheckout(s, { uid: 'carol', email: null, now: T0 + DAY_MS }), { kind: 'already_active', reason: 'comped' });
    assert.equal((await reserveCheckout(s, { uid: 'carol', email: null, now: T0 + 40 * DAY_MS })).kind, 'ok'); // after the comp ends she can purchase
  });
  await test('admin: permanent access, never modified by payment/comp/release, never sold a checkout', async () => {
    const { s, ent, cfg } = await open(1); await grantAdmin(s, { uid: 'eli', email: 'e@x.test', now: T0 });
    assert.equal(hasAccessAt(await ent('eli'), T0 + 50 * ACCESS_MS), true); assert.equal((await cfg()).currentPaidUsers, 0);
    assert.deepEqual(await reserveCheckout(s, { uid: 'eli', email: null, now: T0 }), { kind: 'already_active', reason: 'admin' });
    assert.equal((await applyPayment(s, pay('eli'))).kind, 'admin_noop'); assert.equal((await ent('eli')).status, 'admin');
    await assert.rejects(compUser(s, { uid: 'eli', email: null, days: 5, now: T0 }), /admin/);
    await assert.rejects(releaseSeat(s, { uid: 'eli', now: T0 }), /admin/);
    assert.equal((await ent('eli')).status, 'admin');
  });
  await test('release frees the seat and ends access; the user must buy again (needs capacity)', async () => {
    const { s, ent, cfg } = await open(1); await buy(s, 'alice');
    assert.equal((await releaseSeat(s, { uid: 'alice', now: T0 + DAY_MS })).freed, true);
    assert.equal((await ent('alice')).status, 'expired'); assert.equal(hasAccessAt(await ent('alice'), T0 + DAY_MS), false); assert.equal((await cfg()).currentPaidUsers, 0);
    await buy(s, 'bob'); // takes the freed seat
    assert.equal((await reserveCheckout(s, { uid: 'alice', email: null, now: T0 + 2 * DAY_MS })).kind, 'sold_out');
  });
  await test('comp refuses a paying seat holder', async () => {
    const { s } = await open(2); await buy(s, 'alice'); await assert.rejects(compUser(s, { uid: 'alice', email: null, days: 5, now: T0 }), /paid seat/);
  });
  await test('config admin: patch never changes currentPaidUsers; rejects bad max; init never overwrites', async () => {
    const { s, cfg } = await open(2); await buy(s, 'alice');
    await patchConfig(s, { maxPaidUsers: 10, salesOpen: false }); assert.equal((await cfg()).currentPaidUsers, 1); assert.equal((await cfg()).foundingPriceCents, 1000);
    await assert.rejects(patchConfig(s, { maxPaidUsers: -1 }), /whole number/); await assert.rejects(patchConfig(s, { maxPaidUsers: 1.5 }), /whole number/);
    await initConfig(s, { maxPaidUsers: 99 }); assert.equal((await cfg()).maxPaidUsers, 10);
  });

  console.log(`\naccess tests: ${ok}/${n} passed`);
  if (ok !== n) process.exit(1);
}
main();
