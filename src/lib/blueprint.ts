import type { BlueprintObjective, Lesson, ObjectiveMapping } from '../types';
import { completedLectureIds, labProg, lessonProg, type ProgressMap } from './progress';

export type ObjStatus = 'covered' | 'partial' | 'not_started' | 'no_content';
export interface Unit { itemId: string; kind: 'lecture' | 'lab'; lessonId: string; done: boolean; confidence: 'high' | 'needs_review' }
export interface ObjectiveCoverage {
  objective: BlueprintObjective; subs: BlueprintObjective[]; high: Unit[]; tentative: Unit[]; done: number; status: ObjStatus;
}
/** Top-level code for any objective code: "2.5.d" -> "2.5". */
export const topCode = (code: string) => code.split('.').slice(0, 2).join('.');

function unitDone(m: ObjectiveMapping, lessons: Map<string, Lesson>, progress: ProgressMap): boolean {
  if (m.itemKind === 'lab') return labProg(progress, m.itemId)?.status === 'completed';
  const lesson = lessons.get(m.lessonId);
  return !!lesson && completedLectureIds(lesson, lessonProg(progress, m.lessonId)).has(m.itemId);
}

/**
 * Blueprint coverage is separate from Jeremy course completion. An objective is "covered" when it has at least one
 * high-confidence mapped item and ALL of its high-confidence items are complete. needs_review mappings never count.
 */
export function blueprintCoverage(objectives: BlueprintObjective[], mappings: ObjectiveMapping[], lessons: Map<string, Lesson>, progress: ProgressMap) {
  const top = objectives.filter((o) => o.level === 'objective').sort((a, b) => a.order - b.order);
  const byTop = new Map<string, ObjectiveMapping[]>();
  const optional = (m: ObjectiveMapping) => m.itemKind === 'lecture' && lessons.get(m.lessonId)?.lectures.find((x) => x.id === m.itemId)?.resourceAccess === 'paid_optional';
  for (const m of mappings) { if (optional(m)) continue; const k = topCode(m.objectiveCode); byTop.set(k, [...(byTop.get(k) ?? []), m]); }
  const rows: ObjectiveCoverage[] = top.map((o) => {
    const ms = byTop.get(o.code) ?? [];
    const uniq = (c: 'high' | 'needs_review'): Unit[] => {
      const seen = new Map<string, Unit>();
      for (const m of ms.filter((x) => x.confidence === c)) seen.set(m.itemId, { itemId: m.itemId, kind: m.itemKind, lessonId: m.lessonId, confidence: c, done: unitDone(m, lessons, progress) });
      return [...seen.values()];
    };
    const high = uniq('high'); const tentative = uniq('needs_review').filter((t) => !high.some((h) => h.itemId === t.itemId));
    const done = high.filter((u) => u.done).length;
    const status: ObjStatus = !high.length ? 'no_content' : done === high.length ? 'covered' : done > 0 ? 'partial' : 'not_started';
    return { objective: o, subs: objectives.filter((s) => s.parentCode === o.code), high, tentative, done, status };
  });
  const covered = rows.filter((r) => r.status === 'covered').length;
  const byDomain: Record<string, { covered: number; total: number }> = {};
  for (const r of rows) { const d = (byDomain[r.objective.domainCode] ??= { covered: 0, total: 0 }); d.total++; if (r.status === 'covered') d.covered++; }
  return { rows, covered, total: rows.length, percent: rows.length ? Math.round((covered / rows.length) * 100) : 0, byDomain };
}
