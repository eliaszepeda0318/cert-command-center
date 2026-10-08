import { lazy, Suspense } from 'react';
import { useAuth } from './context/AuthContext';
import { AccessProvider, useAccess } from './context/AccessContext';
import Paywall from './components/Paywall';
import { Spinner, btnPrimary } from './components/ui';

// The whole paid app (curriculum, progress, pages) is a separate chunk that only loads for users with valid access.
const PaidApp = lazy(() => import('./PaidApp'));

function SignIn() {
  const { signIn, error } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 text-center">
        <h1 className="text-lg font-semibold">Cert Command Center</h1>
        <p className="mt-1 text-sm text-zinc-400">A tracker for Jeremy’s free YouTube CCNA course. Sign in to see what to study next.</p>
        <button onClick={signIn} className={`${btnPrimary} mt-5 w-full`}>Continue with Google</button>
        {error && <p role="alert" className="mt-3 break-words text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}

function Gate() {
  const a = useAccess();
  if (a.state === 'loading') return <Spinner />;
  if (!a.hasAccess) return <Paywall />;
  return <Suspense fallback={<Spinner />}><PaidApp /></Suspense>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  // Signed-out visitors get a static sign-in card: no Firestore reads, no curriculum, no app code.
  if (!user) return <SignIn />;
  return <AccessProvider><Gate /></AccessProvider>;
}
