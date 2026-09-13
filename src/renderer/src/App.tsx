import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { RequireAuth } from './components/RequireAuth';
import { RequireManager } from './components/RequireManager';
import { TitleBar } from './components/TitleBar';
import { UpdateAvailableToast } from './components/UpdateAvailableToast';
import { FirstRunSetupPage } from './pages/FirstRunSetupPage';
import { LoginPage } from './pages/LoginPage';
import { MyAccountPage } from './pages/MyAccountPage';
import { MySchedulePage } from './pages/MySchedulePage';
import { ScheduleBoardPage } from './pages/ScheduleBoardPage';
import { TimeOffQueuePage } from './pages/TimeOffQueuePage';
import { RequestTimeOffPage } from './pages/RequestTimeOffPage';
import { EmployeesAdminPage } from './pages/EmployeesAdminPage';
import { ShiftTemplatesAdminPage } from './pages/ShiftTemplatesAdminPage';
import { StoreHoursAdminPage } from './pages/StoreHoursAdminPage';
import { useSessionStore } from './store/useSessionStore';
import { api } from './api/client';

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
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/my-schedule" replace />} />
              <Route path="/my-schedule" element={<MySchedulePage />} />
              <Route path="/time-off/request" element={<RequestTimeOffPage />} />
              <Route path="/account" element={<MyAccountPage />} />
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
