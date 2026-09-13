import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useSessionStore } from '../store/useSessionStore';

export function FirstRunSetupPage(): React.JSX.Element {
  const navigate = useNavigate();
  const setSession = useSessionStore((state) => state.setSession);
  const setFirstRun = useSessionStore((state) => state.setFirstRun);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 1) {
      setError('Password is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const employee = await api.auth.createFirstManager({ name, username, password });
      setFirstRun(false);
      setSession(employee);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
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
        <h1>Welcome to Mt Hood Lanes</h1>
        <p className="auth-subtitle">Create the first manager account to get started</p>
        {error && (
          <div role="alert" className="form-error" data-testid="first-run-error">
            {error}
          </div>
        )}
        <label className="field-label" htmlFor="setup-name">
          Full name
          <input
            id="setup-name"
            className="text-input"
            data-testid="first-run-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label className="field-label" htmlFor="setup-username">
          Username
          <input
            id="setup-username"
            className="text-input"
            autoComplete="username"
            data-testid="first-run-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>
        <label className="field-label" htmlFor="setup-password">
          Password
          <input
            id="setup-password"
            className="text-input"
            type="password"
            autoComplete="new-password"
            data-testid="first-run-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <label className="field-label" htmlFor="setup-confirm-password">
          Confirm password
          <input
            id="setup-confirm-password"
            className="text-input"
            type="password"
            autoComplete="new-password"
            data-testid="first-run-confirm-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
          data-testid="first-run-submit"
        >
          {isSubmitting ? 'Creating account…' : 'Create manager account'}
        </button>
      </form>
    </div>
  );
}
