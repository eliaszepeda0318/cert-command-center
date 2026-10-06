import { useMemo, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { useBlueprint } from '../lib/useBlueprint';
import { blueprintCoverage, type ObjStatus, type Unit } from '../lib/blueprint';
import { courseCompletion } from '../lib/progress';
import { Card, EmptyState, ErrorState, PageTitle, Pill, ProgressBar, Spinner, Stat } from '../components/ui';

const LABEL: Record<ObjStatus, string> = { covered: 'Covered', partial: 'In progress', not_started: 'Not started', no_content: 'No mapped content' };
const TONE: Record<ObjStatus, 'good' | 'warn' | 'neutral' | 'bad'> = { covered: 'good', partial: 'warn', not_started: 'neutral', no_content: 'bad' };
const fmtDate = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null);

export default function Blueprint() {
  const { lessons, lessonsById, labsById, progress } = useAppData();
  const { data, loading, error, hasBlueprint } = useBlueprint();
  const [gapsOnly, setGapsOnly] = useState(false);
  const cov = useMemo(() => (data ? blueprintCoverage(data.objectives, data.mappings, lessonsById, progress) : null), [data, lessonsById, progress]);
  if (loading) return <Spinner label="Loading blueprint" />;
  if (error) return <ErrorState message={error} />;
  if (!hasBlueprint || !data || !cov) return <EmptyState title="No blueprint for this certification" body="Run `npm run seed` after adding blueprint seed files." />;
  const { blueprint: bp } = data;
  const course = courseCompletion(lessons, progress);
  const title = (u: Unit) => (u.kind === 'lab' ? labsById.get(u.itemId)?.title : lessonsById.get(u.lessonId)?.lectures.find((l) => l.id === u.itemId)?.title) ?? u.itemId;
  const dayOf = (u: Unit) => { const d = lessonsById.get(u.lessonId)?.dayNumber; return d != null ? `Day ${d}` : 'Capstone'; };
  const gaps = cov.rows.filter((r) => r.status !== 'covered');
  const list = gapsOnly ? gaps : cov.rows;
  return (
    <div className="space-y-4">
      <PageTitle title="Blueprint" sub={`${bp.title} · official Cisco exam topics`} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Jeremy course completion"><Stat label="Lectures and labs finished" value={`${course.percent}%`} sub={`${course.daysDone}/${course.daysTotal} study days`} /><div className="mt-3"><ProgressBar value={course.percent} label="Jeremy course completion" /></div></Card>
        <Card title="Cisco blueprint coverage"><Stat label="Objectives fully covered" value={`${cov.percent}%`} sub={`${cov.covered}/${cov.total} objectives`} /><div className="mt-3"><ProgressBar value={cov.percent} label="Blueprint coverage" /></div></Card>
      </div>
      <p className="text-xs text-zinc-500">These are separate measures and are never combined. An objective counts as covered only when every high-confidence lecture and lab mapped to it is complete; tentative mappings never count.
        {bp.retiresOn && <> {bp.version} is the active exam through {fmtDate(bp.retiresOn)}{bp.nextVersionStartsOn ? `; v2.0 begins ${fmtDate(bp.nextVersionStartsOn)}` : ''}. v2.0 will be a separate blueprint so this progress is preserved.</>}</p>

      <Card title="Domains">
        <ul className="space-y-3">{bp.domains.map((d) => { const x = cov.byDomain[d.code] ?? { covered: 0, total: 0 }; return (
          <li key={d.id}><div className="mb-1 flex justify-between text-sm"><span>{d.code}.0 {d.title} <span className="text-zinc-500">· {d.weight}% of exam</span></span><span className="tabular-nums text-zinc-400">{x.covered}/{x.total}</span></div>
            <ProgressBar value={x.total ? (x.covered / x.total) * 100 : 0} label={`${d.title} coverage`} /></li>); })}</ul>
      </Card>

      <Card title={`Coverage gaps (${gaps.length})`}>
        <details>
        <summary className="cursor-pointer text-sm text-zinc-400 hover:text-zinc-200">{gaps.length ? `${gaps.filter((g) => g.status === 'no_content').length} objectives have no mapped content; ${gaps.filter((g) => g.status !== 'no_content').length} have content still to finish. Show details` : 'None'}</summary>
        <div className="mt-3">
        {!gaps.length ? <p className="text-sm text-emerald-400">Every objective is covered by completed content.</p> : (
          <ul className="divide-y divide-zinc-800 text-sm">{gaps.map((r) => (
            <li key={r.objective.id} className="py-2">
              <div className="flex flex-wrap items-center gap-2"><span className="w-10 shrink-0 tabular-nums text-zinc-500">{r.objective.code}</span><span className="min-w-0 flex-1 basis-56">{r.objective.text}</span><Pill tone={TONE[r.status]}>{LABEL[r.status]}</Pill></div>
              <div className="ml-12 mt-1 text-xs text-zinc-500">
                {r.status === 'no_content' ? (r.tentative.length ? `Only tentative (needs review) content: ${r.tentative.slice(0, 3).map(title).join('; ')}${r.tentative.length > 3 ? '…' : ''}` : 'No Jeremy lesson or lab is mapped to this objective. Plan other study for it.')
                  : `Remaining: ${r.high.filter((u) => !u.done).map((u) => `${dayOf(u)} ${title(u)}`).join('; ')}`}</div>
            </li>))}</ul>)}
        </div></details>
      </Card>

      <div className="flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Objectives</h2>
        <label className="flex items-center gap-2 text-sm text-zinc-400"><input type="checkbox" checked={gapsOnly} onChange={(e) => setGapsOnly(e.target.checked)} className="h-4 w-4" />Gaps only</label></div>
      <ul className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800">
        {list.map((r) => (
          <li key={r.objective.id}>
            <details className="group">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 hover:bg-zinc-900">
                <span className="w-10 shrink-0 text-xs tabular-nums text-zinc-500">{r.objective.code}</span>
                <span className="min-w-0 flex-1 basis-56 text-sm">{r.objective.text}</span>
                {r.objective.v11Change && <Pill tone="info">{r.objective.v11Change === 'added' ? 'New in v1.1' : 'Changed in v1.1'}</Pill>}
                <span className="text-xs tabular-nums text-zinc-500">{r.high.length ? `${r.done}/${r.high.length}` : ''}</span>
                <Pill tone={TONE[r.status]}>{LABEL[r.status]}</Pill>
              </summary>
              <div className="space-y-2 border-t border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm">
                {r.objective.changeNote && <p className="text-xs text-sky-300">{r.objective.changeNote}</p>}
                {r.subs.length > 0 && <ul className="list-disc pl-5 text-zinc-400">{r.subs.map((s) => <li key={s.id}><span className="tabular-nums text-zinc-500">{s.code}</span> {s.text}</li>)}</ul>}
                {[...r.high, ...r.tentative].length ? (
                  <ul className="space-y-1">{[...r.high, ...r.tentative].map((u) => (
                    <li key={u.itemId} className="flex flex-wrap items-center gap-2"><span aria-hidden className={`h-3 w-3 rounded-sm border ${u.done ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-600'}`} />
                      <span className="text-zinc-500">{dayOf(u)}</span><span>{title(u)}</span><Pill>{u.kind}</Pill>{u.confidence === 'needs_review' && <Pill tone="warn">Tentative</Pill>}</li>))}</ul>
                ) : <p className="text-zinc-500">No Jeremy content mapped.</p>}
              </div>
            </details>
          </li>))}
      </ul>
      {bp.reviewFlags.length > 0 && <details className="text-xs text-zinc-500"><summary className="cursor-pointer">Data source notes</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">{bp.reviewFlags.map((f) => <li key={f}>{f}</li>)}<li><a href={bp.sourceUrl} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">Cisco exam topics PDF</a> · <a href={bp.releaseNotesUrl} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">Cisco v1.1 release notes</a></li></ul></details>}
    </div>
  );
}
