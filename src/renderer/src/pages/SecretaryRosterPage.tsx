import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { Bowler, BowlerStatus } from '@shared/types/domain';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { IconUsers } from '../components/icons';
import { SecretaryLeagueTabs } from '../components/SecretaryLeagueTabs';
import { useSecretaryLeague } from '../hooks/useSecretaryLeagues';
import {
  useCreateSecretaryTeam,
  useRemoveEmptySecretaryTeams,
  useRemoveSecretaryTeam,
  useSecretaryTeams,
  useUpdateSecretaryTeam,
} from '../hooks/useSecretaryTeams';
import {
  useCreateSecretaryBowler,
  useRemoveSecretaryBowler,
  useSecretaryBowlersForLeague,
  useUpdateSecretaryBowler,
} from '../hooks/useSecretaryBowlers';
import { useSecretaryWeeklyEntriesForLeague } from '../hooks/useSecretaryWeeklyEntries';

interface BowlerFormState {
  id: number | null;
  name: string;
  status: BowlerStatus;
  phone: string;
  lineageDiscount: boolean;
  prizeFundDiscount: boolean;
  dropNoticeWeek: string;
  notes: string;
  depositPaid: number;
  depositOptOut: boolean;
  usbcCardPaid: boolean;
}

const EMPTY_BOWLER_FORM: BowlerFormState = {
  id: null,
  name: '',
  status: 'active',
  phone: '',
  lineageDiscount: false,
  prizeFundDiscount: false,
  dropNoticeWeek: '',
  notes: '',
  depositPaid: 0,
  depositOptOut: false,
  usbcCardPaid: false,
};

function toBowlerFormState(bowler: Bowler): BowlerFormState {
  return {
    id: bowler.id,
    name: bowler.name,
    status: bowler.status,
    phone: bowler.phone,
    lineageDiscount: bowler.lineageDiscount,
    prizeFundDiscount: bowler.prizeFundDiscount,
    dropNoticeWeek: bowler.dropNoticeWeek,
    notes: bowler.notes,
    depositPaid: bowler.depositPaid,
    depositOptOut: bowler.depositOptOut,
    usbcCardPaid: bowler.usbcCardPaid,
  };
}

/**
 * Milestone 6: the original app's "Teams & Roster" tab. A bowler keeps their
 * own identity/history even if someone else subs in some week — mark them
 * "Left" via the status field rather than deleting; deleting is blocked
 * entirely once a bowler has weekly-entry history (see `hasEntries` below),
 * matching the original app's same safeguard.
 */
