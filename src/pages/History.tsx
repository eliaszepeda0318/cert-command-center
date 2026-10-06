import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, startAfter, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { fmtMin, startOfWeek } from '../lib/progress';
import { Card, EmptyState, ErrorState, PageTitle, Pill, Spinner, Stat, btnGhost } from '../components/ui';
import type { StudySession } from '../types';

const PAGE = 20;
export default function History() {
  const { user } = useAuth();
  const { sessions, profile, activeCert } = useAppData();
  const [rows, setRows] = useState<StudySession[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // The full history is paged on its own query (separate from the Dashboard's 35-day window).
  const load = useCallback(async (after: QueryDocumentSnapshot | null) => {
    setLoading(true); setErr(null);
    try {
      const base = collection(db, 'users', user!.uid, 'studySessions');
      const snap = await getDocs(after ? query(base, orderBy('completedAt', 'desc'), startAfter(after), limit(PAGE)) : query(base, orderBy('completedAt', 'desc'), limit(PAGE)));
      setRows((r) => [...(after ? r : []), ...snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudySession)]);
      setCursor(snap.docs[snap.docs.length - 1] ?? after); setMore(snap.docs.length === PAGE);
    } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, [user]);
  useEffect(() => { void load(null); }, [load]);

  // Week/month totals come from the 35-day window the Dashboard already holds (covers this month and last week).
  const now = new Date(); const wk = startOfWeek(now).getTime(); const prevWk = wk - 7 * 86400000; const mo = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const sum = (from: number, to = Infinity) => sessions.filter((s) => s.completedAt.toMillis() >= from && s.completedAt.toMillis() < to).reduce((a, s) => a + s.durationMin, 0);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <PageTitle title="History" sub={activeCert?.fullTitle} />
      <Card><div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="This week" value={fmtMin(sum(wk))} /><Stat label="Previous week" value={fmtMin(sum(prevWk, wk))} />
        <Stat label="This month" value={fmtMin(sum(mo))} /><Stat label="Total" value={fmtMin(profile?.stats.totalStudyMinutes ?? 0)} />
      </div></Card>
      {err && <ErrorState message={err} />}
      {!rows.length && !loading && !err ? <EmptyState title="No sessions yet" body="Saved study sessions appear here." /> : (
        <ul className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800">
          {rows.map((s) => {
            const isOpen = open === s.id; const n = s.notes;
            const acts = [s.activities.anki && 'Anki', s.activities.lecture && 'Lecture', s.activities.labIds.length > 0 && `${s.activities.labIds.length} lab${s.activities.labIds.length > 1 ? 's' : ''}`].filter(Boolean) as string[];
            return (
              <li key={s.id}>
                <button aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-zinc-900">
                  <span className="w-24 shrink-0 text-xs tabular-nums text-zinc-500">{s.completedAt.toDate().toLocaleDateString()}</span>
                  <span className="min-w-0 flex-1 basis-40 truncate text-sm">{s.dayNumber != null ? `Day ${s.dayNumber}: ` : ''}{s.lessonTitle}</span>
                  {acts.map((a) => <Pill key={a}>{a}</Pill>)}
                  {s.confidence != null && <Pill>Conf {s.confidence}/5</Pill>}
                  <span className="text-sm tabular-nums text-zinc-300">{fmtMin(s.durationMin)}</span>
                </button>
                {isOpen && (
                  <dl className="space-y-2 border-t border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm">
                    <div className="text-xs text-zinc-500">{s.certificationId} · started {s.startedAt.toDate().toLocaleTimeString()} · saved {s.completedAt.toDate().toLocaleTimeString()}</div>
                    {([['What clicked', n.clicked], ['What was confusing', n.confused], ['Worth remembering', n.commands]] as const).map(([k, v]) => v ? <div key={k}><dt className="text-xs text-zinc-500">{k}</dt><dd className="whitespace-pre-wrap">{v}</dd></div> : null)}
                    {!n.clicked && !n.confused && !n.commands && <div className="text-zinc-500">No notes on this session.</div>}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {loading && <Spinner />}
      {more && !loading && rows.length > 0 && <button onClick={() => load(cursor)} className={btnGhost}>Load older sessions</button>}
    </div>
  );
}
