import type { Timestamp } from 'firebase/firestore';

// ---------- Shared reference data (read-only for clients; written by seed script) ----------
export type CertStatus = 'active' | 'coming_later';
export interface Certification { id: string; title: string; fullTitle: string; status: CertStatus; order: number; activeBlueprintId: string | null }
/** free = usable without paying; paid_optional = supplemental, NEVER required for progression; unverified = could not confirm. */
export type ResourceAccess = 'free' | 'paid_optional' | 'unverified';
export type SourceType = 'youtube_free' | 'academy_only';
export interface FreeResource { id: string; title: string; url: string; access: ResourceAccess; note: string | null; verifiedFrom: string }
export interface Course {
  id: string; certificationId: string; title: string; playlistUrl: string | null; lessonCount: number; labCount: number; contentVersion: string;
  /** Canonical study source for this course. */
  primarySource?: SourceType; freeResources?: FreeResource[];
}
/** Fields shared by lectures and lab videos. The free YouTube video is primary; Academy (Teachable) data is optional metadata. */
export interface StudyResource {
  /** Exact free YouTube video URL (null only if no free video could be verified). */
  freeYoutubeUrl: string | null; youtubeVideoId?: string | null; youtubeTitle?: string; youtubePlaylistPosition?: number;
  youtubeVerification?: 'verified' | 'needs_review';
  /** Paid JITL Academy equivalent. Secondary/optional only. */
  academyUrl: string | null; academyTitle?: string; academyDurationSec?: number | null;
  sourceType: SourceType; resourceAccess: ResourceAccess;
}

export interface LectureItem extends Partial<StudyResource> {
  id: string; title: string; kind: 'lecture' | 'extra'; durationSec: number | null;
  ccnaV11Addition: boolean | null; notes?: string; reviewFlags: string[];
}
/** A "study day". Stable id e.g. ccna-jeremy-day-01. */
export interface Lesson {
  id: string; certificationId: string; courseId: string; moduleId: string | null; order: number;
  dayNumber: number | null; title: string; altTitles: { source: string; title: string }[];
  lectures: LectureItem[];
  /** Required labs (free). Paid-optional labs live in extraLabIds and never count toward completion. */
  labIds: string[]; extraLabIds?: string[]; reviewFlags: string[];
}
export interface Lab extends Partial<StudyResource> {
  id: string; lessonId: string; courseId: string; certificationId: string; order: number; title: string;
  kind: string; durationSec: number | null; reviewFlags: string[];
  /** Official free lab files/flashcards link (Jeremy's email signup, or the Mega Lab Drive folder). */
  labFilesUrl?: string | null; labFilesAccess?: ResourceAccess; labFilesVerification?: 'course_level' | 'per_lab';
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
  /** XP is awarded once per lab ever, so toggling status can't farm it. */
  xpAwarded?: { lab?: boolean; independent?: boolean };
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
/** users/{uid}/reviewDays/{YYYY-MM-DD}: guard so the 'review session' XP is awarded once per local day. */
export interface ReviewDay { date: string; completedAt: Timestamp; lessonId: string }
/** users/{uid}/ankiDays/{YYYY-MM-DD}: existence = Anki done that local day (also the XP guard). */
export interface AnkiDay { date: string; completedAt: Timestamp; lessonId: string }

// ---------- Topics & blueprint (shared reference data) ----------
export interface Topic { id: string; certificationId: string; title: string; order: number; lessonIds: string[]; objectiveCodes: string[]; basis: string }
export interface BlueprintDomain { id: string; code: string; title: string; weight: number }
export interface Blueprint {
  id: string; certificationId: string; examCode: string; version: string; title: string; status: string; examMinutes: number;
  effectiveFrom: string | null; retiresOn: string | null; nextVersionStartsOn: string | null;
  domains: BlueprintDomain[]; sourceUrl: string; releaseNotesUrl: string; reviewFlags: string[];
}
export interface BlueprintObjective {
  id: string; blueprintId: string; domainCode: string; code: string; level: 'objective' | 'sub'; parentCode: string | null;
  text: string; order: number; v11Change: 'added' | 'modified' | null; changeNote: string | null;
}
export interface ObjectiveMapping {
  id: string; blueprintId: string; objectiveId: string; objectiveCode: string; lessonId: string; itemId: string;
  itemKind: 'lecture' | 'lab'; confidence: 'high' | 'needs_review'; basis: string; source: string; reviewed: boolean; note?: string;
}

// ---------- More personal data ----------
/** users/{uid}/topicProgress/{topicId}: manual confidence plus denormalized practice-exam misses (so Dashboard needs no exam reads). */
export interface TopicProgress { topicId: string; certificationId: string; confidence: number | null; missCount: number; lastMissedAt: Timestamp | null; updatedAt: Timestamp }
/** users/{uid}/practiceExams/{autoId} */
export interface PracticeExam {
  id: string; certificationId: string; provider: string; examName: string; scorePercent: number; takenOn: string;
  notes: string; missedTopicIds: string[]; createdAt: Timestamp;
}
/** users/{uid}/workApplications/{autoId} */
export interface WorkApplication {
  id: string; certificationId: string; date: string; title: string; situation: string; knowledgeApplied: string; topicId: string | null; createdAt: Timestamp;
}
