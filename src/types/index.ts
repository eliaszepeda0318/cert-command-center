import type { Timestamp } from 'firebase/firestore';

// ---------- Shared reference data (read-only for clients; written by seed script) ----------
export type CertStatus = 'active' | 'coming_later';
export interface Certification { id: string; title: string; fullTitle: string; status: CertStatus; order: number; activeBlueprintId: string | null }
export interface Course { id: string; certificationId: string; title: string; playlistUrl: string | null; lessonCount: number; labCount: number; contentVersion: string }

export interface LectureItem {
  id: string; title: string; kind: 'lecture' | 'extra'; durationSec: number | null;
  url: string | null; youtubeUrl: string | null; ccnaV11Addition: boolean | null; notes?: string; reviewFlags: string[];
}
/** A "study day". Stable id e.g. ccna-jeremy-day-01. */
export interface Lesson {
  id: string; certificationId: string; courseId: string; moduleId: string | null; order: number;
  dayNumber: number | null; title: string; altTitles: { source: string; title: string }[];
  lectures: LectureItem[]; labIds: string[]; reviewFlags: string[];
}
export interface Lab {
  id: string; lessonId: string; courseId: string; certificationId: string; order: number; title: string;
  kind: string; durationSec: number | null; url: string | null; youtubeUrl: string | null; downloadUrl: string | null; reviewFlags: string[];
}

// ---------- Personal data: users/{uid}/... ----------
export interface UserProfile {
  displayName: string | null; email: string | null; photoURL: string | null;
  settings: { weeklyGoalMinutes: number; activeCertificationId: string };
  stats: { xp: number; totalStudyMinutes: number; ankiSessions: number };
  createdAt: Timestamp; updatedAt: Timestamp;
}
export interface LessonNotes { clicked: string; confused: string; commands: string; general: string }
/** users/{uid}/progress/{lessonId} */
export interface LessonProgress {
  type: 'lesson'; lessonId: string; certificationId: string;
  /** Authoritative: stable lecture item ids completed. */
  completedLectureIds?: string[];
  /** Legacy (Stage 1): whole-day boolean. Read as "all required lectures done" when completedLectureIds is absent. Still written as a derived value. */
  lectureCompleted?: boolean;
  /** Metadata only (last local date Anki was reviewed on this lesson). Daily Anki status lives in users/{uid}/ankiDays. */
  lastAnkiDate?: string;
  /** Legacy (Stage 1), ignored. */
  ankiCompleted?: boolean;
  confidence: number | null; timeSpentMin: number; notes: LessonNotes; completedAt: Timestamp | null; updatedAt: Timestamp;
}
export type LabStatus = 'not_started' | 'attempted' | 'completed' | 'needs_redo';
export type LabAssistance = 'independent' | 'walkthrough' | null;
/** users/{uid}/progress/{labId} */
export interface LabProgress {
  type: 'lab'; labId: string; lessonId: string; certificationId: string; status: LabStatus; assistance: LabAssistance;
  confidence: number | null; timeSpentMin: number | null; notes: string;
  attemptedAt: Timestamp | null; completedAt: Timestamp | null; updatedAt: Timestamp;
}
export type ProgressDoc = LessonProgress | LabProgress;

/** users/{uid}/studySessions/{autoId} */
export interface StudySession {
  id: string; certificationId: string; lessonId: string; lessonTitle: string; dayNumber: number | null;
  durationMin: number; activities: { anki: boolean; lecture: boolean; labIds: string[] };
  confidence: number | null; notes: Omit<LessonNotes, 'general'>;
  /** When "Start Today's Session" was clicked. */
  startedAt: Timestamp;
  /** When the session was saved; used for weekly/monthly bucketing and ordering. */
  completedAt: Timestamp;
  /** Local calendar date (YYYY-MM-DD) of completion. */
  localDate: string;
}
/** users/{uid}/ankiDays/{YYYY-MM-DD}: existence = Anki done that local day (also the XP guard). */
export interface AnkiDay { date: string; completedAt: Timestamp; lessonId: string }
