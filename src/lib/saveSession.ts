import { collection, doc, increment, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { completedLectureIds, labProg, lessonProg, lessonState, localDateKey, requiredLectures, XP, type ProgressMap } from './progress';
import type { Lab, LabAssistance, LabStatus, Lesson } from '../types';

export interface SessionInput {
  startedAt: Timestamp; minutes: number; confidence: number | null; clicked: string; confused: string; commands: string;
  ankiDone: boolean;
  /** Lecture item ids checked this session (already-completed ones may be included; they earn no XP again). */
  lectureIds: string[];
  labs: Record<string, { status: LabStatus; assistance: LabAssistance }>;
}

/**
 * One transaction: session record, lesson/lab progress, user totals/XP.
 * It reads users/{uid}/ankiDays/{today} so Anki XP is awarded at most once per local day,
 * even if the same session is saved repeatedly or from two tabs.
 */
export async function saveSession(uid: string, lesson: Lesson, labs: Lab[], progress: ProgressMap, input: SessionInput) {
  const completedAt = Timestamp.now();
  const localDate = localDateKey(completedAt.toDate());
  const dayRef = doc(db, 'users', uid, 'ankiDays', localDate);
  const reviewRef = doc(db, 'users', uid, 'reviewDays', localDate);
  const wasComplete = lessonState(lesson, progress).complete;
  const prev = lessonProg(progress, lesson.id);
  const req = requiredLectures(lesson);

  await runTransaction(db, async (tx) => {
    const [ankiSnap, reviewSnap] = await Promise.all([tx.get(dayRef), tx.get(reviewRef)]);
    const firstAnkiToday = input.ankiDone && !ankiSnap.exists();
    // "Review session": a session on a day that was already complete, at most once per local day.
    const reviewToday = wasComplete && input.minutes > 0 && !reviewSnap.exists();
    let xp = (firstAnkiToday ? XP.anki : 0) + (reviewToday ? XP.review : 0);

    const before = completedLectureIds(lesson, prev);
    const after = new Set(before);
    for (const id of input.lectureIds) if (req.some((r) => r.id === id) && !after.has(id)) { after.add(id); xp += XP.lecture; }
    const lecturesAllDone = req.every((r) => after.has(r.id));

    let labsAllDone = true;
    const touchedLabIds: string[] = [];
    for (const lab of labs) {
      const s = input.labs[lab.id];
      const b = labProg(progress, lab.id);
      const status = s?.status ?? b?.status ?? 'not_started';
      const assistance = status === 'completed' ? s?.assistance ?? b?.assistance ?? null : null;
      if (status !== 'completed') labsAllDone = false;
      if (!s || (b?.status === status && b?.assistance === assistance)) continue;
      if (status !== 'not_started') touchedLabIds.push(lab.id);
      const award = { lab: !!b?.xpAwarded?.lab, independent: !!b?.xpAwarded?.independent };
      if (status === 'completed' && !award.lab) { xp += XP.lab; award.lab = true; }
      if (status === 'completed' && assistance === 'independent' && !award.independent) { xp += XP.labIndependent; award.independent = true; }
      tx.set(doc(db, 'users', uid, 'progress', lab.id), {
        type: 'lab', labId: lab.id, lessonId: lesson.id, certificationId: lesson.certificationId, status, assistance,
        attemptedAt: b?.attemptedAt ?? (status === 'not_started' ? null : completedAt),
        completedAt: status === 'completed' ? b?.completedAt ?? completedAt : null, updatedAt: completedAt, xpAwarded: award,
      }, { merge: true });
    }

    const complete = lecturesAllDone && labsAllDone;
    tx.set(doc(db, 'users', uid, 'progress', lesson.id), {
      type: 'lesson', lessonId: lesson.id, certificationId: lesson.certificationId,
      completedLectureIds: [...after], lectureCompleted: lecturesAllDone,
      ...(input.ankiDone ? { lastAnkiDate: localDate } : {}),
      confidence: input.confidence ?? prev?.confidence ?? null,
      timeSpentMin: increment(input.minutes),
      notes: { clicked: input.clicked, confused: input.confused, commands: input.commands, general: prev?.notes?.general ?? '' },
      completedAt: complete ? prev?.completedAt ?? completedAt : null, updatedAt: completedAt,
    }, { merge: true });

    tx.set(doc(collection(db, 'users', uid, 'studySessions')), {
      certificationId: lesson.certificationId, lessonId: lesson.id, lessonTitle: lesson.title, dayNumber: lesson.dayNumber,
      durationMin: input.minutes, activities: { anki: input.ankiDone, lecture: input.lectureIds.length > 0, labIds: touchedLabIds },
      confidence: input.confidence, notes: { clicked: input.clicked, confused: input.confused, commands: input.commands },
      startedAt: input.startedAt, completedAt, localDate,
    });
    if (firstAnkiToday) tx.set(dayRef, { date: localDate, completedAt, lessonId: lesson.id });
    if (reviewToday) tx.set(reviewRef, { date: localDate, completedAt, lessonId: lesson.id });
    tx.update(doc(db, 'users', uid), {
      'stats.xp': increment(xp), 'stats.totalStudyMinutes': increment(input.minutes),
      'stats.ankiSessions': increment(firstAnkiToday ? 1 : 0), updatedAt: serverTimestamp(),
    });
  });
}
