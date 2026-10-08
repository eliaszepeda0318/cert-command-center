/**
 * Pre-deployment safety check. Run automatically by `npm run deploy` and `npm run deploy:rules`.
 * The paid-access rules (and the paywalled web app) lock out everyone WITHOUT an entitlement, so this refuses to proceed unless
 * at least one valid admin entitlement already exists in Firestore AND belongs to a real, enabled Firebase Auth account.
 * It fails CLOSED: if it cannot read Firestore/Auth (no credentials, no network, wrong project) the deploy is refused.
 *
 * Needs FIREBASE_PROJECT_ID and Application Default Credentials (gcloud auth application-default login), like the seed script.
 * To grant the entitlement:  npm run access -- find <email>   then   npm run access -- grant-admin --uid <UID>
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { isValidAdminEntitlement, type Entitlement } from '../functions/src/core';

const fail = (msg: string): never => {
  console.error(`\n✖ DEPLOY REFUSED: ${msg}\n\nThe new paid-access rules/app would lock you out. Fix it first:\n  1. gcloud auth application-default login\n  2. export FIREBASE_PROJECT_ID=<your project id>\n  3. npm run access -- find <your-email>          (shows your UID and whether it has study data)\n  4. npm run access -- grant-admin --uid <UID>\n  5. npm run access -- status                       (confirm you are listed as admin)\nSee docs/paid-access.md > "0. Safe rollout order".\n`);
  process.exit(1);
};

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT;
  if (!projectId) return fail('FIREBASE_PROJECT_ID is not set, so I cannot tell which project to check.');
  initializeApp({ projectId });
  let docs;
  try { docs = (await getFirestore().collection('entitlements').where('status', '==', 'admin').get()).docs; }
  catch (e) { return fail(`could not read entitlements in "${projectId}" (${(e as Error).message}). Credentials or network problem; refusing to guess.`); }
  const admins = docs.filter((d) => isValidAdminEntitlement(d.data() as Partial<Entitlement>));
  if (!admins.length) return fail(`no valid admin entitlement exists in project "${projectId}".`);
  const good: string[] = [];
  for (const d of admins) {
    try { const u = await getAuth().getUser(d.id); if (!u.disabled) good.push(`${u.email ?? '(no email)'} (${d.id})`); }
    catch { /* entitlement points at a UID that does not exist in Firebase Auth: does not count */ }
  }
  if (!good.length) return fail(`admin entitlement(s) exist but none belongs to an enabled Firebase Auth account (UIDs: ${admins.map((d) => d.id).join(', ')}). A typo'd UID would lock you out.`);
  console.log(`✔ Admin entitlement present for ${good.join(', ')} in "${projectId}".`);
}
main().catch((e) => fail((e as Error).message));
