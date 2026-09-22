import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { DuesTrackerBackup } from '@shared/types/domain';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { IconBowlingPin } from '../components/icons';
import { useEmployees } from '../hooks/useEmployees';
import { useSessionStore } from '../store/useSessionStore';
import {
  useCreateSecretaryBackup,
  useRestoreSecretaryBackup,
  useSecretaryBackups,
} from '../hooks/useSecretaryBackups';
import {
  useCreateSecretaryLeague,
  useRemoveSecretaryLeague,
  useSecretaryLeagues,
} from '../hooks/useSecretaryLeagues';

const RESTORE_CONFIRMATION_PHRASE = 'RESTORE';

function formatBackupDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

interface RestoreDialogProps {
  backup: DuesTrackerBackup;
  currentLeagueCount: number;
  onRestore: (confirmationText: string) => void;
  onCancel: () => void;
  isRestoring: boolean;
  error: string | null;
}

/**
 * The one genuinely high-stakes confirm flow in the whole Secretary area —
 * a restore replaces EVERY league at once, not just the one someone
 * happens to be looking at. Typing the exact phrase (validated server-side
 * too — see `duesTrackerBackupService.ts`) is deliberately more friction
 * than a plain Yes/No click, matching how GitHub gates deleting a repo.
 */
function RestoreConfirmDialog({
  backup,
  currentLeagueCount,
  onRestore,
  onCancel,
  isRestoring,
  error,
}: RestoreDialogProps): React.JSX.Element {
  const [confirmationText, setConfirmationText] = useState('');
  const canConfirm = confirmationText === RESTORE_CONFIRMATION_PHRASE;

  return (
    <Modal testId="restore-backup-dialog">
      <h2>Restore this backup?</h2>
      <p>
        This replaces every league, team, bowler, and weekly entry currently in the tracker with
        the contents of this backup — there is no separate way to select individual leagues.
      </p>
      <p className="modal-subtitle">
        Currently in the tracker: <strong>{currentLeagueCount}</strong> league
        {currentLeagueCount === 1 ? '' : 's'}.
        <br />
        This backup ({formatBackupDate(backup.createdAt)}
        {backup.label ? ` — ${backup.label}` : ''}): <strong>{backup.leagueCount}</strong> league
        {backup.leagueCount === 1 ? '' : 's'}, {backup.teamCount} team
        {backup.teamCount === 1 ? '' : 's'}, {backup.bowlerCount} bowler
        {backup.bowlerCount === 1 ? '' : 's'}, {backup.weeklyEntryCount} weekly entr
        {backup.weeklyEntryCount === 1 ? 'y' : 'ies'}.
      </p>
      <p className="modal-subtitle">
        Whatever is currently in the tracker is automatically saved as its own backup first, so
        this can be undone by restoring that one if needed.
      </p>
      {error && (
        <div role="alert" className="form-error">
          {error}
        </div>
      )}
      <label className="form-row" htmlFor="restore-confirmation-text">
        <span className="form-row-label">
          Type <strong>{RESTORE_CONFIRMATION_PHRASE}</strong> to confirm
        </span>
        <input
          id="restore-confirmation-text"
          className="text-input"
          value={confirmationText}
          onChange={(event) => setConfirmationText(event.target.value)}
          autoComplete="off"
          data-testid="restore-confirmation-input"
        />
      </label>
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-danger"
          disabled={!canConfirm || isRestoring}
          onClick={() => onRestore(confirmationText)}
          data-testid="restore-confirmation-submit"
        >
          Restore
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

/**
 * Milestone 5: the "Choose a League" screen from the original app — every
 * league lives in one shared list (no per-creator scoping, see
 * `leagueRepo.ts`'s comment), so any Secretary-area account sees every
 * league here. Creating a league here jumps straight into its Setup page,
 * matching the original app's flow of configuring a brand new league right
 * after naming it.
 */
export function SecretaryLeaguesPage(): React.JSX.Element {
  const currentEmployee = useSessionStore((state) => state.currentEmployee);
  const isManager = currentEmployee?.role === 'manager';

  const { data: leagues, isLoading, error } = useSecretaryLeagues();
  const createLeague = useCreateSecretaryLeague();
  const removeLeague = useRemoveSecretaryLeague();

  const { data: employees } = useEmployees();
  const {
    data: backups,
    isLoading: isBackupsLoading,
    error: backupsError,
  } = useSecretaryBackups();
  const createBackup = useCreateSecretaryBackup();
  const restoreBackup = useRestoreSecretaryBackup();

  const [newLeagueName, setNewLeagueName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [backupLabel, setBackupLabel] = useState('');
  const [backupFormError, setBackupFormError] = useState<string | null>(null);
  const [pendingRestoreId, setPendingRestoreId] = useState<number | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const handleCreate = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(null);
    try {
      await createLeague.mutateAsync({
        name: newLeagueName,
        spotsPerTeam: 4,
        numWeeks: 33,
        currentWeek: 1,
        prizeFund: 0,
        lineage: 0,
        sweeperActive: false,
        sweeperAmount: 0,
        vacancyFee: 0,
        lineageDiscountAmount: 0,
        prizeFundDiscountAmount: 0,
        sponsorFeePerTeam: 0,
        sponsorFeeActive: false,
        depositFeeActive: false,
        depositFeeAmount: 0,
        sponsorFeeDueWeek: 0,
        prizeFundCoverChargeDueWeek: 0,
        lastTwoWeeksDueWeek: 0,
        sanctionedLeague: true,
      });
      setNewLeagueName('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create league');
    }
  };

  const pendingDeleteLeague = leagues?.find((league) => league.id === pendingDeleteId) ?? null;
  const pendingRestoreBackup = backups?.find((backup) => backup.id === pendingRestoreId) ?? null;
  const employeeNameById = new Map((employees ?? []).map((employee) => [employee.id, employee.name]));

  const handleCreateBackup = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBackupFormError(null);
    try {
      await createBackup.mutateAsync(backupLabel.trim() ? backupLabel.trim() : null);
      setBackupLabel('');
    } catch (err) {
      setBackupFormError(err instanceof Error ? err.message : 'Could not create backup');
    }
  };

  const handleRestore = async (confirmationText: string): Promise<void> => {
    if (!pendingRestoreBackup) return;
    setRestoreError(null);
    try {
      await restoreBackup.mutateAsync({ id: pendingRestoreBackup.id, confirmationText });
      setPendingRestoreId(null);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Could not restore backup');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Leagues</h1>
      </div>

      <div className="card section">
        {isLoading && <LoadingState label="Loading leagues…" />}
        {error && (
          <div role="alert" className="form-error">
            {error instanceof Error ? error.message : 'Failed to load leagues'}
          </div>
        )}
        {leagues && leagues.length === 0 && !isLoading && (
          <EmptyState
            icon={<IconBowlingPin />}
            title="No leagues yet"
            body="Add one below to start tracking its dues."
          />
        )}
        {leagues && leagues.length > 0 && (
          <table className="data-table" data-testid="secretary-leagues-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Season length</th>
                <th>Current week</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {leagues.map((league) => (
                <tr key={league.id}>
                  <td>
                    <Link to={`/secretary/leagues/${league.id}`}>{league.name}</Link>
                  </td>
                  <td>{league.numWeeks} weeks</td>
                  <td>{league.currentWeek}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-link"
                      onClick={() => setPendingDeleteId(league.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Add league</h2>
        <form
          className="form-grid"
          onSubmit={(event) => {
            handleCreate(event);
          }}
        >
          {formError && (
            <div role="alert" className="form-error">
              {formError}
            </div>
          )}
          <div className="secretary-form-rows">
            <label className="secretary-form-row" htmlFor="new-league-name">
              <span className="secretary-form-row-label">League name</span>
              <input
                id="new-league-name"
                className="text-input"
                value={newLeagueName}
                onChange={(event) => setNewLeagueName(event.target.value)}
                required
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={createLeague.isPending}>
              Add league
            </button>
          </div>
        </form>
      </div>

      <div className="card section">
        <h2>Backups</h2>
        <p className="modal-subtitle">
          A save/restore snapshot of every league, team, bowler, and weekly entry — separate from
          the rest of the app&rsquo;s data, so a restore here can never touch employees, shifts,
          or time off.
        </p>

        {isBackupsLoading && <LoadingState label="Loading backups…" />}
        {backupsError && (
          <div role="alert" className="form-error">
            {backupsError instanceof Error ? backupsError.message : 'Failed to load backups'}
          </div>
        )}
        {backups && backups.length === 0 && !isBackupsLoading && (
          <EmptyState title="No backups yet" body="Create one below before making a big change." />
        )}
        {backups && backups.length > 0 && (
          <table className="data-table" data-testid="secretary-backups-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Label</th>
                <th>Source</th>
                <th>By</th>
                <th>Contents</th>
                {isManager && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr key={backup.id}>
                  <td>{formatBackupDate(backup.createdAt)}</td>
                  <td>{backup.label ?? '—'}</td>
                  <td>
                    {backup.source === 'pre_restore' ? (
                      <span className="tag tag-warning">Auto (before a restore)</span>
                    ) : (
                      <span className="tag">Manual</span>
                    )}
                  </td>
                  <td>{employeeNameById.get(backup.createdByEmployeeId) ?? '—'}</td>
                  <td>
                    {backup.leagueCount} league{backup.leagueCount === 1 ? '' : 's'},{' '}
                    {backup.teamCount} team{backup.teamCount === 1 ? '' : 's'},{' '}
                    {backup.bowlerCount} bowler{backup.bowlerCount === 1 ? '' : 's'},{' '}
                    {backup.weeklyEntryCount} entr{backup.weeklyEntryCount === 1 ? 'y' : 'ies'}
                  </td>
                  {isManager && (
                    <td>
                      <button
                        type="button"
                        className="btn btn-link"
                        onClick={() => {
                          setRestoreError(null);
                          setPendingRestoreId(backup.id);
                        }}
                        data-testid={`restore-backup-${backup.id}`}
                      >
                        Restore
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form
          className="form-top-gap"
          onSubmit={(event) => {
            handleCreateBackup(event);
          }}
        >
          {backupFormError && (
            <div role="alert" className="form-error">
              {backupFormError}
            </div>
          )}
          <div className="form-rows">
            <label className="form-row" htmlFor="backup-label">
              <span className="form-row-label">Label (optional)</span>
              <input
                id="backup-label"
                className="text-input"
                placeholder="Before merging Fall league"
                value={backupLabel}
                onChange={(event) => setBackupLabel(event.target.value)}
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={createBackup.isPending}>
              Create Backup
            </button>
          </div>
        </form>
      </div>

      {pendingDeleteLeague && (
        <ConfirmDialog
          title="Delete this league?"
          message={`This permanently deletes "${pendingDeleteLeague.name}" and every team, bowler, and weekly entry recorded under it.`}
          confirmLabel="Delete"
          onConfirm={() => {
            removeLeague.mutateAsync(pendingDeleteLeague.id).then(() => setPendingDeleteId(null));
          }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}

      {pendingRestoreBackup && (
        <RestoreConfirmDialog
          backup={pendingRestoreBackup}
          currentLeagueCount={leagues?.length ?? 0}
          isRestoring={restoreBackup.isPending}
          error={restoreError}
          onRestore={handleRestore}
          onCancel={() => {
            setPendingRestoreId(null);
            setRestoreError(null);
          }}
        />
      )}
    </div>
  );
}
