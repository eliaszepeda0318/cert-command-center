/**
 * Owner-only admin commands for paid access. Uses the Admin SDK (your Google credentials), never the browser.
 *   npm run access -- <command> [args]
 *
 *   status                         seat counts, config, and every entitlement
 *   init --max <n>                 create appConfig/access (sales CLOSED). Never overwrites an existing one
 *   set-max <n>                    change the seat cap
 *   open | close                   open/close sales (close = kill switch: blocks ALL new checkouts, renewals included)
 *   find <uid|email>               look up a Firebase Auth account (prints UID, email, providers, whether it has study data). Writes nothing
 *   grant-admin --uid <UID>        permanent owner access that nothing can revoke. PREFERRED: a UID is unambiguous.
 *   grant-admin --email <email>    convenience: only RESOLVES the account and prints the exact --uid command to run; add --yes to apply directly
 *                                  (run this for yourself BEFORE deploying the new rules or hosting; deploy scripts refuse without it)
 *   comp <email|uid> [--days N]    free access for N days (default 365); uses no paid seat
 *   release <email|uid>            end a paid user's access and free their seat
 *
 * Needs FIREBASE_PROJECT_ID and Application Default Credentials (gcloud auth application-default login), like `npm run seed`.
 * Add --dry-run to any command to see the current state without writing.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { compUser, grantAdmin, hasAccessAt, initConfig, patchConfig, releaseSeat, type Entitlement } from '../functions/src/core';
import { PATHS, firestoreStore } from '../functions/src/store';

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT;
if (!projectId) { console.error('Set FIREBASE_PROJECT_ID (e.g. FIREBASE_PROJECT_ID=cert-command-center-eli).'); process.exit(1); }
initializeApp({ projectId });
const db = getFirestore();
const store = firestoreStore(db, Timestamp);

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
const dry = rest.includes('--dry-run');
const positional = rest.filter((a, i) => !a.startsWith('--') && !(rest[i - 1] ?? '').startsWith('--'));
const fmt = (ms: number | null) => (ms == null ? 'never' : new Date(ms).toISOString().slice(0, 10));

async function resolveUser(who: string | undefined): Promise<{ uid: string; email: string | null }> {
  if (!who) throw new Error('Pass the user email or uid.');
  const u = who.includes('@') ? await getAuth().getUserByEmail(who) : await getAuth().getUser(who);
  return { uid: u.uid, email: u.email ?? null };
}
/** Look up an account in Firebase Auth and say whether it is the one that holds study data (users/{uid}). Throws if it doesn't exist. */
async function describeAccount(by: { uid?: string; email?: string }) {
  const u = by.uid ? await getAuth().getUser(by.uid) : await getAuth().getUserByEmail(by.email!);
  const hasStudyData = (await db.doc(`users/${u.uid}`).get()).exists;
  console.log(`  uid:        ${u.uid}\n  email:      ${u.email ?? '(none)'}\n  name:       ${u.displayName ?? '(none)'}\n  sign-in:    ${u.providerData.map((p) => p.providerId).join(', ') || '(none)'}\n  disabled:   ${u.disabled}\n  study data: ${hasStudyData ? 'yes (users/' + u.uid + ' exists: this account has used the app)' : 'NO (no users/' + u.uid + ' profile yet)'}`);
  return { uid: u.uid, email: u.email ?? null, disabled: u.disabled, hasStudyData };
}
async function status() {
  const cfg = (await db.doc(PATHS.config).get()).data();
  console.log('appConfig/access:', cfg ?? '(missing: run `npm run access -- init --max <n>`)');
  const ents = (await db.collection(PATHS.entitlements).get()).docs.map((d) => ({ uid: d.id, ...(d.data() as Record<string, unknown>) }));
  const now = Date.now();
  let held = 0;
  for (const e of ents) {
    const x = e as unknown as Entitlement & { uid: string; accessExpiresAt: { toMillis(): number } | null };
    const exp = x.accessExpiresAt ? x.accessExpiresAt.toMillis() : null;
    if (x.seatHeld) held++;
    console.log(`  ${x.uid}  ${(x.email ?? '').padEnd(30)} ${x.status.padEnd(8)} expires ${fmt(exp).padEnd(10)} ${hasAccessAt({ ...x, accessExpiresAt: exp }, now) ? 'ACCESS' : 'no access'}  ${x.seatHeld ? 'seat' : ''}`);
  }
  const res = (await db.collection(PATHS.reservations).get()).docs.filter((d) => (d.data().expiresAt?.toMillis?.() ?? 0) > now).length;
  console.log(`seats: counter=${cfg?.currentPaidUsers ?? '?'} held-by-entitlements=${held} open-checkout-holds=${res} max=${cfg?.maxPaidUsers ?? '?'}`);
  if (cfg && cfg.currentPaidUsers !== held) console.warn('WARNING: counter and entitlements disagree. Do not edit by hand; investigate (see docs/paid-access.md > Troubleshooting).');
}

