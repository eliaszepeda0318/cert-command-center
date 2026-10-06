import { addDoc, collection, deleteDoc, doc, increment, runTransaction, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { completedLectureIds, labProg, lessonProg, XP, type ProgressMap } from './progress';
import type { Lab, LabAssistance, LabProgress, LabStatus, Lesson, Topic } from '../types';

export interface LabPatch { status: LabStatus; assistance: LabAssistance; confidence: number | null; timeSpentMin: number | null; notes: string }

/** Edit a lab from the Labs page. XP is awarded once per lab ever (xpAwarded), and the day's completedAt stays in sync. */
export async function saveLab(uid: string, lab: Lab, lesson: Lesson, progress: ProgressMap, patch: LabPatch) {
  const ref = doc(db, 'users', uid, 'progress', lab.id);
  const lessonRef = doc(db, 'users', uid, 'progress', lesson.id);
  const now = Timestamp.now();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const b = snap.exists() ? (snap.data() as LabProgress) : undefined;
    const assistance = patch.status === 'completed' ? patch.assistance : null;
    const award = { lab: !!b?.xpAwarded?.lab, independent: !!b?.xpAwarded?.independent };
    let xp = 0;
    if (patch.status === 'completed' && !award.lab) { xp += XP.lab; award.lab = true; }
    if (patch.status === 'completed' && assistance === 'independent' && !award.independent) { xp += XP.labIndependent; award.independent = true; }
    tx.set(ref, {
      type: 'lab', labId: lab.id, lessonId: lesson.id, certificationId: lesson.certificationId, status: patch.status, assistance,
      confidence: patch.confidence, timeSpentMin: patch.timeSpentMin, notes: patch.notes,
      attemptedAt: b?.attemptedAt ?? (patch.status === 'not_started' ? null : now),
      completedAt: patch.status === 'completed' ? b?.completedAt ?? now : null, updatedAt: now, xpAwarded: award,
    }, { merge: true });
    const lp = lessonProg(progress, lesson.id);
    const lecturesDone = lesson.lectures.filter((l) => l.kind === 'lecture').every((l) => completedLectureIds(lesson, lp).has(l.id));
    const labsDone = lesson.labIds.every((id) => (id === lab.id ? patch.status === 'completed' : labProg(progress, id)?.status === 'completed'));
    const complete = lecturesDone && labsDone;
    if (complete && !lp?.completedAt) tx.set(lessonRef, { type: 'lesson', lessonId: lesson.id, certificationId: lesson.certificationId, completedAt: now, updatedAt: now }, { merge: true });
    if (!complete && lp?.completedAt) tx.set(lessonRef, { completedAt: null, updatedAt: now }, { merge: true });
    if (xp) tx.update(doc(db, 'users', uid), { 'stats.xp': increment(xp), updatedAt: serverTimestamp() });
  });
}

/** Free-form lesson notes (Notes page). Merges only the notes object so progress is untouched. */
export async function saveLessonNotes(uid: string, lesson: Lesson, notes: { clicked: string; confused: string; commands: string; general: string }) {
  const { setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'users', uid, 'progress', lesson.id), { type: 'lesson', lessonId: lesson.id, certificationId: lesson.certificationId, notes, updatedAt: Timestamp.now() }, { merge: true });
}

export async function saveTopicConfidence(uid: string, topic: Topic, confidence: number | null) {
  const { setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'users', uid, 'topicProgress', topic.id), { topicId: topic.id, certificationId: topic.certificationId, confidence, updatedAt: Timestamp.now() }, { merge: true });
}

export interface ExamInput { certificationId: string; provider: string; examName: string; scorePercent: number; takenOn: string; notes: string; missedTopicIds: string[] }
/** Saves an exam and bumps the denormalized miss counters on each missed topic, atomically (no reads needed). */
export async function savePracticeExam(uid: string, input: ExamInput) {
  const batch = writeBatch(db);
  const now = Timestamp.now();
  batch.set(doc(collection(db, 'users', uid, 'practiceExams')), { ...input, createdAt: now });
  for (const id of input.missedTopicIds) {
    batch.set(doc(db, 'users', uid, 'topicProgress', id), { topicId: id, certificationId: input.certificationId, missCount: increment(1), lastMissedAt: now, updatedAt: now }, { merge: true });
  }
  await batch.commit();
}

export interface WorkInput { certificationId: string; date: string; title: string; situation: string; knowledgeApplied: string; topicId: string | null }
export const saveWorkApplication = (uid: string, input: WorkInput) => addDoc(collection(db, 'users', uid, 'workApplications'), { ...input, createdAt: Timestamp.now() });
export const deleteWorkApplication = (uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'workApplications', id));
