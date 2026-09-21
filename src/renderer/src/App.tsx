import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { RequireAuth } from './components/RequireAuth';
import { RequireManager } from './components/RequireManager';
import { RequireSecretaryAuth } from './components/RequireSecretaryAuth';
import { SecretaryLayout } from './components/SecretaryLayout';
import { TitleBar } from './components/TitleBar';
import { UpdateAvailableToast } from './components/UpdateAvailableToast';
import { FirstRunSetupPage } from './pages/FirstRunSetupPage';
import { LoginPage } from './pages/LoginPage';
import { MyAccountPage } from './pages/MyAccountPage';
import { MySchedulePage } from './pages/MySchedulePage';
import { ScheduleBoardPage } from './pages/ScheduleBoardPage';
import { SecretaryLeaguesPage } from './pages/SecretaryLeaguesPage';
import { SecretaryLeagueSetupPage } from './pages/SecretaryLeagueSetupPage';
import { SecretaryLoginPage } from './pages/SecretaryLoginPage';
import { SecretaryRosterPage } from './pages/SecretaryRosterPage';
import { TimeOffQueuePage } from './pages/TimeOffQueuePage';
import { RequestTimeOffPage } from './pages/RequestTimeOffPage';
import { EmployeesAdminPage } from './pages/EmployeesAdminPage';
import { NoticeBoardPage } from './pages/NoticeBoardPage';
import { SettingsPage } from './pages/SettingsPage';
import { ShiftTemplatesAdminPage } from './pages/ShiftTemplatesAdminPage';
import { StoreHoursAdminPage } from './pages/StoreHoursAdminPage';
import { useSessionStore } from './store/useSessionStore';
import { api } from './api/client';
import { canAccessSecretaryArea } from './utils/secretaryAccess';

function LoginRoute(): React.JSX.Element {
  const isFirstRun = useSessionStore((state) => state.isFirstRun);
  const currentEmployee = useSessionStore((state) => state.currentEmployee);

  if (isFirstRun) {
    return <Navigate to="/first-run" replace />;
  }
  if (currentEmployee) {
    return <Navigate to="/" replace />;
  }
  return <LoginPage />;
}

function FirstRunRoute(): React.JSX.Element {
  const isFirstRun = useSessionStore((state) => state.isFirstRun);
  return isFirstRun ? <FirstRunSetupPage /> : <Navigate to="/" replace />;
}

function SecretaryLoginRoute(): React.JSX.Element {
  const currentEmployee = useSessionStore((state) => state.currentEmployee);

  if (currentEmployee) {
    // Uses the same `canAccessSecretaryArea` check as RequireSecretaryAuth
    // and SecretaryLoginPage — without it, this redirect (re-evaluated the
    // instant setSession fires, racing SecretaryLoginPage's own explicit
    // navigate('/secretary') call) can send someone who belongs here to
    // '/' instead, purely because this one spot's own copy of the check
    // fell out of sync with the other two.
    return <Navigate to={canAccessSecretaryArea(currentEmployee) ? '/secretary' : '/'} replace />;
  }
  return <SecretaryLoginPage />;
}

export function App(): React.JSX.Element {
  const setSession = useSessionStore((state) => state.setSession);
  const setFirstRun = useSessionStore((state) => state.setFirstRun);
  const setInitializing = useSessionStore((state) => state.setInitializing);
  const isInitializing = useSessionStore((state) => state.isInitializing);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async (): Promise<void> => {
      const [firstRunStatus, currentSession] = await Promise.all([
        api.auth.firstRunStatus(),
        api.auth.getSession(),
      ]);
      if (!isMounted) return;
      setFirstRun(firstRunStatus.isFirstRun);
      setSession(currentSession);
      setInitializing(false);
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [setFirstRun, setSession, setInitializing]);

  if (isInitializing) {
    return (
      <div className="app-window">
        <TitleBar />
        <div className="app-loading">
          <span className="spinner" aria-hidden="true" />
          Loading…
        </div>
        <UpdateAvailableToast />
      </div>
    );
  }

  return (
    <div className="app-window">
      <TitleBar />
      <HashRouter>
        <Routes>
          <Route path="/first-run" element={<FirstRunRoute />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/secretary/login" element={<SecretaryLoginRoute />} />
          <Route element={<RequireSecretaryAuth />}>
            <Route element={<SecretaryLayout />}>
              <Route path="/secretary" element={<SecretaryLeaguesPage />} />
              <Route path="/secretary/leagues/:leagueId" element={<SecretaryLeagueSetupPage />} />
              <Route path="/secretary/leagues/:leagueId/roster" element={<SecretaryRosterPage />} />
            </Route>
          </Route>
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/my-schedule" replace />} />
              <Route path="/my-schedule" element={<MySchedulePage />} />
              <Route path="/time-off/request" element={<RequestTimeOffPage />} />
              <Route path="/notices" element={<NoticeBoardPage />} />
              <Route path="/account" element={<MyAccountPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route element={<RequireManager />}>
                <Route path="/time-off" element={<TimeOffQueuePage />} />
                <Route path="/schedule" element={<ScheduleBoardPage />} />
                <Route path="/employees" element={<EmployeesAdminPage />} />
                <Route path="/shift-templates" element={<ShiftTemplatesAdminPage />} />
                <Route path="/store-hours" element={<StoreHoursAdminPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
      <UpdateAvailableToast />
    </div>
  );
}
