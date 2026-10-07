import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { completedLectureIds, fmtDur, labProg, labsOf, lessonProg, lessonState, nextLesson, requiredLectures } from '../lib/progress';
import { saveSession } from '../lib/saveSession';
import { Card, EmptyState, ErrorState, ExtLink, Pill, btnGhost, btnPrimary } from '../components/ui';
import { Timestamp } from 'firebase/firestore';
import type { LabAssistance, LabStatus, Lesson } from '../types';

const STATUS: { v: LabStatus; l: string }[] = [
  { v: 'not_started', l: 'Not started' }, { v: 'attempted', l: 'Attempted' }, { v: 'completed', l: 'Completed' }, { v: 'needs_redo', l: 'Needs redo' }];
const ta = 'w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm';

export default function Study() {
  const { lessonId } = useParams();
  const { lessons, lessonsById, progress } = useAppData();
  const lesson = lessonId ? lessonsById.get(lessonId) : nextLesson(lessons, progress);
  if (!lessons.length) return <EmptyState title="No curriculum loaded" body="Run `npm run seed` first." />;
  if (!lesson) return <EmptyState title={lessonId ? 'Lesson not found' : 'You are all caught up'} body="Every day in this course is complete." />;
  return <Session key={lesson.id} lesson={lesson} />;
}

