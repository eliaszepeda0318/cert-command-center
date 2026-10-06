import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { deleteWorkApplication, saveWorkApplication } from '../lib/data';
import { localDateKey } from '../lib/progress';
import { Card, EmptyState, ErrorState, Label, PageTitle, Pill, btnPrimary, field } from '../components/ui';
import type { WorkApplication } from '../types';

export default function Applied() {
  const { user } = useAuth();
  const { activeCert, topics } = useAppData();
  const uid = user!.uid;
  const [items, setItems] = useState<WorkApplication[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [date, setDate] = useState(localDateKey());
  const [title, setTitle] = useState('');
  const [situation, setSituation] = useState('');
  const [applied, setApplied] = useState('');
  const [topicId, setTopicId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => onSnapshot(query(collection(db, 'users', uid, 'workApplications'), orderBy('date', 'desc'), limit(100)),
    (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }) as WorkApplication)), (e) => setErr(e.message)), [uid]);

  const save = async () => {
    if (!title.trim() || !situation.trim() || !applied.trim()) { setErr('Add a topic, the situation, and what knowledge you applied.'); return; }
    setSaving(true); setErr(null);
    try { await saveWorkApplication(uid, { certificationId: activeCert!.id, date, title: title.trim(), situation, knowledgeApplied: applied, topicId: topicId || null }); setTitle(''); setSituation(''); setApplied(''); setTopicId(''); }
    catch (e) { setErr((e as Error).message); }
    setSaving(false);
  };
  const remove = async (id: string) => { if (!window.confirm('Delete this entry? This cannot be undone.')) return; try { await deleteWorkApplication(uid, id); } catch (e) { setErr((e as Error).message); } };

  return (
    <div className="space-y-4">
      <PageTitle title="Applied at Work" sub="Optional: record where certification knowledge showed up in real IT work." />
      <Card title="New entry">
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label htmlFor="aw-date">Date</Label><input id="aw-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} /></div>
          <div><Label htmlFor="aw-topic">Related certification topic</Label><select id="aw-topic" value={topicId} onChange={(e) => setTopicId(e.target.value)} className={field}><option value="">None</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></div>
        </div>
        <div className="mt-3"><Label htmlFor="aw-title">Topic</Label><input id="aw-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Switch port flapping" className={field} /></div>
        <div className="mt-3"><Label htmlFor="aw-sit">Situation</Label><textarea id="aw-sit" rows={3} value={situation} onChange={(e) => setSituation(e.target.value)} className={field} /></div>
        <div className="mt-3"><Label htmlFor="aw-app">What knowledge was applied</Label><textarea id="aw-app" rows={3} value={applied} onChange={(e) => setApplied(e.target.value)} className={field} /></div>
        {err && <div className="mt-3"><ErrorState message={err} /></div>}
        <button onClick={save} disabled={saving} className={`${btnPrimary} mt-4`}>{saving ? 'Saving…' : 'Save entry'}</button>
      </Card>
      {items === null ? null : !items.length ? <EmptyState title="No entries yet" body="Add one when something you studied helps at work." /> : (
        <ul className="space-y-3">{items.map((a) => (
          <li key={a.id}><Card title={a.title} action={<span className="flex items-center gap-3 text-xs text-zinc-500">{a.date}<button onClick={() => remove(a.id)} className="text-red-400 hover:underline">Delete</button></span>}>
            {a.topicId && <div className="mb-2"><Pill tone="info">{topics.find((t) => t.id === a.topicId)?.title ?? a.topicId}</Pill></div>}
            <dl className="space-y-2 text-sm"><div><dt className="text-xs text-zinc-500">Situation</dt><dd className="whitespace-pre-wrap">{a.situation}</dd></div>
              <div><dt className="text-xs text-zinc-500">Knowledge applied</dt><dd className="whitespace-pre-wrap">{a.knowledgeApplied}</dd></div></dl></Card></li>))}</ul>)}
    </div>
  );
}
