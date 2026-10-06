import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { saveLab } from '../lib/data';
import { fmtDur, labProg } from '../lib/progress';
import { ConfidencePicker, EmptyState, ErrorState, Label, PageTitle, Pill, btnPrimary, field } from '../components/ui';
import type { Lab, LabAssistance, LabProgress, LabStatus, Lesson } from '../types';

type Filter = 'all' | 'not_started' | 'completed' | 'needs_redo' | 'low';
const FILTERS: { v: Filter; l: string }[] = [{ v: 'all', l: 'All' }, { v: 'needs_redo', l: 'Labs to redo' }, { v: 'not_started', l: 'Not started' }, { v: 'completed', l: 'Completed' }, { v: 'low', l: 'Low confidence' }];
const STATUS_LABEL: Record<LabStatus, string> = { not_started: 'Not started', attempted: 'Attempted', completed: 'Completed', needs_redo: 'Needs redo' };
const statusOf = (p?: LabProgress): LabStatus => p?.status ?? 'not_started';
const isLow = (p?: LabProgress) => p?.confidence != null && p.confidence <= 2;
const tone = (s: LabStatus) => (s === 'completed' ? 'good' : s === 'needs_redo' ? 'bad' : s === 'attempted' ? 'warn' : 'neutral') as 'good' | 'bad' | 'warn' | 'neutral';

export default function Labs() {
  const { lessons, labsById, progress } = useAppData();
  const rows = useMemo(() => lessons.flatMap((l) => l.labIds.map((id) => ({ lesson: l, lab: labsById.get(id) })).filter((r): r is { lesson: Lesson; lab: Lab } => !!r.lab)), [lessons, labsById]);
  const redo = rows.filter((r) => statusOf(labProg(progress, r.lab.id)) === 'needs_redo').length;
  const [filter, setFilter] = useState<Filter>(redo > 0 ? 'needs_redo' : 'all');
  const [open, setOpen] = useState<string | null>(null);
  if (!rows.length) return <EmptyState title="No labs loaded" body="Run `npm run seed` to load the CCNA curriculum." />;
  const match = (r: { lab: Lab }) => {
    const p = labProg(progress, r.lab.id); const s = statusOf(p);
    return filter === 'all' || (filter === 'low' ? isLow(p) : s === filter);
  };
  const count = (f: Filter) => rows.filter((r) => { const p = labProg(progress, r.lab.id); const s = statusOf(p); return f === 'all' || (f === 'low' ? isLow(p) : s === f); }).length;
  const shown = rows.filter(match);
  return (
    <div>
      <PageTitle title="Labs" sub={`${count('completed')} of ${rows.length} completed${redo ? ` · ${redo} to redo` : ''}`} />
      <div role="tablist" aria-label="Lab filters" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.v} role="tab" aria-selected={filter === f.v} onClick={() => setFilter(f.v)}
            className={`rounded-md border px-3 py-1.5 text-sm ${filter === f.v ? 'border-sky-500 bg-sky-950 text-sky-300' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}>{f.l} <span className="tabular-nums text-zinc-500">{count(f.v)}</span></button>
        ))}
      </div>
      {!shown.length ? <EmptyState title={filter === 'needs_redo' ? 'Nothing to redo' : 'No labs match this filter'} body={filter === 'needs_redo' ? 'Labs you mark "Needs redo" appear here.' : undefined} /> : (
        <ul className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800">
          {shown.map(({ lesson, lab }) => {
            const p = labProg(progress, lab.id); const s = statusOf(p); const isOpen = open === lab.id;
            return (
              <li key={lab.id}>
                <button aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : lab.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-900">
                  <span className="w-14 shrink-0 text-xs tabular-nums text-zinc-500">{lesson.dayNumber != null ? `Day ${lesson.dayNumber}` : 'Capstone'}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm">{lab.title}</span><span className="text-xs text-zinc-500">{fmtDur(lab.durationSec)}{p?.timeSpentMin ? ` · ${p.timeSpentMin}m spent` : ''}</span></span>
                  {p?.assistance === 'independent' && <Pill tone="good">Independent</Pill>}
                  {p?.assistance === 'walkthrough' && <Pill tone="warn">Walkthrough</Pill>}
                  {p?.confidence != null && <Pill tone={p.confidence <= 2 ? 'bad' : 'neutral'}>Conf {p.confidence}/5</Pill>}
                  <Pill tone={tone(s)}>{STATUS_LABEL[s]}</Pill>
                </button>
                {isOpen && <LabEditor lab={lab} lesson={lesson} onDone={() => setOpen(null)} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LabEditor({ lab, lesson, onDone }: { lab: Lab; lesson: Lesson; onDone: () => void }) {
  const { user } = useAuth();
  const { progress } = useAppData();
  const p = labProg(progress, lab.id);
  const [status, setStatus] = useState<LabStatus>(statusOf(p));
  const [assistance, setAssistance] = useState<LabAssistance>(p?.assistance ?? null);
  const [confidence, setConfidence] = useState<number | null>(p?.confidence ?? null);
  const [time, setTime] = useState(p?.timeSpentMin != null ? String(p.timeSpentMin) : '');
  const [notes, setNotes] = useState(p?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    const t = time.trim() === '' ? null : Math.round(Number(time));
    if (t !== null && !(t >= 0 && t <= 1000)) { setErr('Time spent must be 0–1000 minutes.'); return; }
    setSaving(true); setErr(null);
    try { await saveLab(user!.uid, lab, lesson, progress, { status, assistance, confidence, timeSpentMin: t, notes }); onDone(); }
    catch (e) { setErr((e as Error).message); setSaving(false); }
  };
  return (
    <div className="space-y-3 border-t border-zinc-800 bg-zinc-900/40 px-4 py-4 text-sm">
      <div className="flex flex-wrap gap-4">
        <div><Label htmlFor={`st-${lab.id}`}>Status</Label>
          <select id={`st-${lab.id}`} value={status} onChange={(e) => setStatus(e.target.value as LabStatus)} className={field + ' !w-auto'}>
            {(Object.keys(STATUS_LABEL) as LabStatus[]).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}</select></div>
        {status === 'completed' && <div><Label htmlFor={`as-${lab.id}`}>How</Label>
          <select id={`as-${lab.id}`} value={assistance ?? ''} onChange={(e) => setAssistance((e.target.value || null) as LabAssistance)} className={field + ' !w-auto'}>
            <option value="">Not specified</option><option value="independent">Independently</option><option value="walkthrough">With walkthrough/help</option></select></div>}
        <div><Label htmlFor={`tm-${lab.id}`}>Minutes spent</Label><input id={`tm-${lab.id}`} type="number" min="0" value={time} onChange={(e) => setTime(e.target.value)} className={field + ' !w-24'} /></div>
        <div><Label>Confidence</Label><ConfidencePicker value={confidence} onChange={setConfidence} label="Lab confidence" /></div>
      </div>
      <div><Label htmlFor={`nt-${lab.id}`}>Notes</Label><textarea id={`nt-${lab.id}`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={field} /></div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
        {lab.url && <a href={lab.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">Open lab video</a>}
        {p?.attemptedAt && <span>First attempted {p.attemptedAt.toDate().toLocaleDateString()}</span>}
      </div>
      {err && <ErrorState message={err} />}
      <button onClick={save} disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Save lab'}</button>
    </div>
  );
}
