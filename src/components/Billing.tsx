import { useState } from 'react';
import { useAccess } from '../context/AccessContext';
import { startCheckout } from '../lib/billing';
import { btnPrimary } from './ui';

export const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

/** One button for both "Get founding access" and "Renew". The server decides; sold-out/closed come back as states, not errors. */
export function CheckoutButton({ label }: { label: string }) {
  const { canPurchase } = useAccess();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await startCheckout();
      if (r.status === 'ok') { window.location.assign(r.url); return; }
      setMsg(r.status === 'sold_out' ? 'Founding access is currently sold out.' : r.status === 'sales_closed' ? 'Purchases are paused right now.'
        : r.reason === 'too_much_banked' ? 'You already have more than a year of access banked.' : 'You already have access.');
    } catch (e) { setMsg((e as Error).message || 'Could not start checkout. Please try again.'); }
    setBusy(false);
  };
  return (
    <div>
      <button onClick={go} disabled={busy || !canPurchase} className={btnPrimary}>{busy ? 'Opening checkout…' : label}</button>
      {msg && <p role="alert" className="mt-2 text-sm text-amber-300">{msg}</p>}
    </div>
  );
}
