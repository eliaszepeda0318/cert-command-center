const REQUIRED = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'] as const;
/** Names of required Firebase env vars that are not set. Empty when configured. */
export const missingConfig = (): string[] => REQUIRED.filter((k) => !import.meta.env[k]);
