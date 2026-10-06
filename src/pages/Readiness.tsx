import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useBlueprint } from '../lib/useBlueprint';
import { blueprintCoverage } from '../lib/blueprint';
import { savePracticeExam } from '../lib/data';
import { courseCompletion, localDateKey } from '../lib/progress';
import { topicState } from '../lib/topics';
import { Card, ErrorState, Label, PageTitle, Pill, ProgressBar, Stat, btnPrimary, field } from '../components/ui';
import type { PracticeExam } from '../types';

const PROVIDERS = ["Jeremy's IT Lab", 'Boson ExSim', 'Other'];
const PRESETS = ["Jeremy's IT Lab Practice Exam 1", "Jeremy's IT Lab Practice Exam 2", 'Boson ExSim A', 'Boson ExSim B', 'Boson ExSim C'];
const providerOf = (n: string) => (n.startsWith('Jeremy') ? PROVIDERS[0] : n.startsWith('Boson') ? PROVIDERS[1] : PROVIDERS[2]);

export default function Readiness() {
  const { user } = useAuth();
  const { activeCert, lessons, lessonsById, progress, topics, topicProgress, labsById } = useAppData();
  const { data: bp } = useBlueprint();
  const [exams, setExams] = useState<PracticeExam[]>([]);
  const [ankiDays, setAnkiDays] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const uid = user!.uid;

  useEffect(() => onSnapshot(query(collection(db, 'users', uid, 'practiceExams'), orderBy('takenOn', 'desc')),
    (s) => setExams(s.docs.map((d) => ({ id: d.id, ...d.data() }) as PracticeExam)), (e) => setErr(e.message)), [uid]);
  useEffect(() => {
    const from = new Date(Date.now() - 27 * 86400000);
    getDocs(query(collection(db, 'users', uid, 'ankiDays'), where('date', '>=', localDateKey(from)))).then((s) => setAnkiDays(s.docs.map((d) => d.id)), (e) => setErr(e.message));
  }, [uid]);

  const course = courseCompletion(lessons, progress);
  const labPct = course.labTotal ? Math.round((course.labs / course.labTotal) * 100) : 0;
  const cov = useMemo(() => (bp ? blueprintCoverage(bp.objectives, bp.mappings, lessonsById, progress) : null), [bp, lessonsById, progress]);
  const weak = topics.filter((t) => topicState(t, topicProgress.get(t.id), lessonsById, progress).status === 'needs_review');
  const scores = exams.map((e) => e.scorePercent);
  const weeks = [0, 1, 2, 3].map((w) => { const end = Date.now() - w * 7 * 86400000; const start = end - 7 * 86400000; return (ankiDays ?? []).filter((d) => { const t = new Date(d + 'T00:00:00').getTime(); return t > start && t <= end; }).length; });
  void labsById;

  return (
    <div className="space-y-4">
      <PageTitle title="Exam Readiness" sub={`${activeCert?.fullTitle ?? ''}. Individual measures only; there is no combined score or pass-probability estimate.`} />
      {err && <ErrorState message={err} />}
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Course completion"><Stat label="Jeremy's IT Lab" value={`${course.percent}%`} sub={`${course.lectures}/${course.lectureTotal} lectures`} /><div className="mt-3"><ProgressBar value={course.percent} label="Course completion" /></div></Card>
        <Card title="Lab completion"><Stat label="Labs completed" value={`${labPct}%`} sub={`${course.labs}/${course.labTotal} labs`} /><div className="mt-3"><ProgressBar value={labPct} label="Lab completion" /></div></Card>
        <Card title="Blueprint coverage">{cov ? <><Stat label="Cisco objectives covered" value={`${cov.percent}%`} sub={`${cov.covered}/${cov.total} objectives`} /><div className="mt-3"><ProgressBar value={cov.percent} label="Blueprint coverage" /></div></> : <p className="text-sm text-zinc-500">Loading…</p>}</Card>
        <Card title="Weak topics"><Stat label="Needing review" value={weak.length} sub={weak.length ? weak.slice(0, 3).map((t) => t.title).join(', ') + (weak.length > 3 ? '…' : '') : 'None right now'} /></Card>
        <Card title="Anki consistency"><Stat label="Days reviewed, last 28" value={ankiDays ? `${ankiDays.length}/28` : '…'} sub={ankiDays ? `Per week (newest first): ${weeks.join(' · ')}` : undefined} /></Card>
        <Card title="Practice exams"><Stat label="Latest score" value={scores.length ? `${scores[0]}%` : 'None yet'} sub={scores.length ? `${scores.length} taken · best ${Math.max(...scores)}%` : undefined} /></Card>
      </div>
      <ExamForm />
      <Card title="Exam results">
        {!exams.length ? <p className="text-sm text-zinc-500">No practice exams logged yet.</p> : (
          <ul className="divide-y divide-zinc-800 text-sm">{exams.map((e) => (
            <li key={e.id} className="py-3"><div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 basis-48">{e.examName}</span><span className="text-xs text-zinc-500">{e.provider} · {e.takenOn}</span><span className="text-lg font-semibold tabular-nums">{e.scorePercent}%</span></div>
              {e.missedTopicIds.length > 0 && <div className="mt-1 flex flex-wrap gap-1.5">{e.missedTopicIds.map((id) => <Pill key={id} tone="bad">{topics.find((t) => t.id === id)?.title ?? id}</Pill>)}</div>}
              {e.notes && <p className="mt-1 whitespace-pre-wrap text-zinc-400">{e.notes}</p>}</li>))}</ul>)}
      </Card>
    </div>
  );
}

