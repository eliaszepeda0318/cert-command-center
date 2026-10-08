import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAccess } from '../context/AccessContext';
import { CheckoutButton, fmtDate } from './Billing';
import { Pill } from './ui';

/** Everything an unpaid, expired or released user sees. Loads no curriculum, progress, notes or history. */
export default function Paywall() {
  const { user, signOut } = useAuth();
  const a = useAccess();
  const returning = new URLSearchParams(useLocation().search).get('checkout') === 'success';
  const renewing = a.state === 'expired' && a.isRenewal;
  const price = `$${((a.config?.foundingPriceCents ?? 1000) / 100).toFixed(0)}`;
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">Cert Command Center</h1>
          {a.state === 'expired' ? <Pill tone="warn">Access ended</Pill> : <Pill>No active plan</Pill>}
        </div>
        {returning && !a.hasAccess ? (
          <div role="status" className="mt-4 rounded-md border border-sky-900 bg-sky-950/40 p-3 text-sm text-sky-200">
            Thanks. Confirming your payment with Stripe… this page unlocks automatically (usually a few seconds).
          </div>
        ) : a.soldOut ? (
          <div className="mt-4">
            <p className="font-medium text-zinc-100">Founding access is currently sold out.</p>
            <p className="mt-1 text-sm text-zinc-400">{renewing && !a.config?.salesOpen ? 'Renewals are paused right now.' : 'Seats are limited and all taken. Check back later.'}</p>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-zinc-300">{renewing ? 'Renew to keep studying.' : 'Track Jeremy’s free YouTube CCNA course and know exactly what to study next.'}</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{price} <span className="text-sm font-normal text-zinc-400">one-time · 365 days</span></p>
            <p className="mt-1 text-xs text-zinc-500">No subscription. {a.seatsLeft != null && !renewing ? `${a.seatsLeft} founding seat${a.seatsLeft === 1 ? '' : 's'} left.` : ''}</p>
            <div className="mt-4"><CheckoutButton label={renewing ? `Renew for ${price}` : `Get founding access · ${price}`} /></div>
          </div>
        )}
        {a.state === 'expired' && a.expiresAt && <p className="mt-4 text-xs text-zinc-500">Your access ended {fmtDate(a.expiresAt)}. Your saved progress is kept.</p>}
        {a.error && <p role="alert" className="mt-3 break-words text-xs text-red-400">{a.error}</p>}
        <div className="mt-5 border-t border-zinc-800 pt-3 text-xs text-zinc-500">
          Signed in as {user?.email} · <button onClick={signOut} className="underline hover:text-zinc-300">Sign out</button>
        </div>
      </div>
    </div>
  );
}
