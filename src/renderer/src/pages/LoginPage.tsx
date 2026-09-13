import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useSessionStore } from '../store/useSessionStore';

export function LoginPage(): React.JSX.Element {
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
      setSession(employee);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <form
        className="auth-card"
        onSubmit={(event) => {
          handleSubmit(event);
        }}
      >
        <img className="auth-logo" src="./mt-hood-lanes-logo.png" alt="Mt Hood Lanes" />
        <h1>Mt Hood Lanes</h1>
        <p className="auth-subtitle">Sign in to view or manage the schedule</p>
        {error && (
          <div role="alert" className="form-error" data-testid="login-error">
            {error}
          </div>
        )}
        <label className="field-label" htmlFor="login-username">
          Username
          <input
            id="login-username"
            className="text-input"
            name="username"
            autoComplete="username"
            data-testid="login-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>
        <label className="field-label" htmlFor="login-password">
          Password
          <input
            id="login-password"
            className="text-input"
            name="password"
            type="password"
            autoComplete="current-password"
            data-testid="login-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
          data-testid="login-submit"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
