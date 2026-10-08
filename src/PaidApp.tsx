import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppDataProvider } from './context/AppDataContext';
import { ensureProfile } from './lib/profile';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import Study from './pages/Study';
import Roadmap from './pages/Roadmap';
import Settings from './pages/Settings';
import Labs from './pages/Labs';
import Topics from './pages/Topics';
import Blueprint from './pages/Blueprint';
import History from './pages/History';
import Notes from './pages/Notes';
import Readiness from './pages/Readiness';
import Applied from './pages/Applied';


/** Everything behind the paywall. Mounted only once the server-backed entitlement says access is valid. */
export default function PaidApp() {
  const { user } = useAuth();
  useEffect(() => { void ensureProfile(user!).catch(() => undefined); }, [user]);
  return (
    <AppDataProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="study" element={<Study />} />
          <Route path="study/:lessonId" element={<Study />} />
          <Route path="roadmap" element={<Roadmap />} />
          <Route path="labs" element={<Labs />} />
          <Route path="topics" element={<Topics />} />
          <Route path="blueprint" element={<Blueprint />} />
          <Route path="history" element={<History />} />
          <Route path="notes" element={<Notes />} />
          <Route path="readiness" element={<Readiness />} />
          <Route path="applied" element={<Applied />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AppDataProvider>
  );
}
