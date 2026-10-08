import { useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useLocation } from 'react-router-dom';
import { useAccess } from '../context/AccessContext';
import { CheckoutButton, fmtDate } from '../components/Billing';
import { Card, Pill, btnPrimary } from '../components/ui';

function PlanCard() {
  const a = useAccess();
  const paid = new URLSearchParams(useLocation().search).get('checkout') === 'success';
  const price = `$${((a.config?.foundingPriceCents ?? 1000) / 100).toFixed(0)}`;
  const plan = a.state === 'admin' ? 'Owner' : a.state === 'comped' ? 'Complimentary' : 'Founding access (1 year)';
  const low = a.state === 'active' && (a.daysRemaining ?? 999) <= 30;
  return (
    <Card title="Plan & access" action={<Pill tone={low ? 'warn' : 'good'}>{a.state === 'admin' ? 'Admin' : low ? 'Renew soon' : 'Active'}</Pill>}>
      {paid && <p role="status" className="mb-3 rounded-md border border-emerald-900 bg-emerald-950/40 p-2 text-sm text-emerald-300">Payment received. Thank you!</p>}
      <dl className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-zinc-500">Plan</dt><dd>{plan}</dd></div>
        <div><dt className="text-xs text-zinc-500">Access expires</dt><dd>{a.state === 'admin' ? 'Never' : a.expiresAt ? fmtDate(a.expiresAt) : '—'}</dd></div>
        <div><dt className="text-xs text-zinc-500">Days remaining</dt><dd className="tabular-nums">{a.state === 'admin' ? '—' : a.daysRemaining ?? '—'}</dd></div>
      </dl>
      {a.state === 'active' && (
        <div className="mt-4">
          {a.canPurchase ? <CheckoutButton label={`Renew for ${price} (+365 days)`} />
            : <p className="text-sm text-zinc-500">{(a.daysRemaining ?? 0) > 365 ? 'You already have over a year banked, so renewal is not needed yet.' : 'Renewals are paused right now.'}</p>}
          {a.canPurchase && <p className="mt-2 text-xs text-zinc-500">Adds 365 days to your current expiry. One-time payment, no subscription.</p>}
        </div>
      )}
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { profile, course } = useAppData();
  const [hours, setHours] = useState(String((profile?.settings.weeklyGoalMinutes ?? 300) / 60));
  const [msg, setMsg] = useState('');
  const save = async () => {
    const h = Number(hours);
    if (!(h > 0 && h <= 80)) { setMsg('Enter a goal between 0 and 80 hours.'); return; }
    try { await updateDoc(doc(db, 'users', user!.uid), { 'settings.weeklyGoalMinutes': Math.round(h * 60), updatedAt: serverTimestamp() }); setMsg('Saved.'); }
    catch (e) { setMsg((e as Error).message); }
  };
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <PlanCard />
      <Card title="Weekly study goal">
        <label className="block text-sm text-zinc-400" htmlFor="goal">Hours per week</label>
        <div className="mt-1 flex gap-2">
          <input id="goal" type="number" min="0.5" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)}
            className="w-28 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          <button onClick={save} className={btnPrimary}>Save</button>
        </div>
        {msg && <p role="status" className="mt-2 text-sm text-zinc-400">{msg}</p>}
      </Card>
      <Card title="Curriculum data">
        <p className="text-sm text-zinc-400">{course ? <>{course.title} · content version <code className="text-zinc-300">{course.contentVersion}</code></> : 'No curriculum loaded. Run the seed script.'}</p>
      </Card>
    </div>
  );
}
