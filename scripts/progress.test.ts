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
