/**
 * Firestore security-rule tests. Run with the emulator:
 *   npm run test:rules
 * (wraps `firebase emulators:exec --only firestore`; needs Java 11+ on the machine)
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, collection, getDocs, addDoc } from 'firebase/firestore';

const REFERENCE = ['certifications', 'courses', 'lessons', 'labs', 'topics', 'blueprints', 'blueprintObjectives', 'lessonObjectiveMappings', 'modules'];
const PERSONAL = ['progress/ccna-jeremy-day-01', 'studySessions/s1', 'ankiDays/2026-10-06', 'reviewDays/2026-10-06', 'topicProgress/t1', 'practiceExams/e1', 'workApplications/w1'];

let passed = 0;
const check = async (name: string, p: Promise<unknown>) => { await p; passed++; console.log(`  ok  ${name}`); };

async function main() {
  const env: RulesTestEnvironment = await initializeTestEnvironment({
    projectId: 'demo-cert-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
  // Arrange data with rules disabled (like the Admin SDK seed script would).
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const c of REFERENCE) await setDoc(doc(db, c, 'x'), { certificationId: 'ccna-200-301', title: 'seed' });
    await setDoc(doc(db, 'users/bob'), { displayName: 'Bob' });
    for (const p of PERSONAL) await setDoc(doc(db, `users/bob/${p}`), { owner: 'bob' });
    await setDoc(doc(db, 'secrets/x'), { v: 1 });
  });

  const alice = env.authenticatedContext('alice').firestore();
  const anon = env.unauthenticatedContext().firestore();

  console.log('Owner access');
  await check('alice can create her profile', assertSucceeds(setDoc(doc(alice, 'users/alice'), { displayName: 'Alice' })));
  await check('alice can update her profile', assertSucceeds(updateDoc(doc(alice, 'users/alice'), { 'settings.weeklyGoalMinutes': 200 })));
  for (const p of PERSONAL) {
    await check(`alice can write users/alice/${p}`, assertSucceeds(setDoc(doc(alice, `users/alice/${p}`), { owner: 'alice' })));
    await check(`alice can read users/alice/${p}`, assertSucceeds(getDoc(doc(alice, `users/alice/${p}`))));
  }
  await check('alice can list her progress', assertSucceeds(getDocs(collection(alice, 'users/alice/progress'))));
  await check('alice can add a session', assertSucceeds(addDoc(collection(alice, 'users/alice/studySessions'), { durationMin: 30 })));
  await check('alice can delete her own entry', assertSucceeds(deleteDoc(doc(alice, 'users/alice/workApplications/w1'))));

  console.log("Other users' data");
  await check('alice cannot read bob profile', assertFails(getDoc(doc(alice, 'users/bob'))));
  await check('alice cannot write bob profile', assertFails(setDoc(doc(alice, 'users/bob'), { displayName: 'hacked' })));
  for (const p of PERSONAL) {
    await check(`alice cannot read users/bob/${p}`, assertFails(getDoc(doc(alice, `users/bob/${p}`))));
    await check(`alice cannot write users/bob/${p}`, assertFails(setDoc(doc(alice, `users/bob/${p}`), { owner: 'alice' })));
  }
  await check('alice cannot list bob progress', assertFails(getDocs(collection(alice, 'users/bob/progress'))));
  await check('alice cannot delete bob entry', assertFails(deleteDoc(doc(alice, 'users/bob/practiceExams/e1'))));

  console.log('Shared reference data');
  for (const c of REFERENCE) {
    await check(`alice can read ${c}`, assertSucceeds(getDoc(doc(alice, c, 'x'))));
    await check(`alice cannot create ${c}`, assertFails(setDoc(doc(alice, c, 'new'), { title: 'x' })));
    await check(`alice cannot update ${c}`, assertFails(updateDoc(doc(alice, c, 'x'), { title: 'changed' })));
    await check(`alice cannot delete ${c}`, assertFails(deleteDoc(doc(alice, c, 'x'))));
    await check(`anonymous cannot read ${c}`, assertFails(getDoc(doc(anon, c, 'x'))));
  }

  console.log('Unauthenticated and unknown paths');
  await check('anonymous cannot read a user profile', assertFails(getDoc(doc(anon, 'users/alice'))));
  await check('anonymous cannot write a user profile', assertFails(setDoc(doc(anon, 'users/alice'), { a: 1 })));
  await check('anonymous cannot list progress', assertFails(getDocs(collection(anon, 'users/alice/progress'))));
  await check('alice cannot read an unknown collection', assertFails(getDoc(doc(alice, 'secrets/x'))));
  await check('alice cannot write an unknown collection', assertFails(setDoc(doc(alice, 'secrets/y'), { v: 1 })));

  await env.cleanup();
  console.log(`\nrules tests passed (${passed} checks)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