function ExamForm() {
  const { user } = useAuth();
  const { activeCert, topics } = useAppData();
  const [name, setName] = useState(PRESETS[0]);
  const [provider, setProvider] = useState(providerOf(PRESETS[0]));
  const [score, setScore] = useState('');
  const [date, setDate] = useState(localDateKey());
  const [notes, setNotes] = useState('');
  const [missed, setMissed] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    const n = Number(score);
    if (!name.trim()) { setErr('Enter the exam name.'); return; }
    if (score.trim() === '' || !(n >= 0 && n <= 100)) { setErr('Score must be a percentage from 0 to 100.'); return; }
    setSaving(true); setErr(null); setMsg(null);
    try {
      await savePracticeExam(user!.uid, { certificationId: activeCert!.id, provider, examName: name.trim(), scorePercent: Math.round(n * 10) / 10, takenOn: date, notes, missedTopicIds: missed });
      setScore(''); setNotes(''); setMissed([]); setMsg('Exam saved. Missed topics were moved up in priority.');
    } catch (e) { setErr((e as Error).message); }
    setSaving(false);
  };
  return (
    <Card title="Log a practice exam">
      <div className="grid gap-3 md:grid-cols-2">
        <div><Label htmlFor="ex-name">Exam</Label><input id="ex-name" list="ex-presets" value={name} onChange={(e) => { setName(e.target.value); setProvider(providerOf(e.target.value)); }} className={field} />
          <datalist id="ex-presets">{PRESETS.map((p) => <option key={p} value={p} />)}</datalist></div>
        <div><Label htmlFor="ex-prov">Provider</Label><select id="ex-prov" value={provider} onChange={(e) => setProvider(e.target.value)} className={field}>{PROVIDERS.map((p) => <option key={p}>{p}</option>)}</select></div>
        <div><Label htmlFor="ex-score">Score (%)</Label><input id="ex-score" type="number" min="0" max="100" step="0.1" value={score} onChange={(e) => setScore(e.target.value)} className={field} /></div>
        <div><Label htmlFor="ex-date">Date taken</Label><input id="ex-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} /></div>
      </div>
      <fieldset className="mt-3"><legend className="mb-1 text-xs text-zinc-400">Missed topics</legend>
        <div className="flex flex-wrap gap-2">{topics.map((t) => { const on = missed.includes(t.id); return (
          <label key={t.id} className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs ${on ? 'border-red-800 bg-red-950 text-red-300' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}>
            <input type="checkbox" className="sr-only" checked={on} onChange={() => setMissed(on ? missed.filter((x) => x !== t.id) : [...missed, t.id])} />{t.title}</label>); })}</div></fieldset>
      <div className="mt-3"><Label htmlFor="ex-notes">Notes</Label><textarea id="ex-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={field} /></div>
      {err && <div className="mt-3"><ErrorState message={err} /></div>}
      {msg && <p role="status" className="mt-3 text-sm text-emerald-400">{msg}</p>}
      <button onClick={save} disabled={saving} className={`${btnPrimary} mt-4`}>{saving ? 'Saving…' : 'Save exam'}</button>
    </Card>
  );
}
