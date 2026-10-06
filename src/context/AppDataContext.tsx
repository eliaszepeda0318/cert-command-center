import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, doc, getDocs, onSnapshot, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { localDateKey } from '../lib/progress';
import { useAuth } from './AuthContext';
import type { Certification, Course, Lab, Lesson, ProgressDoc, StudySession, Topic, TopicProgress, UserProfile } from '../types';

interface AppData {
  loading: boolean; error: string | null;
  certifications: Certification[]; activeCert: Certification | null; course: Course | null;
  lessons: Lesson[]; labsById: Map<string, Lab>; lessonsById: Map<string, Lesson>; topics: Topic[]; topicProgress: Map<string, TopicProgress>;
  profile: UserProfile | null; progress: Map<string, ProgressDoc>; sessions: StudySession[]; ankiDoneToday: boolean;
}
const Ctx = createContext<AppData | null>(null);
interface Curriculum { course: Course | null; lessons: Lesson[]; labs: Lab[]; topics: Topic[] }
const curriculumCache = new Map<string, Curriculum>(); // reference data is read once per page load

async function loadReference(certId: string): Promise<Curriculum> {
  const hit = curriculumCache.get(certId); if (hit) return hit;
  const scope = where('certificationId', '==', certId);
  const [c, l, b, t] = await Promise.all([
    getDocs(query(collection(db, 'courses'), scope)), getDocs(query(collection(db, 'lessons'), scope)), getDocs(query(collection(db, 'labs'), scope)), getDocs(query(collection(db, 'topics'), scope)),
  ]);
  const out: Curriculum = {
    course: (c.docs[0]?.data() as Course) ?? null,
    lessons: l.docs.map((d) => d.data() as Lesson).sort((a, b) => a.order - b.order),
    labs: b.docs.map((d) => d.data() as Lab),
    topics: t.docs.map((d) => d.data() as Topic).sort((a, b) => a.order - b.order),
  };
  curriculumCache.set(certId, out); return out;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user!.uid;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [progress, setProgress] = useState<Map<string, ProgressDoc>>(new Map());
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [ankiDoneToday, setAnkiDoneToday] = useState(false);
  const [topicProgress, setTopicProgress] = useState<Map<string, TopicProgress>>(new Map());
  const [certs, setCerts] = useState<Certification[]>([]);
  const [cur, setCur] = useState<Curriculum>({ course: null, lessons: [], labs: [], topics: [] });
  const [flags, setFlags] = useState({ profile: false, progress: false, sessions: false, ref: false });
  const [error, setError] = useState<string | null>(null);
  const done = (k: keyof typeof flags) => setFlags((f) => ({ ...f, [k]: true }));
  const fail = (e: Error) => setError(e.message);

  useEffect(() => {
    const since = Timestamp.fromMillis(Date.now() - 35 * 86400000);
    const u1 = onSnapshot(doc(db, 'users', uid), (s) => { setProfile((s.data() as UserProfile) ?? null); if (s.exists()) done('profile'); }, fail);
    const u2 = onSnapshot(collection(db, 'users', uid, 'progress'), (s) => { setProgress(new Map(s.docs.map((d) => [d.id, d.data() as ProgressDoc]))); done('progress'); }, fail);
    const u3 = onSnapshot(query(collection(db, 'users', uid, 'studySessions'), where('completedAt', '>=', since)),
      (s) => { setSessions(s.docs.map((d) => ({ id: d.id, ...d.data() }) as StudySession).sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis())); done('sessions'); }, fail);
    const u4 = onSnapshot(doc(db, 'users', uid, 'ankiDays', localDateKey()), (s) => setAnkiDoneToday(s.exists()), fail);
    const u5 = onSnapshot(collection(db, 'users', uid, 'topicProgress'), (s) => setTopicProgress(new Map(s.docs.map((d) => [d.id, d.data() as TopicProgress]))), fail);
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [uid]);

  const certId = profile?.settings.activeCertificationId;
  useEffect(() => {
    if (!certId) return;
    let live = true;
    (async () => {
      try {
        const cs = await getDocs(collection(db, 'certifications'));
        const r = await loadReference(certId);
        if (live) { setCerts(cs.docs.map((d) => d.data() as Certification).sort((a, b) => a.order - b.order)); setCur(r); done('ref'); }
      } catch (e) { if (live) fail(e as Error); }
    })();
    return () => { live = false; };
  }, [certId]);

  const value = useMemo<AppData>(() => ({
    loading: !(flags.profile && flags.progress && flags.sessions && flags.ref), error,
    certifications: certs, activeCert: certs.find((c) => c.id === certId) ?? null, course: cur.course,
    lessons: cur.lessons, labsById: new Map(cur.labs.map((l) => [l.id, l])), lessonsById: new Map(cur.lessons.map((l) => [l.id, l])),
    topics: cur.topics, topicProgress, profile, progress, sessions, ankiDoneToday,
  }), [flags, error, certs, certId, cur, profile, progress, sessions, ankiDoneToday, topicProgress]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAppData = () => { const c = useContext(Ctx); if (!c) throw new Error('useAppData outside provider'); return c; };
