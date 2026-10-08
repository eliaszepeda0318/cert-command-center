import { defineBoolean, defineSecret, defineString } from 'firebase-functions/params';

/**
 * COST CONTROLS: the only place scaling limits live. They are deliberately tiny for a small paid beta and are never raised
 * automatically. To change them later: edit these numbers, then `npm run deploy:functions` (see docs/paid-access.md).
 */
export const SCALING = {
  /** Never run warm instances (a warm instance bills while idle). */
  minInstances: 0,
  /** Hard ceiling on concurrent instances per function. Each instance already handles several requests at once. */
  maxInstances: 2,
  memory: '256MiB' as const,
  timeoutSeconds: 30,
};
/** Functions region. If you change it, set VITE_FUNCTIONS_REGION to the same value for the web app. */
export const REGION = 'us-central1';

// Secrets live in Secret Manager (firebase functions:secrets:set). Never in Vite env, git, or functions/.env.
export const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
export const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
// Non-secret parameters (functions/.env.<projectId>).
export const STRIPE_PRICE_ID = defineString('STRIPE_PRICE_ID');
export const APP_BASE_URL = defineString('APP_BASE_URL');
export const ENFORCE_APP_CHECK = defineBoolean('ENFORCE_APP_CHECK', { default: false });

export const APP_MARKER = 'cert-command-center';
