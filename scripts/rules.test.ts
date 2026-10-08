/**
 * Firestore security-rule tests (paid access). Run with the emulator:
 *   npm run test:rules
 * (wraps `firebase emulators:exec --only firestore`; needs Java 11+ on the machine)
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

const REFERENCE = ['certifications', 'courses', 'lessons', 'labs', 'topics', 'blueprints', 'blueprintObjectives', 'lessonObjectiveMappings', 'modules'];
const PERSONAL = ['progress/ccna-jeremy-day-01', 'studySessions/s1', 'ankiDays/2026-10-06', 'reviewDays/2026-10-06', 'topicProgress/t1', 'practiceExams/e1', 'workApplications/w1'];
const SERVER_ONLY = ['seatReservations/alice', 'stripePayments/cs_1'];
const DAY = 86_400_000;
const future = () => Timestamp.fromMillis(Date.now() + 30 * DAY);
const past = () => Timestamp.fromMillis(Date.now() - DAY);
const ent = (status: string, exp: Timestamp | null) => ({ status, accessStartedAt: Timestamp.fromMillis(Date.now() - 60 * DAY), accessExpiresAt: exp, stripeCustomerId: 'cus_1', lastCheckoutSessionId: 'cs_1', lastPaymentIntentId: 'pi_1', updatedAt: Timestamp.now(), seatHeld: status === 'active' });

let passed = 0;
const check = async (name: string, p: Promise<unknown>) => { await p; passed++; console.log(`  ok  ${name}`); };

async function main() {
  const env: RulesTestEnvironment = await initializeTestEnvironment({ projectId: 'demo-cert-rules', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
  // Arrange with rules disabled (this is what the Admin SDK does in production).
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const c of REFERENCE) await setDoc(doc(db, c, 'x'), { certificationId: 'ccna-200-301', title: 'seed' });
    await setDoc(doc(db, 'appConfig/access'), { salesOpen: true, maxPaidUsers: 10, currentPaidUsers: 2, foundingPriceCents: 1000 });
    await setDoc(doc(db, 'appConfig/other'), { v: 1 });
    await setDoc(doc(db, 'entitlements/alice'), ent('active', future()));
    await setDoc(doc(db, 'entitlements/bob'), ent('active', future()));
    await setDoc(doc(db, 'entitlements/lapsed'), ent('active', past()));          // status still "active" but the date has passed
    await setDoc(doc(db, 'entitlements/released'), ent('expired', future()));      // explicitly expired/revoked, even with a future date
    await setDoc(doc(db, 'entitlements/comped'), ent('comped', future()));
    await setDoc(doc(db, 'entitlements/compedOld'), ent('comped', past()));
    await setDoc(doc(db, 'entitlements/admin'), ent('admin', null));
    for (const u of ['alice', 'bob', 'lapsed', 'comped', 'admin']) {
      await setDoc(doc(db, `users/${u}`), { displayName: u });
      for (const p of PERSONAL) await setDoc(doc(db, `users/${u}/${p}`), { owner: u });
    }
    for (const p of SERVER_ONLY) await setDoc(doc(db, p), { v: 1 });
    await setDoc(doc(db, 'secrets/x'), { v: 1 });
  });

  const as = (uid: string) => env.authenticatedContext(uid).firestore();
  const anon = env.unauthenticatedContext().firestore();

  for (const [label, uid] of [['active user', 'alice'], ['comped user', 'comped'], ['admin user', 'admin']] as const) {
    console.log(`Full access: ${label}`);
    const db = as(uid);
    await check(`${label} can read all curriculum collections`, Promise.all(REFERENCE.map((c) => assertSucceeds(getDoc(doc(db, c, 'x'))))));
    await check(`${label} can update their profile`, assertSucceeds(updateDoc(doc(db, `users/${uid}`), { 'settings.weeklyGoalMinutes': 200 })));
    for (const p of PERSONAL) {
      await check(`${label} can write users/${uid}/${p}`, assertSucceeds(setDoc(doc(db, `users/${uid}/${p}`), { owner: uid })));
      await check(`${label} can read users/${uid}/${p}`, assertSucceeds(getDoc(doc(db, `users/${uid}/${p}`))));
    }
    await check(`${label} can add a session`, assertSucceeds(addDoc(collection(db, `users/${uid}/studySessions`), { durationMin: 30 })));
    await check(`${label} can delete their own entry`, assertSucceeds(deleteDoc(doc(db, `users/${uid}/workApplications/w1`))));
    await check(`${label} can read their entitlement`, assertSucceeds(getDoc(doc(db, `entitlements/${uid}`))));
    await check(`${label} can read appConfig/access`, assertSucceeds(getDoc(doc(db, 'appConfig/access'))));
  }

  for (const [label, uid] of [['expired (date passed) user', 'lapsed'], ['revoked/released user', 'released'], ['expired comp', 'compedOld']] as const) {
    console.log(`Blocked: ${label}`);
    const db = as(uid);
    await check(`${label} cannot read curriculum`, Promise.all(REFERENCE.map((c) => assertFails(getDoc(doc(db, c, 'x'))))));
    await check(`${label} cannot list lessons`, assertFails(getDocs(collection(db, 'lessons'))));
    for (const p of PERSONAL) {
      await check(`${label} cannot write users/${uid}/${p}`, assertFails(setDoc(doc(db, `users/${uid}/${p}`), { owner: uid })));
    }
    await check(`${label} cannot update their profile`, assertFails(updateDoc(doc(db, `users/${uid}`), { 'settings.weeklyGoalMinutes': 1 })));
    await check(`${label} cannot add a session`, assertFails(addDoc(collection(db, `users/${uid}/studySessions`), { durationMin: 30 })));
    await check(`${label} can still read their entitlement (to see renew UI)`, assertSucceeds(getDoc(doc(db, `entitlements/${uid}`))));
    await check(`${label} can read appConfig/access (to see sold out/renew state)`, assertSucceeds(getDoc(doc(db, 'appConfig/access'))));
  }
  await check('expired user can still READ their own saved progress (nothing is hidden or deleted)', assertSucceeds(getDoc(doc(as('lapsed'), 'users/lapsed/progress/ccna-jeremy-day-01'))));

  console.log('Blocked: unpaid user (no entitlement document)');
  {
    const db = as('unpaid');
    await check('unpaid cannot read curriculum', Promise.all(REFERENCE.map((c) => assertFails(getDoc(doc(db, c, 'x'))))));
    await check('unpaid cannot create a profile', assertFails(setDoc(doc(db, 'users/unpaid'), { displayName: 'x' })));
    await check('unpaid cannot write progress', assertFails(setDoc(doc(db, 'users/unpaid/progress/ccna-jeremy-day-01'), { a: 1 })));
    await check('unpaid can read their (missing) entitlement doc', assertSucceeds(getDoc(doc(db, 'entitlements/unpaid'))));
    await check('unpaid can read appConfig/access (sold-out check)', assertSucceeds(getDoc(doc(db, 'appConfig/access'))));
  }

  console.log('Clients can never write entitlements or seat config (any role)');
  for (const uid of ['alice', 'lapsed', 'unpaid', 'comped', 'admin']) {
    const db = as(uid);
    await check(`${uid} cannot write their own entitlement`, assertFails(setDoc(doc(db, `entitlements/${uid}`), ent('active', Timestamp.fromMillis(Date.now() + 9999 * DAY)))));
    await check(`${uid} cannot extend their expiry`, assertFails(updateDoc(doc(db, `entitlements/${uid}`), { accessExpiresAt: Timestamp.fromMillis(Date.now() + 9999 * DAY) })));
    await check(`${uid} cannot delete their entitlement`, assertFails(deleteDoc(doc(db, `entitlements/${uid}`))));
    await check(`${uid} cannot write appConfig/access`, assertFails(setDoc(doc(db, 'appConfig/access'), { salesOpen: true, maxPaidUsers: 9999, currentPaidUsers: 0, foundingPriceCents: 1 })));
    await check(`${uid} cannot change currentPaidUsers`, assertFails(updateDoc(doc(db, 'appConfig/access'), { currentPaidUsers: 0 })));
    await check(`${uid} cannot create another appConfig doc`, assertFails(setDoc(doc(db, 'appConfig/new'), { v: 1 })));
    for (const p of SERVER_ONLY) {
      await check(`${uid} cannot read ${p}`, assertFails(getDoc(doc(db, p))));
      await check(`${uid} cannot write ${p}`, assertFails(setDoc(doc(db, p), { v: 2 })));
    }
  }
  await check('appConfig documents other than "access" are not readable', assertFails(getDoc(doc(as('alice'), 'appConfig/other'))));

  console.log('Cross-user access');
  {
    const db = as('alice');
    await check('alice cannot read bob profile', assertFails(getDoc(doc(db, 'users/bob'))));
    await check('alice cannot write bob profile', assertFails(setDoc(doc(db, 'users/bob'), { displayName: 'hacked' })));
    for (const p of PERSONAL) {
      await check(`alice cannot read users/bob/${p}`, assertFails(getDoc(doc(db, `users/bob/${p}`))));
      await check(`alice cannot write users/bob/${p}`, assertFails(setDoc(doc(db, `users/bob/${p}`), { owner: 'alice' })));
    }
    await check('alice cannot list bob progress', assertFails(getDocs(collection(db, 'users/bob/progress'))));
    await check('alice cannot read bob entitlement', assertFails(getDoc(doc(db, 'entitlements/bob'))));
    await check('even admin cannot read another user’s data', assertFails(getDoc(doc(as('admin'), 'users/bob/progress/ccna-jeremy-day-01'))));
    await check('even admin cannot write another user’s data', assertFails(setDoc(doc(as('admin'), 'users/bob/progress/x'), { a: 1 })));
  }

  console.log('Reference data is read-only for everyone');
  for (const c of REFERENCE) {
    for (const uid of ['alice', 'admin', 'comped']) {
      await check(`${uid} cannot create ${c}`, assertFails(setDoc(doc(as(uid), c, 'new'), { title: 'x' })));
      await check(`${uid} cannot update ${c}`, assertFails(updateDoc(doc(as(uid), c, 'x'), { title: 'changed' })));
      await check(`${uid} cannot delete ${c}`, assertFails(deleteDoc(doc(as(uid), c, 'x'))));
    }
    await check(`anonymous cannot read ${c}`, assertFails(getDoc(doc(anon, c, 'x'))));
  }

  console.log('Anonymous and unknown paths');
  await check('anonymous cannot read appConfig/access', assertFails(getDoc(doc(anon, 'appConfig/access'))));
  await check('anonymous cannot read an entitlement', assertFails(getDoc(doc(anon, 'entitlements/alice'))));
  await check('anonymous cannot read a user profile', assertFails(getDoc(doc(anon, 'users/alice'))));
  await check('anonymous cannot write a user profile', assertFails(setDoc(doc(anon, 'users/alice'), { a: 1 })));
  await check('anonymous cannot list progress', assertFails(getDocs(collection(anon, 'users/alice/progress'))));
  await check('alice cannot read an unknown collection', assertFails(getDoc(doc(as('alice'), 'secrets/x'))));
  await check('alice cannot write an unknown collection', assertFails(setDoc(doc(as('alice'), 'secrets/y'), { v: 1 })));

  await env.cleanup();
  console.log(`\nrules tests passed (${passed} checks)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
