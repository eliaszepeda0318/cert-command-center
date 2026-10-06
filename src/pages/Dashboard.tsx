import { Link } from 'react-router-dom';
import { useAppData } from '../context/AppDataContext';
import { completedLectureIds, courseCompletion, fmtMin, labProg, labsOf, levelFromXp, lessonProg, nextLesson, requiredLectures, weeklyMinutes, XP_PER_LEVEL } from '../lib/progress';
import { topicState } from '../lib/topics';
import { Card, EmptyState, Pill, ProgressBar, Stat, btnPrimary } from '../components/ui';

export default function Dashboard() {
  const { activeCert, lessons, labsById, lessonsById, progress, sessions, profile, ankiDoneToday, topics, topicProgress } = useAppData();
  if (!profile) return null;
  if (!lessons.length) return <EmptyState title="No curriculum loaded" body="Run `npm run seed` to load the CCNA curriculum, then refresh." />;
  const c = courseCompletion(lessons, progress);
  const next = nextLesson(lessons, progress);
  const goal = profile.settings.weeklyGoalMinutes;
  const week = weeklyMinutes(sessions);
  const done = next ? completedLectureIds(next, lessonProg(progress, next.id)) : new Set<string>();
  const tasks = next ? [
    { k: 'anki', label: 'Anki review (today)', done: ankiDoneToday },
    ...requiredLectures(next).map((x) => ({ k: x.id, label: `Lecture: ${x.title}`, done: done.has(x.id) })),
    ...labsOf(next, labsById).map((l) => ({ k: l.id, label: `Lab: ${l.title}`, done: labProg(progress, l.id)?.status === 'completed' })),
  ] : [];
  const weak = topics.map((t) => ({ t, s: topicState(t, topicProgress.get(t.id), lessonsById, progress) })).filter((x) => x.s.status === 'needs_review').sort((a, b) => b.s.priority - a.s.priority).slice(0, 5);
  const xp = profile.stats.xp;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="text-xs uppercase tracking-wider text-zinc-500">{activeCert?.fullTitle}</div>
          <h1 className="text-xl font-semibold">{next ? (next.dayNumber != null ? `Day ${next.dayNumber}: ${next.title}` : next.title) : 'Course complete'}</h1></div>
        {next && <Link to="/study" className={btnPrimary}>Continue Studying</Link>}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Course completion">
          <Stat label="Jeremy's IT Lab" value={`${c.percent}%`} sub={`${c.daysDone}/${c.daysTotal} days`} /><div className="mt-3"><ProgressBar value={c.percent} label="Course completion" /></div></Card>
        <Card title="This week">
          <Stat label="Study time" value={fmtMin(week)} sub={`goal ${fmtMin(goal)}`} /><div className="mt-3"><ProgressBar value={(week / goal) * 100} label="Weekly goal" /></div></Card>
        <Card title="Totals">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Total time" value={fmtMin(profile.stats.totalStudyMinutes)} />
            <Stat label="Lecture items" value={`${c.lectures}/${c.lectureTotal}`} />
            <Stat label="Labs" value={`${c.labs}/${c.labTotal}`} />
            <Stat label="Anki sessions" value={profile.stats.ankiSessions} />
          </div></Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Today's study tasks">
          {tasks.length ? <ul className="space-y-2 text-sm">{tasks.map((t) => (
            <li key={t.k} className="flex items-center gap-2"><span aria-hidden className={`h-3 w-3 rounded-sm border ${t.done ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-600'}`} />
              <span className={t.done ? 'text-zinc-500 line-through' : ''}>{t.label}</span></li>))}</ul>
            : <p className="text-sm text-zinc-500">Nothing left. Nice work.</p>}
        </Card>
        <Card title="Weak topics" action={<Link to="/topics" className="text-xs text-sky-400 hover:underline">All topics</Link>}>
          {weak.length ? <ul className="space-y-2 text-sm">{weak.map(({ t, s }) => (
            <li key={t.id} className="flex items-center justify-between gap-2"><span className="truncate">{t.title}</span>
              <span className="flex shrink-0 gap-1.5">{s.missCount > 0 && <Pill tone="bad">Missed {s.missCount}x</Pill>}<Pill tone="bad">{s.effective != null ? `${s.effective}/5` : 'Needs review'}</Pill></span></li>))}</ul>
            : <p className="text-sm text-zinc-500">No topics need review. Rate topics 1–5 on the Topics page.</p>}</Card>
      </div>
      <Card title="Recent study activity">
        {sessions.length ? <ul className="divide-y divide-zinc-800 text-sm">{sessions.slice(0, 5).map((x) => (
          <li key={x.id} className="flex items-center justify-between gap-3 py-2"><span className="min-w-0 truncate">{x.dayNumber != null ? `Day ${x.dayNumber}: ` : ''}{x.lessonTitle}</span>
            <span className="flex shrink-0 items-center gap-2 text-zinc-500">{x.confidence && <Pill>Conf {x.confidence}/5</Pill>}{fmtMin(x.durationMin)} · {x.completedAt.toDate().toLocaleDateString()}</span></li>))}</ul>
          : <p className="text-sm text-zinc-500">No sessions yet. Start one above.</p>}
      </Card>
      <p className="text-xs text-zinc-600">Level {levelFromXp(xp)} · {xp % XP_PER_LEVEL}/{XP_PER_LEVEL} XP to next. XP never affects completion.</p>
    </div>
  );
}
