import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  aggregateLeagueTotals,
  buildBowlerLedger,
  buildLastTwoWeeksBalanceByBowler,
  buildTeamSummaryRows,
  isSponsorFeeOverdue,
} from '@shared/logic/duesLedger';
import { LoadingState } from '../components/EmptyState';
import { SecretaryLeagueTabs } from '../components/SecretaryLeagueTabs';
import { formatCurrency } from '../utils/formatCurrency';
import { useSecretaryDuesData } from '../hooks/useSecretaryDuesData';
import { useUpdateSecretaryTeam } from '../hooks/useSecretaryTeams';

/**
 * Milestone 9: the original app's "Season Summary" tab — team-level due/
 * paid/balance totals (including each team's season-long vacancy fees) plus
 * the sponsor fee ledger, with a League Total footer row. Marking a team
 * "Folded" here is informational only — the original app's own note that a
 * folded team's history always stays counted, since deleting one is only
 * ever allowed once its roster is empty anyway.
 */
export function SecretarySeasonSummaryPage(): React.JSX.Element {
  const { leagueId: leagueIdParam } = useParams<{ leagueId: string }>();
  const leagueId = Number(leagueIdParam);
  const { league, teams, bowlers, flatEntries, isLoading, error } = useSecretaryDuesData(leagueId);
  const updateTeam = useUpdateSecretaryTeam(leagueId);

  const [sponsorDrafts, setSponsorDrafts] = useState<Record<number, string>>({});

  if (!leagueIdParam || Number.isNaN(leagueId)) {
    return <Navigate to="/secretary" replace />;
  }

  const rows = league
    ? buildTeamSummaryRows(
        league,
        teams,
        bowlers,
        buildBowlerLedger(flatEntries, league.currentWeek),
        flatEntries,
        buildLastTwoWeeksBalanceByBowler(flatEntries, league.numWeeks),
      )
    : [];
  const leagueTotals = aggregateLeagueTotals(rows);
  const columnCount = 5 + (league?.sponsorFeeActive ? 3 : 0);

  const handleToggleFolded = (teamId: number, folded: boolean): void => {
    const team = teams.find((candidate) => candidate.id === teamId);
    if (!team) return;
    updateTeam.mutate({ id: teamId, name: team.name, folded: !folded, sponsorPaid: team.sponsorPaid });
  };

  const handleSponsorPaidBlur = (teamId: number): void => {
    const draft = sponsorDrafts[teamId];
    if (draft === undefined) return;
    const team = teams.find((candidate) => candidate.id === teamId);
    if (!team) return;
    const sponsorPaid = Number(draft);
    if (Number.isNaN(sponsorPaid) || sponsorPaid < 0) return;
    updateTeam.mutate({ id: teamId, name: team.name, folded: team.folded, sponsorPaid });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>{league ? league.name : 'Season Summary'}</h1>
        <Link to="/secretary" className="btn btn-link">
          ← All Leagues
        </Link>
      </div>

      <SecretaryLeagueTabs leagueId={leagueId} />

      {isLoading && <LoadingState label="Loading season summary…" />}
      {error && (
        <div role="alert" className="form-error">
          {error instanceof Error ? error.message : 'Failed to load season summary'}
        </div>
      )}

      {league && (
        <div className="card section">
          <h2>Season Summary — through Week {league.currentWeek}</h2>
          <table className="data-table" data-testid="season-summary-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Status</th>
                <th>Dues Due</th>
                <th>Dues Paid</th>
                <th>Dues Balance</th>
                <th>Last 2 Wks Balance</th>
                {league.sponsorFeeActive && <th>Sponsor Fee</th>}
                {league.sponsorFeeActive && <th>Sponsor Paid</th>}
                {league.sponsorFeeActive && <th>Sponsor Balance</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columnCount}>No teams yet.</td>
                </tr>
              )}
              {rows.map((row) => {
                const sponsorOverdue = isSponsorFeeOverdue(
                  league.sponsorFeeActive,
                  row.sponsorBalance,
                  league.currentWeek,
                  league.sponsorFeeDueWeek,
                );
                const lastTwoWeeksOverdue =
                  row.lastTwoWeeksBalance > 0 && league.currentWeek >= league.lastTwoWeeksDueWeek;
                const sponsorPaidValue = sponsorDrafts[row.teamId] ?? row.sponsorPaid.toFixed(2);
                return (
                  <tr key={row.teamId}>
                    <td>{row.name}</td>
                    <td>
                      <button
                        type="button"
                        className={row.folded ? 'btn btn-toggle active' : 'btn btn-toggle'}
                        onClick={() => handleToggleFolded(row.teamId, row.folded)}
                      >
                        {row.folded ? 'Folded' : 'Active'}
                      </button>
                    </td>
                    <td>{formatCurrency(row.due)}</td>
                    <td>{formatCurrency(row.paid)}</td>
                    <td style={row.balance > 0 ? { color: 'var(--color-danger)' } : undefined}>
                      {formatCurrency(row.balance)}
                    </td>
                    <td>
                      {lastTwoWeeksOverdue && <span className="tag tag-danger">OVERDUE</span>}{' '}
                      <span style={lastTwoWeeksOverdue ? { color: 'var(--color-danger)' } : undefined}>
                        {formatCurrency(row.lastTwoWeeksBalance)}
                      </span>
                    </td>
                    {league.sponsorFeeActive && <td>{formatCurrency(row.sponsorDue)}</td>}
                    {league.sponsorFeeActive && (
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          className="text-input text-input-narrow"
                          aria-label={`${row.name} sponsor paid`}
                          value={sponsorPaidValue}
                          onChange={(event) =>
                            setSponsorDrafts((prev) => ({
                              ...prev,
                              [row.teamId]: event.target.value,
                            }))
                          }
                          onBlur={() => handleSponsorPaidBlur(row.teamId)}
                        />
                      </td>
                    )}
                    {league.sponsorFeeActive && (
                      <td>
                        {sponsorOverdue && <span className="tag tag-danger">OVERDUE</span>}{' '}
                        <span style={sponsorOverdue ? { color: 'var(--color-danger)' } : undefined}>
                          {formatCurrency(row.sponsorBalance)}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    <strong>League Total</strong>
                  </td>
                  <td>
                    <strong>{formatCurrency(leagueTotals.due)}</strong>
                  </td>
                  <td>
                    <strong>{formatCurrency(leagueTotals.paid)}</strong>
                  </td>
                  <td>
                    <strong>{formatCurrency(leagueTotals.due - leagueTotals.paid)}</strong>
                  </td>
                  <td>
                    <strong>{formatCurrency(leagueTotals.lastTwoWeeksBalance)}</strong>
                  </td>
                  {league.sponsorFeeActive && (
                    <td>
                      <strong>{formatCurrency(leagueTotals.sponsorDue)}</strong>
                    </td>
                  )}
                  {league.sponsorFeeActive && (
                    <td>
                      <strong>{formatCurrency(leagueTotals.sponsorPaid)}</strong>
                    </td>
                  )}
                  {league.sponsorFeeActive && (
                    <td>
                      <strong>
                        {formatCurrency(leagueTotals.sponsorDue - leagueTotals.sponsorPaid)}
                      </strong>
                    </td>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
          <p className="help-text">
            Marking a team &quot;Folded&quot; is informational only — deleting a team is only
            allowed once its roster is empty, so a folded team&apos;s history always stays counted
            in the League Total.
          </p>
        </div>
      )}
    </div>
  );
}
