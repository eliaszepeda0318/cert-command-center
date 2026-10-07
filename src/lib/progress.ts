import type { Lab, Lesson, LabProgress, LessonProgress, ProgressDoc, StudySession } from '../types';

export type ProgressMap = Map<string, ProgressDoc>;
export const XP = { lecture: 25, lab: 40, anki: 10, labIndependent: 10, review: 10 } as const;
export const XP_PER_LEVEL = 500;
export const levelFromXp = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1;

export const lessonProg = (m: ProgressMap, id: string) => { const p = m.get(id); return p?.type === 'lesson' ? (p as LessonProgress) : undefined; };
export const labProg = (m: ProgressMap, id: string) => { const p = m.get(id); return p?.type === 'lab' ? (p as LabProgress) : undefined; };
export const isLabDone = (p?: LabProgress) => p?.status === 'completed';

export const requiredLectures = (l: Lesson) => l.lectures.filter((x) => x.kind === 'lecture');
/** Completed lecture ids. Legacy docs with only `lectureCompleted: true` count as all required lectures done. */
export function completedLectureIds(lesson: Lesson, lp?: LessonProgress): Set<string> {
  if (!lp) return new Set();
  if (lp.completedLectureIds) return new Set(lp.completedLectureIds);
  return lp.lectureCompleted ? new Set(requiredLectures(lesson).map((x) => x.id)) : new Set();
}
export const localDateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface LessonState {
  needsLecture: boolean; lectureDone: boolean; lecturesDone: number; lecturesTotal: number; labsDone: number; labsTotal: number;
  /** Strictly complete: every required lecture done and every lab `completed`. Used for mastery/readiness metrics. */
  complete: boolean;
  /** All required new content is finished: lectures done and every lab attempted through to `completed` or `needs_redo`. Drives the study path. */
  newContentDone: boolean;
  /** Ids of labs flagged `needs_redo`; they live in the review queue, not the daily path. */
  redoLabIds: string[];
  started: boolean; unitsDone: number; unitsTotal: number;
}
/** A day is complete only when every required lecture item and every lab is complete. Anki is a daily task, not part of completion. */
export function lessonState(lesson: Lesson, m: ProgressMap): LessonState {
  const lp = lessonProg(m, lesson.id);
  const req = requiredLectures(lesson);
  const done = completedLectureIds(lesson, lp);
  const lecturesDone = req.filter((x) => done.has(x.id)).length;
  const lecturesTotal = req.length;
  const labsTotal = lesson.labIds.length;
  const labs = lesson.labIds.map((id) => labProg(m, id));
  const labsDone = labs.filter(isLabDone).length;
  const lectureDone = lecturesDone === lecturesTotal;
  const complete = lectureDone && labsDone === labsTotal;
  const redoLabIds = lesson.labIds.filter((id) => labProg(m, id)?.status === 'needs_redo');
  const newContentDone = lectureDone && labs.every((l) => l?.status === 'completed' || l?.status === 'needs_redo');
  const started = lecturesDone > 0 || labs.some((l) => l && l.status !== 'not_started');
  return { needsLecture: lecturesTotal > 0, lectureDone, lecturesDone, lecturesTotal, labsDone, labsTotal, complete, newContentDone, redoLabIds, started,
    unitsDone: lecturesDone + labsDone, unitsTotal: lecturesTotal + labsTotal };
}

/** Next study day = first day with unfinished NEW required content. Redo labs don't hold the path; see `redoQueue`. */
export const nextLesson = (lessons: Lesson[], m: ProgressMap) => lessons.find((l) => !lessonState(l, m).newContentDone);

/** Review queue: labs marked needs_redo, in course order. Still counted as incomplete in lab/readiness metrics. */
export function redoQueue(lessons: Lesson[], labsById: Map<string, Lab>, m: ProgressMap) {
  return lessons.flatMap((lesson) => lesson.labIds.filter((id) => labProg(m, id)?.status === 'needs_redo').map((id) => ({ lesson, lab: labsById.get(id) })))
    .filter((x): x is { lesson: Lesson; lab: Lab } => !!x.lab);
}

export function courseCompletion(lessons: Lesson[], m: ProgressMap) {
  let done = 0, total = 0, daysDone = 0, lectures = 0, lectureTotal = 0, labs = 0, labTotal = 0;
  for (const l of lessons) {
    const s = lessonState(l, m);
    done += s.unitsDone; total += s.unitsTotal; if (s.complete) daysDone++;
    lectureTotal += s.lecturesTotal; lectures += s.lecturesDone;
    labTotal += s.labsTotal; labs += s.labsDone;
  }
  return { percent: total ? Math.round((done / total) * 100) : 0, daysDone, daysTotal: lessons.length, lectures, lectureTotal, labs, labTotal };
}

export function startOfWeek(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}
export function weeklyMinutes(sessions: StudySession[], now = new Date()) {
  const start = startOfWeek(now).getTime();
  return sessions.filter((s) => s.completedAt.toMillis() >= start).reduce((a, s) => a + s.durationMin, 0);
}
export const labsOf = (lesson: Lesson, byId: Map<string, Lab>) => lesson.labIds.map((id) => byId.get(id)).filter((x): x is Lab => !!x);
export const fmtDur = (sec: number | null) => (sec == null ? '' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
export const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
