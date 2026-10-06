import assert from 'node:assert/strict';
import { courseCompletion, lessonState, nextLesson, type ProgressMap } from '../src/lib/progress';
import type { Lesson, LabProgress, LessonProgress } from '../src/types';

const L = (id: string, order: number, lecture: boolean, labIds: string[]): Lesson => ({
  id, certificationId: 'c', courseId: 'k', moduleId: null, order, dayNumber: order, title: id, altTitles: [], labIds, reviewFlags: [],
  lectures: lecture ? [{ id: id + '-l', title: 't', kind: 'lecture', durationSec: 60, url: null, youtubeUrl: null, ccnaV11Addition: null, reviewFlags: [] }] : [] });
const lessons = [L('d1', 1, true, ['d1-lab']), L('d2', 2, true, []), L('mega', 3, false, ['m-lab'])];
const lp = (id: string, lec: boolean): LessonProgress => ({ type: 'lesson', lessonId: id, lectureCompleted: lec } as LessonProgress);
const lab = (id: string, status: LabProgress['status']): LabProgress => ({ type: 'lab', labId: id, status } as LabProgress);

let m: ProgressMap = new Map();
assert.equal(nextLesson(lessons, m)?.id, 'd1');
m = new Map<string, any>([['d1', lp('d1', true)]]);
assert.equal(lessonState(lessons[0], m).complete, false, 'lecture done but lab missing => not complete');
assert.equal(nextLesson(lessons, m)?.id, 'd1');
m.set('d1-lab', lab('d1-lab', 'needs_redo'));
assert.equal(lessonState(lessons[0], m).complete, false, 'needs_redo is not complete');
m.set('d1-lab', lab('d1-lab', 'completed'));
assert.equal(lessonState(lessons[0], m).complete, true);
assert.equal(nextLesson(lessons, m)?.id, 'd2');
assert.equal(lessonState(lessons[2], m).needsLecture, false, 'lab-only day needs no lecture');
const c = courseCompletion(lessons, m);
assert.deepEqual([c.daysDone, c.daysTotal, c.percent], [1, 3, 50]); // units: 2 + 1 + 1 = 4 total, 2 done
console.log('progress tests passed');

// ---- multi-lecture days + legacy migration ----
const multi: Lesson = { ...L('d11', 11, true, []), lectures: ['a', 'b'].map((x) => ({ id: 'd11-' + x, title: x, kind: 'lecture' as const, durationSec: 60, url: null, youtubeUrl: null, ccnaV11Addition: null, reviewFlags: [] })) };
let mm: ProgressMap = new Map<string, any>([['d11', { type: 'lesson', completedLectureIds: ['d11-a'] }]]);
assert.equal(lessonState(multi, mm).complete, false, 'one of two lectures is not enough');
assert.equal(lessonState(multi, mm).lecturesDone, 1);
mm = new Map<string, any>([['d11', { type: 'lesson', completedLectureIds: ['d11-a', 'd11-b'] }]]);
assert.equal(lessonState(multi, mm).complete, true);
mm = new Map<string, any>([['d11', { type: 'lesson', lectureCompleted: true }]]); // Stage 1 legacy doc
assert.equal(lessonState(multi, mm).lecturesDone, 2, 'legacy lectureCompleted => all required lectures');
const cc = courseCompletion([multi], mm);
assert.deepEqual([cc.lectures, cc.lectureTotal], [2, 2], 'counts lecture items, not lecture-days');
console.log('multi-lecture tests passed');

// ---- blueprint coverage + topics ----
import { blueprintCoverage } from '../src/lib/blueprint';
import { topicState } from '../src/lib/topics';
import { readFileSync } from 'node:fs';
const objs = JSON.parse(readFileSync('seed/blueprint-objectives.json', 'utf8'));
const maps = JSON.parse(readFileSync('seed/lesson-objective-mappings.json', 'utf8'));
assert.equal(objs.filter((o: any) => o.level === 'objective').length, 53, '53 top-level v1.1 objectives');
const bl: Lesson = { ...L('ccna-jeremy-day-23', 23, true, ['ccna-jeremy-day-23-lab-1']), lectures: [{ id: 'ccna-jeremy-day-23-lec-1', title: 'EtherChannel', kind: 'lecture', durationSec: 60, url: null, youtubeUrl: null, ccnaV11Addition: null, reviewFlags: [] }] };
const lm = new Map([[bl.id, bl]]);
let cov = blueprintCoverage(objs, maps, lm, new Map());
assert.equal(cov.rows.find((r) => r.objective.code === '2.4')!.status, 'not_started');
assert.equal(cov.rows.find((r) => r.objective.code === '1.10')!.status, 'no_content', 'unmapped objective is a gap');
let p2: ProgressMap = new Map<string, any>([[bl.id, { type: 'lesson', completedLectureIds: ['ccna-jeremy-day-23-lec-1'] }]]);
assert.equal(blueprintCoverage(objs, maps, lm, p2).rows.find((r) => r.objective.code === '2.4')!.status, 'partial');
p2.set('ccna-jeremy-day-23-lab-1', { type: 'lab', status: 'needs_redo' } as any);
assert.equal(blueprintCoverage(objs, maps, lm, p2).rows.find((r) => r.objective.code === '2.4')!.status, 'partial', 'needs_redo lab does not cover');
p2.set('ccna-jeremy-day-23-lab-1', { type: 'lab', status: 'completed' } as any);
assert.equal(blueprintCoverage(objs, maps, lm, p2).rows.find((r) => r.objective.code === '2.4')!.status, 'covered');
assert.ok(cov.rows.filter((r) => r.status !== 'no_content').every((r) => r.high.length > 0), 'needs_review alone never counts as content');

const topic = { id: 't', certificationId: 'c', title: 'T', order: 1, lessonIds: ['d1'], objectiveCodes: [], basis: '' };
const lp1: ProgressMap = new Map<string, any>([['d1', { type: 'lesson', confidence: 2 }]]);
const tl = new Map(lessons.map((l) => [l.id, l]));
assert.equal(topicState(topic, undefined, tl, new Map()).status, 'unrated');
assert.equal(topicState(topic, undefined, tl, lp1).status, 'needs_review', 'derived from lesson confidence 2');
assert.equal(topicState(topic, { confidence: 4 } as any, tl, lp1).status, 'strong', 'manual rating wins');
assert.equal(topicState(topic, { confidence: 3 } as any, tl, lp1).status, 'review_soon');
assert.equal(topicState(topic, { confidence: 3, missCount: 1 } as any, tl, lp1).status, 'needs_review', 'exam miss lifts a 3 to needs review');
assert.equal(topicState(topic, { confidence: 5, missCount: 2 } as any, tl, lp1).status, 'strong', 'a 5 stays strong');
assert.ok(topicState(topic, { confidence: 2, missCount: 2 } as any, tl, lp1).priority > topicState(topic, { confidence: 2 } as any, tl, lp1).priority);
console.log('blueprint + topic tests passed');
