import type { ReactNode } from 'react';

export const Card = ({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={`rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 ${className}`}>
    {(title || action) && <div className="mb-3 flex items-center justify-between gap-2">
      {title && <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>}{action}</div>}
    {children}
  </section>
);

export const ProgressBar = ({ value, label }: { value: number; label?: string }) => (
  <div role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}
    className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
    <div className="h-full rounded-full bg-sky-500 transition-[width]" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);

export const Stat = ({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) => (
  <div><div className="text-xs text-zinc-500">{label}</div><div className="text-2xl font-semibold tabular-nums">{value}</div>{sub && <div className="text-xs text-zinc-500">{sub}</div>}</div>
);

const tones = { neutral: 'bg-zinc-800 text-zinc-300', good: 'bg-emerald-950 text-emerald-300', warn: 'bg-amber-950 text-amber-300', info: 'bg-sky-950 text-sky-300', bad: 'bg-red-950 text-red-300' };
export const Pill = ({ tone = 'neutral', children }: { tone?: keyof typeof tones; children: ReactNode }) => (
  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
);

export const Spinner = ({ label = 'Loading' }: { label?: string }) => (
  <div role="status" className="flex items-center gap-3 p-8 text-sm text-zinc-400">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-sky-500" />{label}…</div>
);
export const EmptyState = ({ title, body }: { title: string; body?: string }) => (
  <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center"><div className="font-medium text-zinc-300">{title}</div>{body && <p className="mt-1 text-sm text-zinc-500">{body}</p>}</div>
);
export const ErrorState = ({ message }: { message: string }) => (
  <div role="alert" className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
    <div className="font-medium">Something went wrong</div><p className="mt-1 break-words text-red-400">{message}</p></div>
);
export const btn = 'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50';
export const btnPrimary = `${btn} bg-sky-600 text-white hover:bg-sky-500`;
export const btnGhost = `${btn} border border-zinc-700 text-zinc-200 hover:bg-zinc-800`;
