import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { levelFromXp } from '../lib/progress';
import { ErrorState, Spinner } from './ui';

export const NAV = [
  { to: '/', label: 'Dashboard' }, { to: '/study', label: 'Study' }, { to: '/roadmap', label: 'Roadmap' },
  { to: '/labs', label: 'Labs' }, { to: '/topics', label: 'Topics' }, { to: '/blueprint', label: 'Blueprint' },
  { to: '/history', label: 'History' }, { to: '/notes', label: 'Notes' }, { to: '/readiness', label: 'Exam Readiness' },
  { to: '/applied', label: 'Applied at Work' }, { to: '/settings', label: 'Settings' },
];

function CertSwitcher() {
  const { certifications, activeCert } = useAppData();
  return (
    <div className="px-3 pb-3">
      <div className="mb-1 px-1 text-[11px] uppercase tracking-wider text-zinc-500">Certification</div>
      <ul className="space-y-1">
        {certifications.map((c) => {
          const active = c.id === activeCert?.id;
          return (
            <li key={c.id} className={`flex items-center justify-between rounded px-2 py-1.5 text-sm ${active ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500'}`}
              aria-disabled={c.status !== 'active'}>
              <span>{c.title}</span>
              <span className="text-[11px]">{c.status === 'active' ? 'Active' : 'Coming later'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function AppShell() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { loading, error, profile } = useAppData();
  const nav = (
    <nav aria-label="Primary" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === '/'} onClick={() => setOpen(false)}
          className={({ isActive }) => `block rounded px-3 py-2 text-sm ${isActive ? 'bg-sky-950 text-sky-300' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'}`}>{n.label}</NavLink>
      ))}
    </nav>
  );
  const side = (
    <div className="flex h-full flex-col">
      <div className="px-4 py-4 text-sm font-semibold tracking-wide">Cert Command Center</div>
      <CertSwitcher />{nav}
      <div className="border-t border-zinc-800 p-3 text-xs text-zinc-500">
        <div className="truncate text-zinc-300">{user?.displayName ?? user?.email}</div>
        {profile && <div>Level {levelFromXp(profile.stats.xp)} · {profile.stats.xp} XP</div>}
        <button onClick={signOut} className="mt-2 text-zinc-400 underline hover:text-zinc-200">Sign out</button>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-60 shrink-0 border-r border-zinc-800 bg-zinc-950 lg:block lg:h-screen lg:sticky lg:top-0">{side}</aside>
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 lg:hidden">
        <span className="text-sm font-semibold">Cert Command Center</span>
        <button aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)} className="rounded border border-zinc-700 px-3 py-1 text-sm">Menu</button>
      </div>
      {open && <div id="mobile-nav" className="fixed inset-0 z-20 bg-zinc-950 lg:hidden" role="dialog" aria-modal="true">
        <button onClick={() => setOpen(false)} className="absolute right-4 top-3 rounded border border-zinc-700 px-3 py-1 text-sm">Close</button>{side}</div>}
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl">{error ? <ErrorState message={error} /> : loading ? <Spinner /> : <Outlet />}</div>
      </main>
    </div>
  );
}