export function SecretaryRosterPage(): React.JSX.Element {
  const { leagueId: leagueIdParam } = useParams<{ leagueId: string }>();
  const leagueId = Number(leagueIdParam);

  const { data: league } = useSecretaryLeague(leagueId);
  const { data: teams, isLoading: teamsLoading, error: teamsError } = useSecretaryTeams(leagueId);
  const { data: allBowlers } = useSecretaryBowlersForLeague(leagueId);
  const { data: weeklyEntries } = useSecretaryWeeklyEntriesForLeague(leagueId);

  const createTeam = useCreateSecretaryTeam(leagueId);
  const updateTeam = useUpdateSecretaryTeam(leagueId);
  const removeTeam = useRemoveSecretaryTeam(leagueId);
  const removeEmptyTeams = useRemoveEmptySecretaryTeams(leagueId);

  const createBowler = useCreateSecretaryBowler(leagueId);
  const updateBowler = useUpdateSecretaryBowler(leagueId);
  const removeBowler = useRemoveSecretaryBowler(leagueId);

  const [activeTeamId, setActiveTeamId] = useState<number | null>(null);
  const [teamNameDraft, setTeamNameDraft] = useState('');
  const [pendingDeleteTeamId, setPendingDeleteTeamId] = useState<number | null>(null);
  const [confirmRemoveEmpty, setConfirmRemoveEmpty] = useState(false);
  const [bowlerForm, setBowlerForm] = useState<BowlerFormState>(EMPTY_BOWLER_FORM);
  const [bowlerFormError, setBowlerFormError] = useState<string | null>(null);
  const [pendingDeleteBowlerId, setPendingDeleteBowlerId] = useState<number | null>(null);

  useEffect(() => {
    if (!teams) return;
    if (activeTeamId === null && teams.length > 0) {
      setActiveTeamId(teams[0].id);
    } else if (activeTeamId !== null && !teams.some((team) => team.id === activeTeamId)) {
      setActiveTeamId(teams[0]?.id ?? null);
    }
  }, [teams, activeTeamId]);

  const activeTeam = teams?.find((team) => team.id === activeTeamId) ?? null;

  // Intentionally keyed on the team's identity, not its name — this should
  // reset the drafts when switching teams, not on every keystroke's
  // save-triggered refetch of the team currently being edited.
  useEffect(() => {
    setTeamNameDraft(activeTeam?.name ?? '');
    setBowlerForm(EMPTY_BOWLER_FORM);
    setBowlerFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeam?.id]);

  if (!leagueIdParam || Number.isNaN(leagueId)) {
    return <Navigate to="/secretary" replace />;
  }

  const bowlerCountByTeamId = new Map<number, number>();
  (allBowlers ?? []).forEach((bowler) => {
    bowlerCountByTeamId.set(bowler.teamId, (bowlerCountByTeamId.get(bowler.teamId) ?? 0) + 1);
  });
  const emptyTeamCount = (teams ?? []).filter(
    (team) => (bowlerCountByTeamId.get(team.id) ?? 0) === 0,
  ).length;

  const teamBowlers = (allBowlers ?? []).filter((bowler) => bowler.teamId === activeTeamId);
  const hasEntries = (bowlerId: number): boolean =>
    (weeklyEntries ?? []).some((entry) => entry.bowlerId === bowlerId);

  const handleAddTeam = async (): Promise<void> => {
    const created = await createTeam.mutateAsync({
      name: `Team ${(teams?.length ?? 0) + 1}`,
      folded: false,
      sponsorPaid: 0,
    });
    setActiveTeamId(created.id);
  };

  const handleTeamNameBlur = (): void => {
    if (!activeTeam || teamNameDraft === activeTeam.name) return;
    updateTeam.mutateAsync({
      id: activeTeam.id,
      name: teamNameDraft,
      folded: activeTeam.folded,
      sponsorPaid: activeTeam.sponsorPaid,
    });
  };

  const handleToggleFolded = (): void => {
    if (!activeTeam) return;
    updateTeam.mutateAsync({
      id: activeTeam.id,
      name: activeTeam.name,
      folded: !activeTeam.folded,
      sponsorPaid: activeTeam.sponsorPaid,
    });
  };

  const handleBowlerSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!activeTeam) return;
    setBowlerFormError(null);
    const input = {
      name: bowlerForm.name,
      status: bowlerForm.status,
      phone: bowlerForm.phone,
      lineageDiscount: bowlerForm.lineageDiscount,
      prizeFundDiscount: bowlerForm.prizeFundDiscount,
      dropNoticeWeek: bowlerForm.dropNoticeWeek,
      notes: bowlerForm.notes,
      depositPaid: bowlerForm.depositPaid,
      depositOptOut: bowlerForm.depositOptOut,
      usbcCardPaid: bowlerForm.usbcCardPaid,
    };
    try {
      if (bowlerForm.id !== null) {
        await updateBowler.mutateAsync({ id: bowlerForm.id, ...input });
      } else {
        await createBowler.mutateAsync({ teamId: activeTeam.id, input });
      }
      setBowlerForm(EMPTY_BOWLER_FORM);
    } catch (err) {
      setBowlerFormError(err instanceof Error ? err.message : 'Could not save bowler');
    }
  };

  const pendingDeleteBowler = teamBowlers.find((bowler) => bowler.id === pendingDeleteBowlerId);
  const isBowlerFormEditing = bowlerForm.id !== null;
  const isSavingBowler = createBowler.isPending || updateBowler.isPending;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{league ? league.name : 'Roster'}</h1>
        <Link to="/secretary" className="btn btn-link">
          ← All Leagues
        </Link>
      </div>

      <SecretaryLeagueTabs leagueId={leagueId} />

      {teamsLoading && <LoadingState label="Loading roster…" />}
      {teamsError && (
        <div role="alert" className="form-error">
          {teamsError instanceof Error ? teamsError.message : 'Failed to load roster'}
        </div>
      )}

      <div className="card section">
        <p className="help-text">
          Add as many teams and bowlers as your league actually has. A bowler keeps their own
          identity and dues history even if someone else subs in some week — if someone leaves
          mid-season, mark them Left instead of removing them, so their history stays intact.
        </p>
        <div className="secretary-league-tabs">
          {(teams ?? []).map((team) => (
            <button
              key={team.id}
              type="button"
              className={team.id === activeTeamId ? 'btn btn-toggle active' : 'btn btn-toggle'}
              onClick={() => setActiveTeamId(team.id)}
            >
              {team.name}
              {team.folded ? ' (Folded)' : ''}
            </button>
          ))}
          <button type="button" className="btn" onClick={handleAddTeam} disabled={createTeam.isPending}>
            + Add Team
          </button>
          {emptyTeamCount > 0 && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setConfirmRemoveEmpty(true)}
            >
              Remove Empty Teams ({emptyTeamCount})
            </button>
          )}
        </div>

        {teams && teams.length === 0 && (
          <EmptyState
            icon={<IconUsers />}
            title="No teams yet"
            body='Click "+ Add Team" to start building the roster.'
          />
        )}

        {activeTeam && (
          <>
            <div className="secretary-toolbar">
              <input
                id="roster-team-name"
                aria-label="Team name"
                className="text-input secretary-inline-input"
                value={teamNameDraft}
                onChange={(event) => setTeamNameDraft(event.target.value)}
                onBlur={handleTeamNameBlur}
              />
              <button type="button" className="btn btn-toggle" onClick={handleToggleFolded}>
                {activeTeam.folded ? 'Folded' : 'Active'}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={(bowlerCountByTeamId.get(activeTeam.id) ?? 0) > 0}
                title={
                  (bowlerCountByTeamId.get(activeTeam.id) ?? 0) > 0
                    ? 'Remove all bowlers first, or mark the team Folded instead'
                    : 'Delete this team'
                }
                onClick={() => setPendingDeleteTeamId(activeTeam.id)}
              >
                Delete Team
              </button>
            </div>

            {teamBowlers.length === 0 ? (
              <EmptyState title="No bowlers on this team yet" body="Add one below." />
            ) : (
              <table className="data-table" data-testid="secretary-roster-bowlers-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Phone</th>
                    {league?.sanctionedLeague && <th>USBC Card</th>}
                    <th>Lineage Disc.</th>
                    <th>Prize Fund Disc.</th>
                    <th>Drop Notice Wk</th>
                    {league?.depositFeeActive && <th>Deposit Paid</th>}
                    {league?.depositFeeActive && <th>Deposit Opt-Out</th>}
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {teamBowlers.map((bowler) => (
                    <tr key={bowler.id}>
                      <td>{bowler.name}</td>
                      <td>
                        {bowler.status === 'left' ? (
                          <span className="tag tag-inactive">Left</span>
                        ) : (
                          <span className="tag tag-success">Active</span>
                        )}
                      </td>
                      <td>{bowler.phone}</td>
                      {league?.sanctionedLeague && <td>{bowler.usbcCardPaid ? 'Yes' : 'No'}</td>}
                      <td>{bowler.lineageDiscount ? 'Yes' : 'No'}</td>
                      <td>{bowler.prizeFundDiscount ? 'Yes' : 'No'}</td>
                      <td>{bowler.dropNoticeWeek}</td>
                      {league?.depositFeeActive && <td>{bowler.depositPaid.toFixed(2)}</td>}
                      {league?.depositFeeActive && <td>{bowler.depositOptOut ? 'Yes' : 'No'}</td>}
                      <td>
                        <button
                          type="button"
                          className="btn btn-link"
                          onClick={() => setBowlerForm(toBowlerFormState(bowler))}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-link"
                          disabled={hasEntries(bowler.id)}
                          title={
                            hasEntries(bowler.id)
                              ? 'This bowler has weekly dues history — mark them Left instead of removing'
                              : 'Remove this bowler'
                          }
                          onClick={() => setPendingDeleteBowlerId(bowler.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h2>{isBowlerFormEditing ? `Edit ${bowlerForm.name}` : 'Add bowler'}</h2>
            <form
              onSubmit={(event) => {
                handleBowlerSubmit(event);
              }}
            >
              {bowlerFormError && (
                <div role="alert" className="form-error">
                  {bowlerFormError}
                </div>
              )}
              <div className="secretary-field-grid">
                <label className="field-label" htmlFor="bowler-name">
                  Name
                  <input
                    id="bowler-name"
                    className="text-input"
                    value={bowlerForm.name}
                    onChange={(event) =>
                      setBowlerForm({ ...bowlerForm, name: event.target.value })
                    }
                    required
                  />
                </label>
                <label className="field-label" htmlFor="bowler-phone">
                  Phone
                  <input
                    id="bowler-phone"
                    type="tel"
                    className="text-input"
                    value={bowlerForm.phone}
                    onChange={(event) =>
                      setBowlerForm({ ...bowlerForm, phone: event.target.value })
                    }
                  />
                </label>
                {isBowlerFormEditing && (
                  <label className="field-label" htmlFor="bowler-drop-notice-week">
                    Drop notice week
                    <input
                      id="bowler-drop-notice-week"
                      className="text-input"
                      value={bowlerForm.dropNoticeWeek}
                      onChange={(event) =>
                        setBowlerForm({ ...bowlerForm, dropNoticeWeek: event.target.value })
                      }
                    />
                  </label>
                )}
                {league?.depositFeeActive && (
                  <label className="field-label" htmlFor="bowler-deposit-paid">
                    Deposit paid
                    <input
                      id="bowler-deposit-paid"
                      type="number"
                      step="0.01"
                      min={0}
                      className="text-input"
                      value={bowlerForm.depositPaid}
                      onChange={(event) =>
                        setBowlerForm({ ...bowlerForm, depositPaid: Number(event.target.value) })
                      }
                    />
                  </label>
                )}
                <label className="field-label secretary-field-grow" htmlFor="bowler-notes">
                  Notes
                  <input
                    id="bowler-notes"
                    className="text-input"
                    value={bowlerForm.notes}
                    onChange={(event) =>
                      setBowlerForm({ ...bowlerForm, notes: event.target.value })
                    }
                  />
                </label>
              </div>

              <div className="secretary-checkbox-group">
                {isBowlerFormEditing && (
                  <label className="checkbox-row" htmlFor="bowler-left">
                    <input
                      id="bowler-left"
                      type="checkbox"
                      checked={bowlerForm.status === 'left'}
                      onChange={(event) =>
                        setBowlerForm({
                          ...bowlerForm,
                          status: event.target.checked ? 'left' : 'active',
                        })
                      }
                    />
                    Left the league
                  </label>
                )}
                {league?.sanctionedLeague && (
                  <label className="checkbox-row" htmlFor="bowler-usbc">
                    <input
                      id="bowler-usbc"
                      type="checkbox"
                      checked={bowlerForm.usbcCardPaid}
                      onChange={(event) =>
                        setBowlerForm({ ...bowlerForm, usbcCardPaid: event.target.checked })
                      }
                    />
                    USBC card paid
                  </label>
                )}
                <label className="checkbox-row" htmlFor="bowler-lineage-discount">
                  <input
                    id="bowler-lineage-discount"
                    type="checkbox"
                    checked={bowlerForm.lineageDiscount}
                    onChange={(event) =>
                      setBowlerForm({ ...bowlerForm, lineageDiscount: event.target.checked })
                    }
                  />
                  Lineage discount
                </label>
                <label className="checkbox-row" htmlFor="bowler-prize-fund-discount">
                  <input
                    id="bowler-prize-fund-discount"
                    type="checkbox"
                    checked={bowlerForm.prizeFundDiscount}
                    onChange={(event) =>
                      setBowlerForm({ ...bowlerForm, prizeFundDiscount: event.target.checked })
                    }
                  />
                  Prize fund discount
                </label>
                {league?.depositFeeActive && (
                  <label className="checkbox-row" htmlFor="bowler-deposit-opt-out">
                    <input
                      id="bowler-deposit-opt-out"
                      type="checkbox"
                      checked={bowlerForm.depositOptOut}
                      onChange={(event) =>
                        setBowlerForm({ ...bowlerForm, depositOptOut: event.target.checked })
                      }
                    />
                    Opted out of deposit
                  </label>
                )}
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={isSavingBowler}>
                  {isBowlerFormEditing ? 'Save changes' : 'Add bowler'}
                </button>
                {isBowlerFormEditing && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setBowlerForm(EMPTY_BOWLER_FORM)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>

      {pendingDeleteTeamId !== null && (
        <ConfirmDialog
          title="Delete this team?"
          message="This permanently deletes the team. It has no bowlers on it, so there's no dues history to lose."
          confirmLabel="Delete"
          onConfirm={() => {
            removeTeam.mutateAsync(pendingDeleteTeamId).then(() => setPendingDeleteTeamId(null));
          }}
          onCancel={() => setPendingDeleteTeamId(null)}
        />
      )}

      {confirmRemoveEmpty && (
        <ConfirmDialog
          title="Remove empty teams?"
          message={`This permanently removes all ${emptyTeamCount} team(s) with no bowlers on them.`}
          confirmLabel="Remove"
          onConfirm={() => {
            removeEmptyTeams.mutateAsync().then(() => setConfirmRemoveEmpty(false));
          }}
          onCancel={() => setConfirmRemoveEmpty(false)}
        />
      )}

      {pendingDeleteBowler && (
        <ConfirmDialog
          title="Remove this bowler?"
          message={`This permanently removes "${pendingDeleteBowler.name}" from the roster.`}
          confirmLabel="Remove"
          onConfirm={() => {
            removeBowler.mutateAsync(pendingDeleteBowler.id).then(() => {
              setPendingDeleteBowlerId(null);
              if (bowlerForm.id === pendingDeleteBowler.id) {
                setBowlerForm(EMPTY_BOWLER_FORM);
              }
            });
          }}
          onCancel={() => setPendingDeleteBowlerId(null)}
        />
      )}
    </div>
  );
}
