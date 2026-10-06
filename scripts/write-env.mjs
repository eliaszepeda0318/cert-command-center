// Writes .env from the Firebase web app config so nothing is copied by hand.
//   npm run env:write            (needs `firebase login` and a web app created with `firebase apps:create web`)
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';

if (existsSync('.env') && !process.argv.includes('--force')) { console.log('.env already exists (use --force to overwrite).'); process.exit(0); }
const out = execFileSync('npx', ['firebase', 'apps:sdkconfig', 'web', '--json'], { encoding: 'utf8' });
const j = JSON.parse(out.slice(out.indexOf('{')));
const c = j.result?.sdkConfig;
if (!c?.apiKey) { console.error('Could not read the web app config. Create one first: npx firebase apps:create web "Cert Command Center"'); process.exit(1); }
writeFileSync('.env', [
  `VITE_FIREBASE_API_KEY=${c.apiKey}`, `VITE_FIREBASE_AUTH_DOMAIN=${c.authDomain}`, `VITE_FIREBASE_PROJECT_ID=${c.projectId}`,
  `VITE_FIREBASE_APP_ID=${c.appId}`, `VITE_FIREBASE_MESSAGING_SENDER_ID=${c.messagingSenderId}`, 'VITE_USE_EMULATORS=false', ''].join('\n'));
console.log('Wrote .env for project', c.projectId);
