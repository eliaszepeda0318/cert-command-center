import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppDataProvider } from './context/AppDataContext';
import AppShell from './components/AppShell';
import { Spinner, btnPrimary } from './components/ui';
import Dashboard from './pages/Dashboard';
import Study from './pages/Study';
import Roadmap from './pages/Roadmap';
import Settings from './pages/Settings';
import Placeholder from './pages/Placeholder';

function SignIn() {
  const { signIn, error } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 text-center">
        <h1 className="text-lg font-semibold">Cert Command Center</h1>
        <p className="mt-1 text-sm text-zinc-400">Sign in to see what to study next.</p>
        <button onClick={signIn} className={`${btnPrimary} mt-5 w-full`}>Continue with Google</button>
        {error && <p role="alert" className="mt-3 break-words text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}

const later = (title: string, stage: string) => <Placeholder title={title} stage={stage} />;

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <SignIn />;
  return (
    <AppDataProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="study" element={<Study />} />
          <Route path="study/:lessonId" element={<Study />} />
          <Route path="roadmap" element={<Roadmap />} />
          <Route path="labs" element={later('Labs', 'Stage 2')} />
          <Route path="topics" element={later('Topics', 'Stage 2')} />
          <Route path="blueprint" element={later('Blueprint', 'Stage 3')} />
          <Route path="history" element={later('History', 'Stage 2')} />
          <Route path="notes" element={later('Notes', 'Stage 2')} />
          <Route path="readiness" element={later('Exam Readiness', 'Stage 4')} />
          <Route path="applied" element={later('Applied at Work', 'Stage 4')} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AppDataProvider>
  );
}
