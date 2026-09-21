import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  buildFlatEntries,
  buildRunningBalanceByWeek,
  computeStandardWeeklyDue,
  computeWeeklyDueForBowler,
} from '@shared/logic/duesLedger';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { IconBowlingPin, IconCalendar } from '../components/icons';
import { SecretaryLeagueTabs } from '../components/SecretaryLeagueTabs';
import { formatCurrency } from '../utils/formatCurrency';
import { useSecretaryLeague } from '../hooks/useSecretaryLeagues';
import { useSecretaryTeams } from '../hooks/useSecretaryTeams';
import { useSecretaryBowlersForLeague } from '../hooks/useSecretaryBowlers';
import {
  useRecordSecretaryWeeklyEntry,
  useRemoveSecretaryWeeklyEntry,
  useSecretaryWeeklyEntriesForLeague,
} from '../hooks/useSecretaryWeeklyEntries';

/**
 * Milestone 7: the original app's "Weekly Entries" tab. Auto-carry-forward
 * (see the effect below) means a week nobody has touched yet defaults every
 * bowler to whoever was checked in most recently — dues follow the person,
 * not who physically bowled that night — while staying fully editable; only
 * an actual roster change needs an uncheck.
 */
export function SecretaryWeeklyEntriesPage(): React.JSX.Element {
  const { leagueId: leagueIdParam } = useParams<{ leagueId: string }>();
  const leagueId = Number(leagueIdParam);

  const { data: league } = useSecretaryLeague(leagueId);
  const { data: teams, isLoading: teamsLoading, error: teamsError } = useSecretaryTeams(leagueId);
  const { data: allBowlers } = useSecretaryBowlersForLeague(leagueId);
  const { data: weeklyEntries } = useSecretaryWeeklyEntriesForLeague(leagueId);

  const recordEntry = useRecordSecretaryWeeklyEntry(leagueId);
  const removeEntry = useRemoveSecretaryWeeklyEntry(leagueId);

  const [week, setWeek] = useState<number | null>(null);
  const [amountDrafts, setAmountDrafts] = useState<Record<number, string>>({});

  // Initializes once from the league's current week as soon as it loads
  // (undefined on the very first render, before the query resolves); after
  // that, only clamps if `numWeeks` shrinks — never resets the week out from
  // under a secretary who has manually navigated elsewhere.
  useEffect(() => {
    if (!league) return;
    setWeek((prev) => (prev === null ? league.currentWeek : Math.min(prev, league.numWeeks)));
  }, [league]);

  // Reset per-week drafts when switching weeks — see the file header's note
  // on why amount edits are draft-then-blur rather than saved per keystroke.
  useEffect(() => {
    setAmountDrafts({});
  }, [week]);

  const flatEntries = useMemo(() => {
    if (!league || !allBowlers || !weeklyEntries) return [];
    return buildFlatEntries(league, allBowlers, weeklyEntries);
  }, [league, allBowlers, weeklyEntries]);

  const runningBalanceByWeek = useMemo(() => buildRunningBalanceByWeek(flatEntries), [flatEntries]);

  // Auto-carry-forward: only when the viewed week has no entries recorded
  // yet at all — self-terminating, since the first entry created here makes
  // this condition false on the next data refetch.
  useEffect(() => {
    if (week === null || !allBowlers) return;
    const weekHasAnyEntries = flatEntries.some((entry) => entry.week === week);
    if (weekHasAnyEntries) return;
    allBowlers.forEach((bowler) => {
      const mostRecentPrior = flatEntries
        .filter((entry) => entry.bowlerId === bowler.id && entry.week < week)
        .sort((a, b) => b.week - a.week)[0];
      if (mostRecentPrior) {
        recordEntry.mutate({ bowlerId: bowler.id, week, amountPaid: 0 });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, flatEntries, allBowlers]);

  if (!leagueIdParam || Number.isNaN(leagueId)) {
    return <Navigate to="/secretary" replace />;
  }

  const currentWeek = week ?? league?.currentWeek ?? 1;
  const numWeeks = league?.numWeeks ?? 1;
  const standardWeeklyDue = league ? computeStandardWeeklyDue(league) : 0;

  const entryFor = (bowlerId: number): { paid: number } | undefined =>
    flatEntries.find((entry) => entry.bowlerId === bowlerId && entry.week === currentWeek);

  const handleTogglePlaying = (bowlerId: number, checked: boolean): void => {
    if (checked) {
      recordEntry.mutate({ bowlerId, week: currentWeek, amountPaid: 0 });
    } else {
      removeEntry.mutate({ bowlerId, week: currentWeek });
      setAmountDrafts((prev) => {
        const next = { ...prev };
        delete next[bowlerId];
        return next;
      });
    }
  };

  const handleAmountBlur = (bowlerId: number): void => {
    const draft = amountDrafts[bowlerId];
    if (draft === undefined) return;
    const amountPaid = Number(draft);
    if (Number.isNaN(amountPaid) || amountPaid < 0) return;
    recordEntry.mutate({ bowlerId, week: currentWeek, amountPaid });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>
          <span className="secretary-page-icon">
            <IconBowlingPin />
          </span>
          {league ? league.name : 'Weekly Entries'}
        </h1>
        <Link to="/secretary" className="btn btn-link">
          ← All Leagues
        </Link>
      </div>

      <SecretaryLeagueTabs leagueId={leagueId} />

      {teamsLoading && <LoadingState label="Loading weekly entries…" />}
      {teamsError && (
        <div role="alert" className="form-error">
          {teamsError instanceof Error ? teamsError.message : 'Failed to load weekly entries'}
        </div>
      )}

      <div className="card section">
        <div className="form-actions">
          <button
            type="button"
            className="btn"
            onClick={() => setWeek(Math.max(1, currentWeek - 1))}
          >
            ← Prev
          </button>
          <strong>
            Week {currentWeek}
            {league && currentWeek === league.currentWeek ? ' (current)' : ''}
          </strong>
          <button
            type="button"
            className="btn"
            onClick={() => setWeek(Math.min(numWeeks, currentWeek + 1))}
          >
            Next →
          </button>
          <label className="field-label" htmlFor="weekly-entries-week-select">
            Jump to week
            <select
              id="weekly-entries-week-select"
              className="text-input"
              value={currentWeek}
              onChange={(event) => setWeek(Number(event.target.value))}
            >
              {Array.from({ length: numWeeks }, (_, index) => index + 1).map((weekOption) => (
                <option key={weekOption} value={weekOption}>
                  Week {weekOption}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="help-text">
          A blank week starts pre-checked with whoever played the previous time — dues follow the
          person, not who physically bowled that night. Uncheck someone only for an actual roster
          change or a real vacancy.
        </p>
      </div>

      {teams && teams.length === 0 && (
        <EmptyState
          icon={<IconCalendar />}
          title="No teams yet"
          body="Add teams and bowlers on the Roster page first."
        />
      )}

      {league &&
        (teams ?? []).map((team) => {
          const teamBowlers = (allBowlers ?? []).filter((bowler) => bowler.teamId === team.id);
          const relevantBowlers = teamBowlers.filter(
            (bowler) => bowler.status !== 'left' || entryFor(bowler.id) !== undefined,
          );
          const filledCount = relevantBowlers.filter(
            (bowler) => entryFor(bowler.id) !== undefined,
          ).length;
          const vacant = Math.max(0, league.spotsPerTeam - filledCount);

          return (
            <div key={team.id} className="card section">
              <h2>
                {team.name}
                {team.folded ? ' — FOLDED' : ''} — {filledCount}/{league.spotsPerTeam} spots filled
                {vacant > 0 && league.vacancyFee > 0
                  ? ` · ${vacant} vacant × ${formatCurrency(league.vacancyFee)} owed`
                  : ''}
              </h2>
              {relevantBowlers.length === 0 ? (
                <p className="help-text">No active bowlers on this team yet.</p>
              ) : (
                <table className="data-table" data-testid={`weekly-entries-table-${team.id}`}>
                  <thead>
                    <tr>
                      <th>Playing?</th>
                      <th>Bowler</th>
                      <th>Amount Paid</th>
                      <th>Weekly Due</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relevantBowlers.map((bowler) => {
                      const entry = entryFor(bowler.id);
                      const playing = entry !== undefined;
                      const due = playing ? computeWeeklyDueForBowler(standardWeeklyDue, league, bowler) : 0;
                      const balance = runningBalanceByWeek[bowler.id]?.[currentWeek] ?? 0;
                      const amountValue =
                        amountDrafts[bowler.id] ?? (playing ? entry.paid.toFixed(2) : '0.00');
                      return (
                        <tr key={bowler.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={playing}
                              aria-label={`${bowler.name} playing in week ${currentWeek}`}
                              onChange={(event) =>
                                handleTogglePlaying(bowler.id, event.target.checked)
                              }
                            />
                          </td>
                          <td>{bowler.name || '(unnamed)'}</td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              className="text-input text-input-narrow"
                              disabled={!playing}
                              value={amountValue}
                              aria-label={`${bowler.name} amount paid week ${currentWeek}`}
                              onChange={(event) =>
                                setAmountDrafts((prev) => ({
                                  ...prev,
                                  [bowler.id]: event.target.value,
                                }))
                              }
                              onBlur={() => handleAmountBlur(bowler.id)}
                            />
                          </td>
                          <td>{formatCurrency(due)}</td>
                          <td style={balance > 0 ? { color: 'var(--color-danger)' } : undefined}>
                            {formatCurrency(balance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
    </div>
  );
}
