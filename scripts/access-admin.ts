/**
 * Owner-only admin commands for paid access. Uses the Admin SDK (your Google credentials), never the browser.
 *   npm run access -- <command> [args]
 *
 *   status                         seat counts, config, and every entitlement
 *   init --max <n>                 create appConfig/access (sales CLOSED). Never overwrites an existing one
 *   set-max <n>                    change the seat cap
 *   open | close                   open/close sales (close = kill switch: blocks ALL new checkouts, renewals included)
 *   grant-admin <email|uid>        permanent access that nothing can revoke (run this for yourself BEFORE deploying the new rules)
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
    case 'grant-admin': { const u = await resolveUser(positional[0]); await grantAdmin(store, { ...u, now }); console.log(`admin granted to ${u.email ?? u.uid} (${u.uid})`); break; }
    case 'comp': { const u = await resolveUser(positional[0]); const days = Number(flag('--days') ?? 365); const r = await compUser(store, { ...u, days, now }); console.log(`comped ${u.email ?? u.uid} until ${fmt(r.expiresAt)}`); break; }
    case 'release': { const u = await resolveUser(positional[0]); const r = await releaseSeat(store, { uid: u.uid, now }); console.log(`released ${u.email ?? u.uid}${r.freed ? ' (seat freed)' : ' (held no paid seat)'}`); break; }
    default: throw new Error(`Unknown command "${cmd}".`);
  }
  await status();
}
main().catch((e) => { console.error(`\n${(e as Error).message}`); process.exit(1); });
