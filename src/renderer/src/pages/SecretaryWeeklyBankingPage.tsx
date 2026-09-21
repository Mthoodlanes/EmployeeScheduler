import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { buildFlatEntries, computeWeekStats } from '@shared/logic/duesLedger';
import { LoadingState } from '../components/EmptyState';
import { IconPrinter } from '../components/icons';
import { PrintWeeklyBanking } from '../components/PrintWeeklyBanking/PrintWeeklyBanking';
import { SecretaryLeagueTabs } from '../components/SecretaryLeagueTabs';
import { formatCurrency } from '../utils/formatCurrency';
import { useSecretaryLeague } from '../hooks/useSecretaryLeagues';
import { useSecretaryTeams } from '../hooks/useSecretaryTeams';
import { useSecretaryBowlersForLeague } from '../hooks/useSecretaryBowlers';
import { useSecretaryWeeklyEntriesForLeague } from '../hooks/useSecretaryWeeklyEntries';

/**
 * Milestone 8: the original app's "Weekly Banking" tab — the cash-handling
 * report a secretary reads off to reconcile what was actually collected.
 * "Print This Week" and each Weekly History row's own "Print" button both
 * render through the always-mounted `PrintWeeklyBanking` (see that
 * component) rather than the live page, since a physical printout needs a
 * plain, grayscale-legible layout — and unlike the current week, a history
 * row's week isn't necessarily what's on screen at all.
 */
export function SecretaryWeeklyBankingPage(): React.JSX.Element {
  const { leagueId: leagueIdParam } = useParams<{ leagueId: string }>();
  const leagueId = Number(leagueIdParam);

  const { data: league, isLoading: leagueLoading, error: leagueError } = useSecretaryLeague(leagueId);
  const { data: teams } = useSecretaryTeams(leagueId);
  const { data: allBowlers } = useSecretaryBowlersForLeague(leagueId);
  const { data: weeklyEntries } = useSecretaryWeeklyEntriesForLeague(leagueId);

  const [printWeek, setPrintWeek] = useState<number | null>(null);

  const flatEntries = useMemo(() => {
    if (!league || !allBowlers || !weeklyEntries) return [];
    return buildFlatEntries(league, allBowlers, weeklyEntries);
  }, [league, allBowlers, weeklyEntries]);

  const teamIds = useMemo(() => (teams ?? []).map((team) => team.id), [teams]);

  if (!leagueIdParam || Number.isNaN(leagueId)) {
    return <Navigate to="/secretary" replace />;
  }

  const handlePrint = (week: number): void => {
    setPrintWeek(week);
    setTimeout(() => window.print(), 50);
  };

  const currentStats = league
    ? computeWeekStats(league.currentWeek, league, teamIds, flatEntries)
    : null;
  const printStats =
    printWeek !== null && league ? computeWeekStats(printWeek, league, teamIds, flatEntries) : null;

  return (
    <div className="page">
      <div className="weekly-banking-screen">
        <div className="page-header">
          <h1>{league ? league.name : 'Weekly Banking'}</h1>
          <Link to="/secretary" className="btn btn-link">
            ← All Leagues
          </Link>
        </div>

        <SecretaryLeagueTabs leagueId={leagueId} />

        {leagueLoading && <LoadingState label="Loading weekly banking…" />}
        {leagueError && (
          <div role="alert" className="form-error">
            {leagueError instanceof Error ? leagueError.message : 'Failed to load weekly banking'}
          </div>
        )}

        {league && currentStats && (
          <>
            <div className="kpi-row">
              <div className="card kpi-card">
                <span className="kpi-label">Active Bowlers (This Week)</span>
                <span className="kpi-value">{currentStats.activeBowlers}</span>
              </div>
              <div className="card kpi-card">
                <span className="kpi-label">Requirement (Dues + Vacancy)</span>
                <span className="kpi-value">{formatCurrency(currentStats.requirement)}</span>
              </div>
              <div className="card kpi-card">
                <span className="kpi-label">League Keeps (after Lineage)</span>
                <span className="kpi-value">{formatCurrency(currentStats.leagueKeeps)}</span>
              </div>
            </div>
            {currentStats.vacantFeeTotal > 0 && (
              <p className="help-text">
                Includes {formatCurrency(currentStats.vacantFeeTotal)} in unfilled-spot vacancy
                fees owed this week — not tied to any specific bowler, so it isn&apos;t collected
                as cash unless someone covers it.
              </p>
            )}

            <div className="card section">
              <div className="weekly-banking-section-header">
                <h2>How This Week&apos;s Receipts Are Figured — Week {league.currentWeek}</h2>
                <button
                  type="button"
                  className="btn"
                  onClick={() => handlePrint(league.currentWeek)}
                >
                  <IconPrinter /> Print This Week
                </button>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Covered This Week</th>
                    <th>Prepayment Credit</th>
                    <th>Paid Down Arrears</th>
                    <th>Total Cash Collected</th>
                    <th>Lineage Pass-Through</th>
                    <th>League Keeps</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{formatCurrency(currentStats.coveredThisWeek)}</td>
                    <td>{formatCurrency(currentStats.prepaymentCredit)}</td>
                    <td>{formatCurrency(currentStats.arrearsPaydown)}</td>
                    <td>{formatCurrency(currentStats.totalCash)}</td>
                    <td>{formatCurrency(currentStats.lineagePassThrough)}</td>
                    <td>
                      <strong>{formatCurrency(currentStats.leagueKeeps)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card section">
              <h2>Weekly History</h2>
              <table className="data-table" data-testid="weekly-banking-history-table">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Active Bowlers</th>
                    <th>Requirement</th>
                    <th>Covered</th>
                    <th>Prepay Credit</th>
                    <th>Arrears Paydown</th>
                    <th>Total Cash</th>
                    <th>League Keeps</th>
                    <th aria-label="Print" />
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: league.currentWeek }, (_, index) => index + 1).map(
                    (weekNumber) => {
                      const stats = computeWeekStats(weekNumber, league, teamIds, flatEntries);
                      return (
                        <tr key={weekNumber}>
                          <td>{weekNumber}</td>
                          <td>{stats.activeBowlers}</td>
                          <td>{formatCurrency(stats.requirement)}</td>
                          <td>{formatCurrency(stats.coveredThisWeek)}</td>
                          <td>{formatCurrency(stats.prepaymentCredit)}</td>
                          <td>{formatCurrency(stats.arrearsPaydown)}</td>
                          <td>{formatCurrency(stats.totalCash)}</td>
                          <td>{formatCurrency(stats.leagueKeeps)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-link"
                              onClick={() => handlePrint(weekNumber)}
                            >
                              <IconPrinter /> Print
                            </button>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {printStats && league && (
        <PrintWeeklyBanking leagueName={league.name} week={printWeek ?? league.currentWeek} stats={printStats} />
      )}
    </div>
  );
}
