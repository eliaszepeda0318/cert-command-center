import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { saveLessonNotes } from '../lib/data';
import { labProg, lessonProg } from '../lib/progress';
import { Card, EmptyState, ErrorState, Label, PageTitle, btnGhost, btnPrimary, field } from '../components/ui';
import type { LessonNotes, Lesson } from '../types';

const FIELDS: { k: keyof LessonNotes; l: string; mono?: boolean }[] = [{ k: 'clicked', l: 'What clicked?' }, { k: 'confused', l: 'What confused me?' }, { k: 'commands', l: 'Commands worth remembering', mono: true }, { k: 'general', l: 'General notes' }];
const EMPTY: LessonNotes = { clicked: '', confused: '', commands: '', general: '' };
const dayTitle = (l: Lesson) => (l.dayNumber != null ? `Day ${l.dayNumber}: ${l.title}` : l.title);

export default function Notes() {
  const { lessons, labsById, progress } = useAppData();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const items = useMemo(() => lessons.map((lesson) => {
    const n = { ...EMPTY, ...(lessonProg(progress, lesson.id)?.notes ?? {}) };
    const labNotes = lesson.labIds.map((id) => ({ title: labsById.get(id)?.title ?? id, text: labProg(progress, id)?.notes ?? '' })).filter((x) => x.text.trim());
    return { lesson, n, labNotes, has: Object.values(n).some((v) => v.trim()) || labNotes.length > 0 };
  }), [lessons, labsById, progress]);
  const term = q.trim().toLowerCase();
  const shown = items.filter((i) => i.has && (!term || [dayTitle(i.lesson), ...Object.values(i.n), ...i.labNotes.flatMap((x) => [x.title, x.text])].join('\n').toLowerCase().includes(term)));
  if (!lessons.length) return <EmptyState title="No curriculum loaded" body="Run `npm run seed` first." />;
  return (
    <div className="space-y-4">
      <PageTitle title="Notes" sub="Lightweight notes per lesson. Session notes you save while studying appear here." />
      <div className="flex flex-wrap gap-3">
        <div className="min-w-0 flex-1 basis-60"><Label htmlFor="search">Search notes</Label><input id="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. spanning tree, show vlan" className={field} /></div>
        <div className="basis-60"><Label htmlFor="add">Add or edit notes for a lesson</Label>
          <select id="add" value={editing ?? ''} onChange={(e) => setEditing(e.target.value || null)} className={field}><option value="">Choose a lesson…</option>{lessons.map((l) => <option key={l.id} value={l.id}>{dayTitle(l)}</option>)}</select></div>
      </div>
      {editing && <Editor key={editing} lesson={lessons.find((l) => l.id === editing)!} initial={items.find((i) => i.lesson.id === editing)!.n} onClose={() => setEditing(null)} />}
      {!shown.length ? <EmptyState title={term ? 'No notes match your search' : 'No notes yet'} body={term ? undefined : 'Notes from study sessions, or ones you add above, appear here.'} /> : (
        <ul className="space-y-3">{shown.map(({ lesson, n, labNotes }) => (
          <li key={lesson.id}><Card title={dayTitle(lesson)} action={<button onClick={() => setEditing(lesson.id)} className="text-xs text-sky-400 hover:underline">Edit</button>}>
            <dl className="space-y-2 text-sm">
              {FIELDS.map((f) => n[f.k].trim() ? <div key={f.k}><dt className="text-xs text-zinc-500">{f.l}</dt><dd className={`whitespace-pre-wrap ${f.mono ? 'font-mono text-xs' : ''}`}>{n[f.k]}</dd></div> : null)}
              {labNotes.map((x) => <div key={x.title}><dt className="text-xs text-zinc-500">Lab: {x.title}</dt><dd className="whitespace-pre-wrap">{x.text}</dd></div>)}
            </dl></Card></li>))}</ul>)}
    </div>
  );
}

function Editor({ lesson, initial, onClose }: { lesson: Lesson; initial: LessonNotes; onClose: () => void }) {
  const { user } = useAuth();
  const [v, setV] = useState<LessonNotes>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => { setSaving(true); setErr(null); try { await saveLessonNotes(user!.uid, lesson, v); onClose(); } catch (e) { setErr((e as Error).message); setSaving(false); } };
  return (
    <Card title={`Editing: ${dayTitle(lesson)}`}>
      <div className="space-y-3">{FIELDS.map((f) => (
        <div key={f.k}><Label htmlFor={`n-${f.k}`}>{f.l}</Label><textarea id={`n-${f.k}`} rows={f.k === 'general' ? 4 : 2} value={v[f.k]} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} className={field + (f.mono ? ' font-mono' : '')} /></div>))}</div>
      {err && <div className="mt-3"><ErrorState message={err} /></div>}
      <div className="mt-4 flex gap-2"><button onClick={save} disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Save notes'}</button><button onClick={onClose} className={btnGhost}>Cancel</button></div>
    </Card>
  );
}
