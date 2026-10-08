/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string; readonly VITE_FIREBASE_AUTH_DOMAIN?: string; readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string; readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string; readonly VITE_USE_EMULATORS?: string;
  /** Public reCAPTCHA v3 site key registered in Firebase App Check. Optional. */
  readonly VITE_APPCHECK_SITE_KEY?: string;
  /** 'true' on localhost/preview to print an App Check debug token to register in the console. */
  readonly VITE_APPCHECK_DEBUG?: string;
  readonly VITE_FUNCTIONS_REGION?: string;
}
