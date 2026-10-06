import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { saveTopicConfidence } from '../lib/data';
import { STATUS_LABEL, topicState, type TopicStatus } from '../lib/topics';
import { ConfidencePicker, EmptyState, ErrorState, PageTitle, Pill } from '../components/ui';

const ORDER: TopicStatus[] = ['needs_review', 'review_soon', 'unrated', 'strong'];
const TONE: Record<TopicStatus, 'bad' | 'warn' | 'neutral' | 'good'> = { needs_review: 'bad', review_soon: 'warn', unrated: 'neutral', strong: 'good' };

export default function Topics() {
  const { user } = useAuth();
  const { topics, topicProgress, lessonsById, progress } = useAppData();
  const [err, setErr] = useState<string | null>(null);
  const states = useMemo(() => topics.map((t) => ({ topic: t, s: topicState(t, topicProgress.get(t.id), lessonsById, progress) })), [topics, topicProgress, lessonsById, progress]);
  if (!topics.length) return <EmptyState title="No topics loaded" body="Run `npm run seed` to load topics." />;
  const set = async (id: string, n: number | null) => {
    setErr(null);
    try { await saveTopicConfidence(user!.uid, topics.find((t) => t.id === id)!, n); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div>
      <PageTitle title="Topics" sub="Rate each topic 1–5. 1–2 needs review, 3 review soon, 4–5 strong. Unrated topics use your lesson confidence." />
      {err && <div className="mb-3"><ErrorState message={err} /></div>}
      {ORDER.map((st) => {
        const group = states.filter((x) => x.s.status === st).sort((a, b) => b.s.priority - a.s.priority);
        if (!group.length) return null;
        return (
          <section key={st} className="mb-6" aria-label={STATUS_LABEL[st]}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">{STATUS_LABEL[st]} <span className="text-zinc-600">{group.length}</span></h2>
            <ul className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800">
              {group.map(({ topic, s }) => (
                <li key={topic.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="text-sm">{topic.title}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-zinc-500">
                      {s.manual == null && s.derived != null && <span>From lessons: {s.derived}/5</span>}
                      {s.missCount > 0 && <Pill tone="bad">Missed in {s.missCount} exam{s.missCount > 1 ? 's' : ''}</Pill>}
                      {s.needsRedoLabs > 0 && <Pill tone="warn">{s.needsRedoLabs} lab{s.needsRedoLabs > 1 ? 's' : ''} to redo</Pill>}
                    </div>
                  </div>
                  <Pill tone={TONE[st]}>{STATUS_LABEL[st]}</Pill>
                  <ConfidencePicker value={s.manual} onChange={(n) => set(topic.id, n)} label={`${topic.title} confidence`} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