async function main() {
  const now = Date.now();
  if (dry || cmd === 'status' || !cmd) { if (!cmd) console.log(process.argv[1], '(see header comment for commands)'); await status(); if (cmd && cmd !== 'status') console.log('\n--dry-run: nothing was written.'); return; }
  switch (cmd) {
    case 'init': { const max = Number(flag('--max')); if (!Number.isInteger(max) || max < 0) throw new Error('init needs --max <whole number>'); console.log('config:', await initConfig(store, { maxPaidUsers: max })); break; }
    case 'set-max': { const max = Number(positional[0]); console.log('config:', await patchConfig(store, { maxPaidUsers: max })); break; }
    case 'open': console.log('config:', await patchConfig(store, { salesOpen: true })); break;
    case 'close': console.log('config:', await patchConfig(store, { salesOpen: false })); break;
    case 'find': { const who = positional[0]; if (!who) throw new Error('Usage: find <uid|email>'); await describeAccount(who.includes('@') ? { email: who } : { uid: who }); return; }
    case 'grant-admin': {
      const uid = flag('--uid'), email = flag('--email');
      if (positional.length) throw new Error('Be explicit: use --uid <UID> (preferred) or --email <email>. A bare argument is rejected so there is no ambiguity about who becomes admin.');
      if (!!uid === !!email) throw new Error('Pass exactly one of --uid <UID> or --email <email>.');
      console.log('Account found in Firebase Auth:');
      const a = await describeAccount(uid ? { uid } : { email });
      if (a.disabled) throw new Error('That account is disabled in Firebase Auth. Refusing.');
      if (email && !rest.includes('--yes')) { console.log(`\nNothing written. If this is YOUR Cert Command Center account (the one with study data), run:\n  npm run access -- grant-admin --uid ${a.uid}`); return; }
      if (!a.hasStudyData) console.warn('\nNOTE: this account has no study data yet. If you already use the app, you may be picking the wrong account. Cancel with Ctrl+C within 5 seconds.'), await new Promise((r) => setTimeout(r, 5000));
      await grantAdmin(store, { uid: a.uid, email: a.email, now }); console.log(`\nadmin granted to ${a.email ?? a.uid} (${a.uid})`); break;
    }
    case 'comp': { const u = await resolveUser(positional[0]); const days = Number(flag('--days') ?? 365); const r = await compUser(store, { ...u, days, now }); console.log(`comped ${u.email ?? u.uid} until ${fmt(r.expiresAt)}`); break; }
    case 'release': { const u = await resolveUser(positional[0]); const r = await releaseSeat(store, { uid: u.uid, now }); console.log(`released ${u.email ?? u.uid}${r.freed ? ' (seat freed)' : ' (held no paid seat)'}`); break; }
    default: throw new Error(`Unknown command "${cmd}".`);
  }
  await status();
}
main().catch((e) => { console.error(`\n${(e as Error).message}`); process.exit(1); });