function Session({ lesson }: { lesson: Lesson }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const { labsById, progress, course, ankiDoneToday } = useAppData();
  const labs = useMemo(() => labsOf(lesson, labsById), [lesson, labsById]);
  const state = lessonState(lesson, progress);
  const prev = lessonProg(progress, lesson.id);
  const [startedAt, setStartedAt] = useState<Timestamp | null>(null); // real start time, set when Start is clicked
  const [anki, setAnki] = useState(false);
  const doneLecs = useMemo(() => completedLectureIds(lesson, prev), [lesson, prev]);
  const [checkedLecs, setCheckedLecs] = useState<Set<string>>(new Set());
  const started = startedAt !== null;
  const [labState, setLabState] = useState<Record<string, { status: LabStatus; assistance: LabAssistance }>>(
    () => Object.fromEntries(labs.map((l) => { const p = labProg(progress, l.id); return [l.id, { status: p?.status ?? 'not_started', assistance: p?.assistance ?? null }]; })));
  const [minutes, setMinutes] = useState('30');
  const [conf, setConf] = useState<number | null>(prev?.confidence ?? null);
  const [clicked, setClicked] = useState(prev?.notes?.clicked ?? '');
  const [confused, setConfused] = useState(prev?.notes?.confused ?? '');
  const [commands, setCommands] = useState(prev?.notes?.commands ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const lecs = requiredLectures(lesson);
  const academy = [...lesson.lectures.map((x) => ({ id: x.id, title: x.title, academyUrl: x.academyUrl, kind: 'lecture' })), ...labs.map((x) => ({ id: x.id, title: x.title, academyUrl: x.academyUrl, kind: 'lab' }))].filter((x) => x.academyUrl);
  const extras = lesson.lectures.filter((l) => l.kind === 'extra');
  const title = lesson.dayNumber != null ? `Day ${lesson.dayNumber}: ${lesson.title}` : lesson.title;

  const save = async () => {
    const m = Math.round(Number(minutes));
    if (!(m >= 0 && m <= 600)) { setErr('Enter minutes studied (0–600).'); return; }
    setSaving(true); setErr(null);
    try {
      await saveSession(user!.uid, lesson, labs, progress, { startedAt: startedAt ?? Timestamp.now(), minutes: m, confidence: conf, clicked, confused, commands, ankiDone: anki && !ankiDoneToday, lectureIds: [...checkedLecs], labs: labState });
      nav('/');
    } catch (e) { setErr((e as Error).message); setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div><Link to="/roadmap" className="text-xs text-zinc-500 hover:text-zinc-300">← Roadmap</Link>
        <h1 className="mt-1 text-xl font-semibold">{title}</h1>
        {lesson.altTitles.map((a) => <p key={a.source} className="text-xs text-zinc-500">Also titled “{a.title}” ({a.source})</p>)}</div>

      {!started ? (
        <Card>
          <p className="text-sm text-zinc-400">{state.complete ? 'This day is complete. You can still log a review session.' : 'Order: Anki review, lecture, lab, then a quick wrap-up.'}</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li className="flex items-center gap-2"><span aria-hidden className={`h-3 w-3 shrink-0 rounded-sm border ${ankiDoneToday ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-600'}`} />Anki review (today)</li>
            {lecs.map((x) => <li key={x.id} className="flex items-center gap-2"><span aria-hidden className={`h-3 w-3 shrink-0 rounded-sm border ${doneLecs.has(x.id) ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-600'}`} /><span className="min-w-0 flex-1 truncate">Lecture: {x.title}</span><span className="text-xs tabular-nums text-zinc-500">{fmtDur(x.durationSec)}</span></li>)}
            {labs.map((l) => { const st = labProg(progress, l.id)?.status; return <li key={l.id} className="flex items-center gap-2"><span aria-hidden className={`h-3 w-3 shrink-0 rounded-sm border ${st === 'completed' ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-600'}`} /><span className="min-w-0 flex-1 truncate">{st === 'needs_redo' ? 'Redo lab' : 'Lab'}: {l.title}</span><span className="text-xs tabular-nums text-zinc-500">{fmtDur(l.durationSec)}</span></li>; })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => setStartedAt(Timestamp.now())} className={btnPrimary}>Start Today’s Session</button>
            {course?.playlistUrl && <a href={course.playlistUrl} target="_blank" rel="noreferrer" className={btnGhost}>Free YouTube playlist</a>}</div>
        </Card>
      ) : (
        <>
          <Card title="1. Anki review">
            {ankiDoneToday
              ? <p className="text-sm text-emerald-400">Anki already done today. Saving again earns no extra Anki XP.</p>
              : <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={anki} onChange={(e) => setAnki(e.target.checked)} className="h-4 w-4" />Anki review done today</label>}
            {extras.map((x) => <p key={x.id} className="mt-2 text-xs text-zinc-500">Extra: {x.title} ({fmtDur(x.durationSec)})</p>)}
          </Card>
          {lecs.length > 0 && (
            <Card title="2. Lecture">
              <ul className="space-y-2 text-sm">{lecs.map((x) => {
                const already = doneLecs.has(x.id);
                return (
                  <li key={x.id} className="flex flex-wrap items-center gap-2">
                    <input type="checkbox" aria-label={`${x.title} completed`} className="h-4 w-4" checked={already || checkedLecs.has(x.id)} disabled={already}
                      onChange={(e) => { const n = new Set(checkedLecs); if (e.target.checked) n.add(x.id); else n.delete(x.id); setCheckedLecs(n); }} />
                    <span>{x.title}</span>
                    {x.freeYoutubeUrl ? <ExtLink href={x.freeYoutubeUrl}>Watch on YouTube</ExtLink> : <Pill tone="warn">No verified video</Pill>}
                    <span className="text-zinc-500">{fmtDur(x.durationSec)}</span>
                    {x.ccnaV11Addition === true && <Pill tone="info">v1.1</Pill>}
                    {x.reviewFlags.length > 0 && <Pill tone="warn">Needs review</Pill>}
                    {already && <span className="text-xs text-zinc-500">recorded</span>}</li>);})}</ul>
              <p className="mt-2 text-xs text-zinc-600">Videos open on Jeremy's free YouTube course.</p>
            </Card>)}
          {labs.length > 0 && (
            <Card title="3. Packet Tracer lab">
              <ul className="space-y-3">{labs.map((l) => {
                const s = labState[l.id];
                return (
                  <li key={l.id} className="text-sm">
                    <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>{l.title}</span>
                      {l.freeYoutubeUrl ? <ExtLink href={l.freeYoutubeUrl}>Open Lab Video</ExtLink> : <Pill tone="warn">No verified video</Pill>}
                      {l.labFilesUrl && l.labFilesAccess === 'free' && <ExtLink href={l.labFilesUrl}>Get Free Lab Files</ExtLink>}
                      <span className="text-zinc-500">{fmtDur(l.durationSec)}</span>
                      {l.youtubeVerification === 'needs_review' && <Pill tone="warn">Needs review</Pill>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select aria-label={`${l.title} status`} value={s.status} onChange={(e) => setLabState({ ...labState, [l.id]: { ...s, status: e.target.value as LabStatus } })} className={ta + ' !w-auto'}>
                        {STATUS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
                      {s.status === 'completed' && (
                        <select aria-label={`${l.title} assistance`} value={s.assistance ?? ''} onChange={(e) => setLabState({ ...labState, [l.id]: { ...s, assistance: (e.target.value || null) as LabAssistance } })} className={ta + ' !w-auto'}>
                          <option value="">Independence not set</option><option value="independent">Independently</option><option value="walkthrough">With walkthrough/help</option></select>)}
                    </div></li>);})}</ul>
            </Card>)}
          {academy.length > 0 && (
            <details className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-2 text-xs text-zinc-500">
              <summary className="cursor-pointer hover:text-zinc-300">JITL Academy extras (optional, paid; never required)</summary>
              <ul className="mt-2 space-y-1">{academy.map((a) => <li key={a.id}><ExtLink href={a.academyUrl!} muted>{a.kind === 'lab' ? 'JITL Academy extra' : 'JITL Academy version'}: {a.title}</ExtLink></li>)}</ul>
            </details>)}
          <Card title="4. Wrap-up">
            <div className="space-y-3 text-sm">
              <div><label htmlFor="min" className="block text-zinc-400">Minutes studied</label>
                <input id="min" type="number" min="0" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={ta + ' mt-1 !w-28'} /></div>
              <fieldset><legend className="text-zinc-400">Confidence</legend>
                <div className="mt-1 flex gap-2">{[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-pressed={conf === n} onClick={() => setConf(n)}
                    className={`h-9 w-9 rounded-md border text-sm ${conf === n ? 'border-sky-500 bg-sky-950 text-sky-300' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}>{n}</button>))}</div></fieldset>
              <div><label htmlFor="c1" className="text-zinc-400">What clicked?</label><textarea id="c1" rows={2} value={clicked} onChange={(e) => setClicked(e.target.value)} className={ta + ' mt-1'} /></div>
              <div><label htmlFor="c2" className="text-zinc-400">What was confusing?</label><textarea id="c2" rows={2} value={confused} onChange={(e) => setConfused(e.target.value)} className={ta + ' mt-1'} /></div>
              <div><label htmlFor="c3" className="text-zinc-400">Commands or concepts worth remembering</label><textarea id="c3" rows={2} value={commands} onChange={(e) => setCommands(e.target.value)} className={ta + ' mt-1 font-mono'} /></div>
            </div>
            {err && <div className="mt-3"><ErrorState message={err} /></div>}
            <button onClick={save} disabled={saving} className={`${btnPrimary} mt-4`}>{saving ? 'Saving…' : 'Save session'}</button>
          </Card>
        </>
      )}
    </div>
  );
}
