import type { Lesson, Topic, TopicProgress } from '../types';
import { labProg, lessonProg, type ProgressMap } from './progress';

export type TopicStatus = 'needs_review' | 'review_soon' | 'strong' | 'unrated';
export interface TopicState {
  manual: number | null; derived: number | null; effective: number | null; missCount: number; needsRedoLabs: number; status: TopicStatus; priority: number;
}
export const STATUS_LABEL: Record<TopicStatus, string> = { needs_review: 'Needs review', review_soon: 'Review soon', strong: 'Strong', unrated: 'Not rated' };

/**
 * Topic confidence. Primary signal: your manual 1-5 rating. If unrated, it is derived from the confidence you gave
 * the topic's lessons. Practice-exam misses (denormalized into TopicProgress) raise priority, and a missed topic rated
 * 3 or below (or unrated) is treated as Needs review. 1-2 = Needs review, 3 = Review soon, 4-5 = Strong.
 */
export function topicState(topic: Topic, tp: TopicProgress | undefined, lessons: Map<string, Lesson>, progress: ProgressMap): TopicState {
  const manual = tp?.confidence ?? null;
  const confs = topic.lessonIds.map((id) => lessonProg(progress, id)?.confidence).filter((c): c is number => typeof c === 'number');
  const derived = confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : null;
  const effective = manual ?? derived;
  const missCount = tp?.missCount ?? 0;
  let needsRedoLabs = 0;
  for (const id of topic.lessonIds) for (const labId of lessons.get(id)?.labIds ?? []) if (labProg(progress, labId)?.status === 'needs_redo') needsRedoLabs++;
  let status: TopicStatus = effective == null ? 'unrated' : effective <= 2 ? 'needs_review' : effective === 3 ? 'review_soon' : 'strong';
  if (missCount > 0 && (effective == null || effective <= 3)) status = 'needs_review';
  const priority = (effective == null ? 3 : 6 - effective) * 10 + missCount * 5 + needsRedoLabs * 3;
  return { manual, derived, effective, missCount, needsRedoLabs, status, priority };
}
