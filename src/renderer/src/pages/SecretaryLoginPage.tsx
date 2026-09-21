import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { InstallAppPrompt } from '../components/InstallAppPrompt';
import { useSessionStore } from '../store/useSessionStore';

/**
 * A dedicated front door for Secretary accounts, deliberately separate from
 * `LoginPage` — a Secretary may not be a scheduled bowling-alley employee
 * at all (e.g. a league volunteer bookkeeper), so this doesn't lead into
 * the scheduling app's own login experience at all. Posts to the exact
 * same `/api/auth/login` as the normal login (same credentials, same
 * `employees` table), but REJECTS a successful login from any role other
 * than `secretary` or `manager` — logging that session back out
 * immediately — rather than letting it through and redirecting elsewhere,
 * so this door only ever leads to the Secretary area. A manager is let in
 * too since they already have authority over everything else in the app
 * (see `RequireSecretaryAuth.tsx`); a plain employee or coordinator is not.
 */
export function SecretaryLoginPage(): React.JSX.Element {
  const navigate = useNavigate();
  const setSession = useSessionStore((state) => state.setSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const employee = await api.auth.login({ username, password });
      if (employee.role !== 'secretary' && employee.role !== 'manager') {
        await api.auth.logout();
        setError('This sign-in is for Secretary accounts only.');
        return;
      }
      setSession(employee);
      navigate('/secretary', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-screen-stack">
        <form
          className="auth-card"
          onSubmit={(event) => {
            handleSubmit(event);
          }}
        >
          <img className="auth-logo" src="./mt-hood-lanes-logo.png" alt="Mt Hood Lanes" />
          <h1>Secretary Sign In</h1>
          <p className="auth-subtitle">Sign in to manage league dues</p>
          {error && (
            <div role="alert" className="form-error" data-testid="secretary-login-error">
              {error}
            </div>
          )}
          <label className="field-label" htmlFor="secretary-login-username">
            Username
            <input
              id="secretary-login-username"
              className="text-input"
              name="username"
              autoComplete="username"
              data-testid="secretary-login-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label className="field-label" htmlFor="secretary-login-password">
            Password
            <input
              id="secretary-login-password"
              className="text-input"
              name="password"
              type="password"
              autoComplete="current-password"
              data-testid="secretary-login-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            data-testid="secretary-login-submit"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            type="button"
            className="btn btn-link auth-back-link"
            data-testid="secretary-login-back"
            onClick={() => navigate('/login')}
          >
            ← Back to Employee Portal
          </button>
        </form>
        <InstallAppPrompt />
      </div>
    </div>
  );
}
