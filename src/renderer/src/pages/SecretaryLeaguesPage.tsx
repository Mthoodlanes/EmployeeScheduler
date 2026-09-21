import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { IconBowlingPin } from '../components/icons';
import {
  useCreateSecretaryLeague,
  useRemoveSecretaryLeague,
  useSecretaryLeagues,
} from '../hooks/useSecretaryLeagues';

/**
 * Milestone 5: the "Choose a League" screen from the original app — every
 * league lives in one shared list (no per-creator scoping, see
 * `leagueRepo.ts`'s comment), so any Secretary-area account sees every
 * league here. Creating a league here jumps straight into its Setup page,
 * matching the original app's flow of configuring a brand new league right
 * after naming it.
 */
export function SecretaryLeaguesPage(): React.JSX.Element {
  const { data: leagues, isLoading, error } = useSecretaryLeagues();
  const createLeague = useCreateSecretaryLeague();
  const removeLeague = useRemoveSecretaryLeague();

  const [newLeagueName, setNewLeagueName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

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
          <div className="secretary-field-grid">
            <label className="field-label" htmlFor="new-league-name">
              League name
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
    </div>
  );
}
