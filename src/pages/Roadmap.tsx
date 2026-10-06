import { Link } from 'react-router-dom';
import { useAppData } from '../context/AppDataContext';
import { courseCompletion, fmtDur, lessonState, nextLesson } from '../lib/progress';
import { Card, EmptyState, Pill, ProgressBar } from '../components/ui';

export default function Roadmap() {
  const { lessons, progress, course } = useAppData();
  if (!lessons.length) return <EmptyState title="No curriculum loaded" body="Run `npm run seed` to load the CCNA curriculum." />;
  const c = courseCompletion(lessons, progress);
  const next = nextLesson(lessons, progress);
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">Roadmap</h1><p className="text-sm text-zinc-500">{course?.title}</p></div>
      <Card>
        <div className="mb-2 flex justify-between text-sm"><span>{c.daysDone} of {c.daysTotal} days complete</span><span className="tabular-nums">{c.percent}%</span></div>
        <ProgressBar value={c.percent} label="Course completion" />
      </Card>
      <ul className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800">
        {lessons.map((l) => {
          const s = lessonState(l, progress);
          const mins = l.lectures.filter((x) => x.kind === 'lecture').reduce((a, x) => a + (x.durationSec ?? 0), 0);
          const isNext = next?.id === l.id;
          return (
            <li key={l.id}>
              <Link to={`/study/${l.id}`} className={`flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 ${isNext ? 'bg-sky-950/30' : ''}`}>
                <span className="w-14 shrink-0 text-xs tabular-nums text-zinc-500">{l.dayNumber != null ? `Day ${l.dayNumber}` : 'Capstone'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-100">{l.title}</span>
                  <span className="text-xs text-zinc-500">{mins ? `${fmtDur(mins)} lecture` : 'Lab only'}{s.labsTotal ? ` · ${s.labsDone}/${s.labsTotal} labs` : ''}</span>
                </span>
                {l.reviewFlags.length > 0 && <Pill tone="warn">Review</Pill>}
                {isNext && <Pill tone="info">Next</Pill>}
                {s.complete ? <Pill tone="good">Complete</Pill> : s.started ? <Pill tone="warn">In progress</Pill> : <Pill>Not started</Pill>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
