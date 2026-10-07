/**
 * Seeds/updates SHARED reference data only (certifications, courses, lessons, labs, and,
 * when present, blueprints/objectives/mappings). It never reads or writes users/**, so
 * personal progress survives every re-seed. Progress is keyed by stable IDs (lesson/lab ids).
 *
 *   npm run seed:dry                 # show what would be written
 *   npm run seed                     # upsert (needs FIREBASE_PROJECT_ID + credentials)
 *   npm run seed -- --prune          # also delete reference docs for this course no longer in seed
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const PRUNE = args.includes('--prune');
const seedPath = (f: string) => resolve(process.cwd(), 'seed', f);
const readJson = <T>(f: string): T => JSON.parse(readFileSync(seedPath(f), 'utf8')) as T;

interface SeedItem { id: string; title: string; kind: string; durationSec: number | null; freeYoutubeUrl: string | null; academyUrl: string | null; resourceAccess: 'free' | 'paid_optional' | 'unverified'; sourceType: string; youtubeVerification?: string; labFilesUrl?: string | null; ccnaV11Addition?: boolean | null; notes?: string; reviewFlags: string[]; durationSource?: string; teachableLectureId?: string }
interface SeedDay { id: string; day: number; title: string; altTitles: { source: string; title: string }[]; lectures: SeedItem[]; labs: SeedItem[]; reviewFlags: string[] }
interface Curriculum { id: string; certificationId: string; title: string; playlistUrl: string | null; version: string; primarySource?: string; freeResources?: unknown[]; days: SeedDay[]; megaLab: SeedItem; _meta: unknown }

type Doc = { path: string; data: Record<string, unknown> };
const docs: Doc[] = [];
const hash = (f: string) => createHash('sha1').update(readFileSync(seedPath(f))).digest('hex').slice(0, 8);

// certifications
for (const c of readJson<Record<string, unknown>[]>('certifications.json')) docs.push({ path: `certifications/${c.id}`, data: c });

// Jeremy's course -> course, lessons (study days), labs
const cur = readJson<Curriculum>('ccna-jeremy-curriculum.json');
const courseId = cur.id, certId = cur.certificationId;
const lessonIds: string[] = [];
const labIds: string[] = [];
const lectureOnly = ({ ...i }: SeedItem) => i;
const labDoc = (lab: SeedItem, lessonId: string, order: number): Doc => {
  labIds.push(lab.id);
  return { path: `labs/${lab.id}`, data: { ...lab, lessonId, courseId, certificationId: certId, order } };
};
cur.days.forEach((d, i) => {
  lessonIds.push(d.id);
  docs.push({ path: `lessons/${d.id}`, data: {
    id: d.id, certificationId: certId, courseId, moduleId: null, order: i + 1, dayNumber: d.day,
    title: d.title, altTitles: d.altTitles, lectures: d.lectures.map(lectureOnly), labIds: d.labs.filter((l) => l.resourceAccess !== 'paid_optional').map((l) => l.id), extraLabIds: d.labs.filter((l) => l.resourceAccess === 'paid_optional').map((l) => l.id), reviewFlags: d.reviewFlags } });
  d.labs.forEach((l, j) => docs.push(labDoc(l, d.id, j + 1)));
});
const megaLessonId = `${courseId}-mega-lab`;
lessonIds.push(megaLessonId);
docs.push({ path: `lessons/${megaLessonId}`, data: {
  id: megaLessonId, certificationId: certId, courseId, moduleId: null, order: cur.days.length + 1, dayNumber: null,
  title: cur.megaLab.title, altTitles: [], lectures: [], labIds: [cur.megaLab.id], reviewFlags: [] } });
docs.push(labDoc(cur.megaLab, megaLessonId, 1));
docs.push({ path: `courses/${courseId}`, data: {
  id: courseId, certificationId: certId, title: cur.title, playlistUrl: cur.playlistUrl,
  lessonCount: lessonIds.length, labCount: labIds.length, primarySource: cur.primarySource ?? null, freeResources: cur.freeResources ?? [], contentVersion: `${cur.version}-${hash('ccna-jeremy-curriculum.json')}` } });

// Topics, then blueprint (optional until imported): blueprints, objectives, lesson->objective mappings
for (const [file, coll] of [['topics.json', 'topics'], ['blueprints.json', 'blueprints'], ['blueprint-objectives.json', 'blueprintObjectives'], ['lesson-objective-mappings.json', 'lessonObjectiveMappings']] as const) {
  if (!existsSync(seedPath(file))) { console.log(`(skip) seed/${file} not found`); continue; }
  for (const row of readJson<{ id: string }[]>(file)) docs.push({ path: `${coll}/${row.id}`, data: row as unknown as Record<string, unknown> });
}

// Referential integrity: bad seed data should fail here, not silently in the app.
const ids = (c: string) => new Set(docs.filter((d) => d.path.startsWith(c + '/')).map((d) => d.path.split('/')[1]));
const lessonSet = ids('lessons'), labSet = ids('labs'), objSet = ids('blueprintObjectives');
const lectureSet = new Set(docs.filter((d) => d.path.startsWith('lessons/')).flatMap((d) => (d.data.lectures as { id: string }[]).map((x) => x.id)));
const problems: string[] = [];
for (const d of docs.filter((x) => x.path.startsWith('lessonObjectiveMappings/'))) {
  const m = d.data as { itemId: string; itemKind: string; lessonId: string; objectiveId: string };
  if (!objSet.has(m.objectiveId)) problems.push(`${d.path}: unknown objective ${m.objectiveId}`);
  if (!lessonSet.has(m.lessonId)) problems.push(`${d.path}: unknown lesson ${m.lessonId}`);
  if (!(m.itemKind === 'lab' ? labSet : lectureSet).has(m.itemId)) problems.push(`${d.path}: unknown ${m.itemKind} ${m.itemId}`);
}
for (const d of docs.filter((x) => x.path.startsWith('topics/'))) for (const l of (d.data.lessonIds as string[])) if (!lessonSet.has(l)) problems.push(`${d.path}: unknown lesson ${l}`);
// Free-first rule: a required item must have a free resource. Paid material can only ever be optional.
for (const d of docs.filter((x) => x.path.startsWith('lessons/'))) {
  for (const l of (d.data.lectures as { id: string; kind: string; resourceAccess?: string; freeYoutubeUrl?: string | null }[])) {
    if (l.kind === 'lecture' && l.resourceAccess !== 'paid_optional' && (l.resourceAccess !== 'free' || !l.freeYoutubeUrl)) problems.push(`${l.id}: required lecture has no verified free YouTube URL`);
  }
}
for (const d of docs.filter((x) => x.path.startsWith('labs/'))) {
  const lab = d.data as { id: string; resourceAccess?: string; freeYoutubeUrl?: string | null; lessonId: string };
  const lesson = docs.find((x) => x.path === `lessons/${lab.lessonId}`)!.data as { labIds: string[] };
  if (lesson.labIds.includes(lab.id) && (lab.resourceAccess !== 'free' || !lab.freeYoutubeUrl)) problems.push(`${lab.id}: required lab has no verified free YouTube URL`);
}
if (problems.length) { console.error(problems.join('\n')); throw new Error(`Seed integrity check failed (${problems.length} problems)`); }

if (docs.some((d) => d.path.startsWith('users/'))) throw new Error('Seed must never touch users/**');

const counts: Record<string, number> = {};
for (const d of docs) counts[d.path.split('/')[0]] = (counts[d.path.split('/')[0]] ?? 0) + 1;
console.log('Seed plan:', counts);

async function main() {
  if (DRY) { console.log('Dry run: nothing written.'); return; }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Set FIREBASE_PROJECT_ID (and GOOGLE_APPLICATION_CREDENTIALS, or FIRESTORE_EMULATOR_HOST for the emulator).');
  initializeApp({ projectId, credential: process.env.FIRESTORE_EMULATOR_HOST ? undefined : applicationDefault() });
  const db = getFirestore();
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + 400)) batch.set(db.doc(d.path), { ...d.data, seededAt: new Date() });
    await batch.commit();
  }
  console.log(`Upserted ${docs.length} reference docs.`);
  if (PRUNE) {
    for (const [coll, keep] of [['lessons', lessonIds], ['labs', labIds]] as const) {
      const snap = await db.collection(coll).where('courseId', '==', courseId).get();
      const stale = snap.docs.filter((s) => !keep.includes(s.id));
      for (const s of stale) await s.ref.delete();
      console.log(`Pruned ${stale.length} stale ${coll}.`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
