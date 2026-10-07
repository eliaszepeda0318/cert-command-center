/**
 * Audits the curriculum seed against the verified YouTube snapshot and the pre-migration stable ids.
 *   npm test   (runs this after the progress tests)
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = <T>(f: string): T => JSON.parse(readFileSync(new URL(`../seed/${f}`, import.meta.url), 'utf8')) as T;
type Item = { id: string; kind: string; title: string; durationSec: number; freeYoutubeUrl: string | null; youtubeVideoId: string; youtubeTitle: string; youtubeVerification: string; resourceAccess: string; sourceType: string; academyUrl: string | null; labFilesUrl?: string; labFilesAccess?: string; reviewFlags: string[]; url?: unknown; youtubeUrl?: unknown };
const cur = read<{ days: { id: string; lectures: Item[]; labs: Item[] }[]; megaLab: Item; freeResources: { id: string; access: string; url: string }[]; primarySource: string }>('ccna-jeremy-curriculum.json');
const snap = read<{ videoCount: number; videos: { id: string; title: string; durationSec: number; oembedAuthor: string }[] }>('source/youtube-playlist-2026-10-07.json');
const before = read<{ ids: { lessons: string[]; lectures: string[]; labs: string[] } }>('source/stable-ids-pre-youtube-migration.json').ids;

const lectures = cur.days.flatMap((d) => d.lectures), labs = [...cur.days.flatMap((d) => d.labs), cur.megaLab];
const all = [...lectures, ...labs];
const vids = new Map(snap.videos.map((v) => [v.id, v]));

// 1. stable ids: every id progress could reference still exists, nothing renamed
assert.deepEqual([...cur.days.map((d) => d.id), 'ccna-jeremy-mega-lab'], before.lessons, 'lesson ids unchanged');
assert.deepEqual(lectures.map((l) => l.id), before.lectures, 'lecture ids unchanged');
assert.deepEqual(labs.map((l) => l.id), before.labs, 'lab ids unchanged');

// 2. every item points at a real, official, free video that matches the snapshot exactly
assert.equal(snap.videoCount, 126);
for (const it of all) {
  assert.ok(it.freeYoutubeUrl, `${it.id}: has free YouTube URL`);
  const v = vids.get(it.youtubeVideoId); assert.ok(v, `${it.id}: video ${it.youtubeVideoId} is in the official playlist snapshot`);
  assert.equal(it.freeYoutubeUrl, `https://www.youtube.com/watch?v=${it.youtubeVideoId}`);
  assert.equal(v!.oembedAuthor, "Jeremy's IT Lab");
  assert.equal(it.youtubeTitle, v!.title, `${it.id}: title matches playlist`);
  assert.equal(it.durationSec, v!.durationSec, `${it.id}: duration matches playlist`);
  assert.equal(it.resourceAccess, 'free'); assert.equal(it.sourceType, 'youtube_free');
  assert.ok(!('url' in it) && !('youtubeUrl' in it), `${it.id}: no legacy url fields (paid link can't become a primary action)`);
  if (it.academyUrl) assert.match(it.academyUrl, /^https:\/\/courses\.jeremysitlab\.com\//, 'academy link is only secondary metadata');
}
assert.equal(new Set(all.map((i) => i.youtubeVideoId)).size, 126, 'one distinct video per item');
assert.equal(all.length, snap.videoCount, 'every playlist video is used exactly once');

// 3. labs: free lab-file link present and official
for (const lab of labs) { assert.equal(lab.labFilesAccess, 'free'); assert.match(lab.labFilesUrl!, /^https:\/\/jitl\.jp\/(ccna-files|mega-lab)$/); }

// 4. only flagged items are needs_review, and they carry an explanation
const flagged = all.filter((i) => i.youtubeVerification !== 'verified');
assert.deepEqual(flagged.map((i) => i.id), ['ccna-jeremy-day-18-lab-1']);
assert.ok(flagged.every((i) => i.reviewFlags.length > 0));

// 5. course-level resources: paid ones are optional, free ones are free
assert.equal(cur.primarySource, 'youtube_free');
for (const r of cur.freeResources) if (/courses\.jeremysitlab\.com/.test(r.url)) assert.equal(r.access, 'paid_optional');
assert.ok(cur.freeResources.some((r) => r.id === 'ccna-files' && r.access === 'free'));
console.log('curriculum audit passed');
