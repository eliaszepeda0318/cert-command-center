import { useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { Card, btnPrimary } from '../components/ui';

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
