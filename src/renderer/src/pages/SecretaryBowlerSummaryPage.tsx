import { Fragment, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  aggregateBowlerSummaryTotals,
  buildBowlerLedger,
  buildBowlerStatement,
  buildBowlerSummaryRows,
  buildLastTwoWeeksBalanceByBowler,
  isDepositOverdue,
  isLastTwoWeeksOverdue,
  isUsbcCardOverdue,
} from '@shared/logic/duesLedger';
import { LoadingState } from '../components/EmptyState';
import { SecretaryLeagueTabs } from '../components/SecretaryLeagueTabs';
import { formatCurrency } from '../utils/formatCurrency';
import { useSecretaryDuesData } from '../hooks/useSecretaryDuesData';

function usbcCardCellContent(overdue: boolean, usbcCardPaid: boolean): React.ReactNode {
  if (overdue) return <span className="tag tag-danger">NOT PAID</span>;
  return usbcCardPaid ? 'Paid' : '—';
}

/**
 * Milestone 9: the original app's "Bowler Summary" tab — running due/paid/
 * balance totals per bowler through the current week, with a click-to-expand
 * week-by-week statement and red OVERDUE/NOT PAID badges for anything past
 * its configured due week.
 */
export function SecretaryBowlerSummaryPage(): React.JSX.Element {
  const { leagueId: leagueIdParam } = useParams<{ leagueId: string }>();
  const leagueId = Number(leagueIdParam);
  const { league, teams, bowlers, flatEntries, isLoading, error } = useSecretaryDuesData(leagueId);

  const [expandedBowlerId, setExpandedBowlerId] = useState<number | null>(null);

  if (!leagueIdParam || Number.isNaN(leagueId)) {
    return <Navigate to="/secretary" replace />;
  }

  const rows = league
    ? buildBowlerSummaryRows(
        league,
        teams,
        bowlers,
        buildBowlerLedger(flatEntries, league.currentWeek),
        buildLastTwoWeeksBalanceByBowler(
          flatEntries,
          league.numWeeks,
          Object.fromEntries(bowlers.map((bowler) => [bowler.id, bowler.lastTwoWeeksPaid])),
        ),
      )
    : [];
  const totals = aggregateBowlerSummaryTotals(rows);
  const columnCount = 6 + (league?.sanctionedLeague ? 1 : 0) + (league?.depositFeeActive ? 3 : 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>{league ? league.name : 'Bowler Summary'}</h1>
        <Link to="/secretary" className="btn btn-link">
          ← All Leagues
        </Link>
      </div>

      <SecretaryLeagueTabs leagueId={leagueId} />

      {isLoading && <LoadingState label="Loading bowler summary…" />}
      {error && (
        <div role="alert" className="form-error">
          {error instanceof Error ? error.message : 'Failed to load bowler summary'}
        </div>
      )}

      {league && (
        <>
          <div className="kpi-row">
            <div className="card kpi-card">
              <span className="kpi-label">Bowlers Behind</span>
              <span
                className="kpi-value"
                style={totals.bowlersBehind > 0 ? { color: 'var(--color-danger)' } : undefined}
              >
                {totals.bowlersBehind}
              </span>
            </div>
            <div className="card kpi-card">
              <span className="kpi-label">Total $ Behind</span>
              <span
                className="kpi-value"
                style={totals.totalBehind > 0 ? { color: 'var(--color-danger)' } : undefined}
              >
                {formatCurrency(totals.totalBehind)}
              </span>
            </div>
            <div className="card kpi-card">
              <span className="kpi-label">Total Collected</span>
              <span className="kpi-value">{formatCurrency(totals.totalCollected)}</span>
            </div>
          </div>

          <div className="card section">
            <h2>Bowler Summary — through Week {league.currentWeek}</h2>
            <p className="help-text">Click a bowler to see their week-by-week statement.</p>
            <table className="data-table" data-testid="bowler-summary-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Bowler</th>
                  <th>Status</th>
                  <th>Total Due</th>
                  <th>Total Paid</th>
                  <th>Balance</th>
                  <th>Last 2 Wks Balance</th>
                  {league.sanctionedLeague && <th>USBC Card</th>}
                  {league.depositFeeActive && <th>Deposit Due</th>}
                  {league.depositFeeActive && <th>Deposit Paid</th>}
                  {league.depositFeeActive && <th>Deposit Balance</th>}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={columnCount}>No named bowlers yet — add some on the Roster page.</td>
                  </tr>
                )}
                {rows.map((row) => {
                  const isOpen = expandedBowlerId === row.bowlerId;
                  const lastTwoWeeksOverdue = isLastTwoWeeksOverdue(
                    row.lastTwoWeeksBalance,
                    league.currentWeek,
                    league.lastTwoWeeksDueWeek,
                  );
                  const usbcOverdue = isUsbcCardOverdue(
                    league.sanctionedLeague,
                    row.usbcCardPaid,
                    league.currentWeek,
                  );
                  const depositOverdue = isDepositOverdue(
                    league.depositFeeActive,
                    row.depositBalance,
                    league.currentWeek,
                    league.prizeFundCoverChargeDueWeek,
                  );
                  const statement = isOpen
                    ? buildBowlerStatement(row.bowlerId, league.currentWeek, flatEntries)
                    : [];
                  return (
                    <Fragment key={row.bowlerId}>
                      <tr
                        className="secretary-clickable-row"
                        onClick={() =>
                          setExpandedBowlerId(isOpen ? null : row.bowlerId)
                        }
                      >
                        <td>{row.teamName}</td>
                        <td>
                          {isOpen ? '▾' : '▸'} {row.name}
                        </td>
                        <td>
                          {row.status === 'left' ? (
                            <span className="tag tag-inactive">Left</span>
                          ) : (
                            <span className="tag tag-success">Active</span>
                          )}
                        </td>
                        <td>{formatCurrency(row.dueTotal)}</td>
                        <td>{formatCurrency(row.paidTotal)}</td>
                        <td style={row.balance > 0 ? { color: 'var(--color-danger)' } : undefined}>
                          {formatCurrency(row.balance)}
                        </td>
                        <td>
                          {lastTwoWeeksOverdue && <span className="tag tag-danger">OVERDUE</span>}{' '}
                          <span style={lastTwoWeeksOverdue ? { color: 'var(--color-danger)' } : undefined}>
                            {formatCurrency(row.lastTwoWeeksBalance)}
                          </span>
                        </td>
                        {league.sanctionedLeague && (
                          <td>
                            {usbcCardCellContent(usbcOverdue, row.usbcCardPaid)}
                          </td>
                        )}
                        {league.depositFeeActive && <td>{formatCurrency(row.depositDue)}</td>}
                        {league.depositFeeActive && <td>{formatCurrency(row.depositPaid)}</td>}
                        {league.depositFeeActive && (
                          <td>
                            {depositOverdue && <span className="tag tag-danger">OVERDUE</span>}{' '}
                            <span style={depositOverdue ? { color: 'var(--color-danger)' } : undefined}>
                              {formatCurrency(row.depositBalance)}
                            </span>
                          </td>
                        )}
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={columnCount} className="secretary-statement-cell">
                            <div className="secretary-statement-box">
                              <h3>{row.name} — Statement</h3>
                              {statement.length === 0 ? (
                                <p className="help-text">No weeks logged for this bowler yet.</p>
                              ) : (
                                <table className="data-table">
                                  <thead>
                                    <tr>
                                      <th>Week</th>
                                      <th>Weekly Due</th>
                                      <th>Amount Paid</th>
                                      <th>Running Balance</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {statement.map((weekRow) => (
                                      <tr key={weekRow.week}>
                                        <td>{weekRow.week}</td>
                                        <td>{formatCurrency(weekRow.due)}</td>
                                        <td>{formatCurrency(weekRow.paid)}</td>
                                        <td
                                          style={
                                            weekRow.balance > 0
                                              ? { color: 'var(--color-danger)' }
                                              : undefined
                                          }
                                        >
                                          {formatCurrency(weekRow.balance)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
