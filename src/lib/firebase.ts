import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from 'firebase/firestore';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
});
// App Check (reCAPTCHA v3) attaches a token to payment-function calls. Off unless VITE_APPCHECK_SITE_KEY is set.
// Enforcement is a separate, deliberate server-side switch (functions ENFORCE_APP_CHECK); see docs/paid-access.md.
const appCheckKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
if (appCheckKey) {
  if (import.meta.env.VITE_APPCHECK_DEBUG === 'true') (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider(appCheckKey), isTokenAutoRefreshEnabled: true });
}
export const auth = getAuth(app);
export const functions = getFunctions(app, import.meta.env.VITE_FUNCTIONS_REGION || 'us-central1');
export const googleProvider = new GoogleAuthProvider();
// Offline cache keeps repeat loads fast and cuts billable reads.
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
