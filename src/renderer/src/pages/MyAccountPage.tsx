import { useState } from 'react';
import type { FormEvent } from 'react';
import { InstallAppPrompt } from '../components/InstallAppPrompt';
import { useSessionStore } from '../store/useSessionStore';
import { useUpdateOwnProfile } from '../hooks/useEmployees';

/**
 * Self-service account page: reachable by ANY logged-in user (employee or
 * manager), unlike `EmployeesAdminPage` which is manager-only and can edit
 * anyone. This page only ever acts on the caller's own record
 * (`employees:updateOwnProfile` / `PUT /api/employees/me`), and can only
 * change the display name and password — never role/departments/
 * isSalaried/isActive, which stay exclusively manager-editable.
 *
 * The "Change Password" fields are entirely optional: leaving all three
 * blank submits a name-only update with no password check. Touching any one
 * of them enters "changing password" mode, which requires all three
 * (current/new/confirm) and that new/confirm match, validated client-side
 * before the request is even sent — the server still separately verifies
 * the current password via bcrypt, since a shared store computer means a
 * left-open session must not let a passerby take over the account just by
 * typing a new password.
 */
export function MyAccountPage(): React.JSX.Element {
  const currentEmployee = useSessionStore((state) => state.currentEmployee);
  const setSession = useSessionStore((state) => state.setSession);
  const updateOwnProfile = useUpdateOwnProfile();

  const [name, setName] = useState(currentEmployee?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isChangingPassword =
    currentPassword !== '' || newPassword !== '' || confirmNewPassword !== '';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Full name is required.');
      return;
    }

    if (isChangingPassword) {
      if (!currentPassword) {
        setFormError('Enter your current password to set a new one.');
        return;
      }
      if (!newPassword) {
        setFormError('Enter a new password.');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setFormError('New password and confirmation do not match.');
        return;
      }
    }

    try {
      const updated = await updateOwnProfile.mutateAsync({
        name: trimmedName,
        currentPassword: isChangingPassword ? currentPassword : undefined,
        newPassword: isChangingPassword ? newPassword : undefined,
      });
      setSession(updated);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setSuccessMessage(
        isChangingPassword
          ? 'Your name and password have been updated.'
          : 'Your name has been updated.',
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not update your account');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Account</h1>
      </div>

      <InstallAppPrompt />

      <div className="card section">
        <form className="form-grid" onSubmit={handleSubmit}>
          {formError && (
            <div role="alert" className="form-error" data-testid="my-account-error">
              {formError}
            </div>
          )}
          {successMessage && (
            <div role="status" className="form-success" data-testid="my-account-success">
              {successMessage}
            </div>
          )}

          <label className="field-label" htmlFor="my-account-name">
            Full name
            <input
              id="my-account-name"
              className="text-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              data-testid="my-account-name"
              required
            />
          </label>

          <h2>Change Password</h2>
          <p className="modal-subtitle">
            Leave these blank to keep your current password. Changing it requires your current
            password.
          </p>

          <label className="field-label" htmlFor="my-account-current-password">
            Current password
            <input
              id="my-account-current-password"
              type="password"
              className="text-input"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              data-testid="my-account-current-password"
            />
          </label>

          <label className="field-label" htmlFor="my-account-new-password">
            New password
            <input
              id="my-account-new-password"
              type="password"
              className="text-input"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              data-testid="my-account-new-password"
            />
          </label>

          <label className="field-label" htmlFor="my-account-confirm-password">
            Confirm new password
            <input
              id="my-account-confirm-password"
              type="password"
              className="text-input"
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              autoComplete="new-password"
              data-testid="my-account-confirm-password"
            />
          </label>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={updateOwnProfile.isPending}
              data-testid="my-account-submit"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
