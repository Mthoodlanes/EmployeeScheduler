import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { League } from '@shared/types/domain';
import { LoadingState } from '../components/EmptyState';
import { SecretaryLeagueTabs } from '../components/SecretaryLeagueTabs';
import { useSecretaryLeague, useUpdateSecretaryLeague } from '../hooks/useSecretaryLeagues';

interface SetupFormState {
  name: string;
  spotsPerTeam: number;
  numWeeks: number;
  currentWeek: number;
  prizeFund: number;
  lineage: number;
  sweeperActive: boolean;
  sweeperAmount: number;
  vacancyFee: number;
  lineageDiscountAmount: number;
  prizeFundDiscountAmount: number;
  sponsorFeeActive: boolean;
  sponsorFeePerTeam: number;
  sponsorFeeDueWeek: number;
  depositFeeActive: boolean;
  depositFeeAmount: number;
  prizeFundCoverChargeDueWeek: number;
  lastTwoWeeksDueWeek: number;
  sanctionedLeague: boolean;
}

function toFormState(league: League): SetupFormState {
  return {
    name: league.name,
    spotsPerTeam: league.spotsPerTeam,
    numWeeks: league.numWeeks,
    currentWeek: league.currentWeek,
    prizeFund: league.prizeFund,
    lineage: league.lineage,
    sweeperActive: league.sweeperActive,
    sweeperAmount: league.sweeperAmount,
    vacancyFee: league.vacancyFee,
    lineageDiscountAmount: league.lineageDiscountAmount,
    prizeFundDiscountAmount: league.prizeFundDiscountAmount,
    sponsorFeeActive: league.sponsorFeeActive,
    sponsorFeePerTeam: league.sponsorFeePerTeam,
    sponsorFeeDueWeek: league.sponsorFeeDueWeek,
    depositFeeActive: league.depositFeeActive,
    depositFeeAmount: league.depositFeeAmount,
    prizeFundCoverChargeDueWeek: league.prizeFundCoverChargeDueWeek,
    lastTwoWeeksDueWeek: league.lastTwoWeeksDueWeek,
    sanctionedLeague: league.sanctionedLeague,
  };
}

/**
 * Milestone 5: the original app's per-league "Setup" tab — every field that
 * drives the dues math in `duesLedger.ts` (standard weekly due, discounts,
 * vacancy fee, sponsor/deposit fees and their due weeks, last-two-weeks due
 * week). Roster/Weekly Entries/Weekly Banking/Summary tabs (Milestones 6-9)
 * will hang off this same league via nav links added to `SecretaryLayout`
 * once they exist.
 */
export function SecretaryLeagueSetupPage(): React.JSX.Element {
  const { leagueId } = useParams<{ leagueId: string }>();
  const id = Number(leagueId);

  const { data: league, isLoading, error } = useSecretaryLeague(id);
  const updateLeague = useUpdateSecretaryLeague();

  const [form, setForm] = useState<SetupFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (league) {
      setForm(toFormState(league));
    }
  }, [league]);

  if (!leagueId || Number.isNaN(id)) {
    return <Navigate to="/secretary" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!form) return;
    setFormError(null);
    try {
      await updateLeague.mutateAsync({ id, ...form });
      setSavedAt(Date.now());
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save league setup');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>{league ? league.name : 'League Setup'}</h1>
        <Link to="/secretary" className="btn btn-link">
          ← All Leagues
        </Link>
      </div>

      <SecretaryLeagueTabs leagueId={id} />

      {isLoading && <LoadingState label="Loading league…" />}
      {error && (
        <div role="alert" className="form-error">
          {error instanceof Error ? error.message : 'Failed to load league'}
        </div>
      )}

      {form && (
        <form
          className="form-grid"
          onSubmit={(event) => {
            handleSubmit(event);
          }}
        >
          {formError && (
            <div role="alert" className="form-error">
              {formError}
            </div>
          )}
          {savedAt !== null && !updateLeague.isPending && (
            <div role="status" className="form-success">
              Saved.
            </div>
          )}

          <div className="card section">
            <h2>Basics</h2>
            <div className="secretary-form-rows">
              <label className="secretary-form-row" htmlFor="league-name">
                <span className="secretary-form-row-label">League name</span>
                <input
                  id="league-name"
                  className="text-input"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </label>
              <label className="secretary-form-row" htmlFor="league-spots-per-team">
                <span className="secretary-form-row-label">Spots per team</span>
                <input
                  id="league-spots-per-team"
                  type="number"
                  min={1}
                  className="text-input"
                  value={form.spotsPerTeam}
                  onChange={(event) =>
                    setForm({ ...form, spotsPerTeam: Number(event.target.value) })
                  }
                  required
                />
              </label>
              <label className="secretary-form-row" htmlFor="league-num-weeks">
                <span className="secretary-form-row-label">Number of weeks</span>
                <input
                  id="league-num-weeks"
                  type="number"
                  min={1}
                  className="text-input"
                  value={form.numWeeks}
                  onChange={(event) => setForm({ ...form, numWeeks: Number(event.target.value) })}
                  required
                />
              </label>
              <label className="secretary-form-row" htmlFor="league-current-week">
                <span className="secretary-form-row-label">Current week</span>
                <input
                  id="league-current-week"
                  type="number"
                  min={1}
                  max={form.numWeeks}
                  className="text-input"
                  value={form.currentWeek}
                  onChange={(event) =>
                    setForm({ ...form, currentWeek: Number(event.target.value) })
                  }
                  required
                />
              </label>
              <label className="checkbox-row" htmlFor="league-sanctioned">
                <input
                  id="league-sanctioned"
                  type="checkbox"
                  checked={form.sanctionedLeague}
                  onChange={(event) =>
                    setForm({ ...form, sanctionedLeague: event.target.checked })
                  }
                />
                USBC sanctioned league (tracks the USBC card fee on the roster)
              </label>
            </div>
          </div>

          <div className="card section">
            <h2>Weekly dues</h2>
            <div className="secretary-form-rows">
              <label className="secretary-form-row" htmlFor="league-prize-fund">
                <span className="secretary-form-row-label">Prize fund</span>
                <input
                  id="league-prize-fund"
                  type="number"
                  step="0.01"
                  min={0}
                  className="text-input"
                  value={form.prizeFund}
                  onChange={(event) => setForm({ ...form, prizeFund: Number(event.target.value) })}
                />
              </label>
              <label className="secretary-form-row" htmlFor="league-lineage">
                <span className="secretary-form-row-label">Lineage</span>
                <input
                  id="league-lineage"
                  type="number"
                  step="0.01"
                  min={0}
                  className="text-input"
                  value={form.lineage}
                  onChange={(event) => setForm({ ...form, lineage: Number(event.target.value) })}
                />
              </label>
              <label className="checkbox-row" htmlFor="league-sweeper-active">
                <input
                  id="league-sweeper-active"
                  type="checkbox"
                  checked={form.sweeperActive}
                  onChange={(event) => setForm({ ...form, sweeperActive: event.target.checked })}
                />
                Sweeper fee active
              </label>
              {form.sweeperActive && (
                <label className="secretary-form-row" htmlFor="league-sweeper-amount">
                  <span className="secretary-form-row-label">Sweeper amount</span>
                  <input
                    id="league-sweeper-amount"
                    type="number"
                    step="0.01"
                    min={0}
                    className="text-input"
                    value={form.sweeperAmount}
                    onChange={(event) =>
                      setForm({ ...form, sweeperAmount: Number(event.target.value) })
                    }
                  />
                </label>
              )}
              <label className="secretary-form-row" htmlFor="league-vacancy-fee">
                <span className="secretary-form-row-label">
                  Vacancy fee (per empty spot, per week)
                </span>
                <input
                  id="league-vacancy-fee"
                  type="number"
                  step="0.01"
                  min={0}
                  className="text-input"
                  value={form.vacancyFee}
                  onChange={(event) =>
                    setForm({ ...form, vacancyFee: Number(event.target.value) })
                  }
                />
              </label>
              <label className="secretary-form-row" htmlFor="league-lineage-discount">
                <span className="secretary-form-row-label">Lineage discount amount</span>
                <input
                  id="league-lineage-discount"
                  type="number"
                  step="0.01"
                  min={0}
                  className="text-input"
                  value={form.lineageDiscountAmount}
                  onChange={(event) =>
                    setForm({ ...form, lineageDiscountAmount: Number(event.target.value) })
                  }
                />
              </label>
              <label className="secretary-form-row" htmlFor="league-prize-fund-discount">
                <span className="secretary-form-row-label">Prize fund discount amount</span>
                <input
                  id="league-prize-fund-discount"
                  type="number"
                  step="0.01"
                  min={0}
                  className="text-input"
                  value={form.prizeFundDiscountAmount}
                  onChange={(event) =>
                    setForm({ ...form, prizeFundDiscountAmount: Number(event.target.value) })
                  }
                />
              </label>
            </div>
          </div>

          <div className="card section">
            <h2>Fees &amp; due weeks</h2>
            <div className="secretary-form-rows">
              <label className="checkbox-row" htmlFor="league-sponsor-fee-active">
                <input
                  id="league-sponsor-fee-active"
                  type="checkbox"
                  checked={form.sponsorFeeActive}
                  onChange={(event) =>
                    setForm({ ...form, sponsorFeeActive: event.target.checked })
                  }
                />
                Sponsor fee active
              </label>
              {form.sponsorFeeActive && (
                <>
                  <label className="secretary-form-row" htmlFor="league-sponsor-fee-per-team">
                    <span className="secretary-form-row-label">Sponsor fee per team</span>
                    <input
                      id="league-sponsor-fee-per-team"
                      type="number"
                      step="0.01"
                      min={0}
                      className="text-input"
                      value={form.sponsorFeePerTeam}
                      onChange={(event) =>
                        setForm({ ...form, sponsorFeePerTeam: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label className="secretary-form-row" htmlFor="league-sponsor-fee-due-week">
                    <span className="secretary-form-row-label">Sponsor fee due by week</span>
                    <input
                      id="league-sponsor-fee-due-week"
                      type="number"
                      min={0}
                      className="text-input"
                      value={form.sponsorFeeDueWeek}
                      onChange={(event) =>
                        setForm({ ...form, sponsorFeeDueWeek: Number(event.target.value) })
                      }
                    />
                  </label>
                </>
              )}
              <label className="checkbox-row" htmlFor="league-deposit-fee-active">
                <input
                  id="league-deposit-fee-active"
                  type="checkbox"
                  checked={form.depositFeeActive}
                  onChange={(event) =>
                    setForm({ ...form, depositFeeActive: event.target.checked })
                  }
                />
                Deposit / prize fund cover charge active
              </label>
              {form.depositFeeActive && (
                <>
                  <label className="secretary-form-row" htmlFor="league-deposit-fee-amount">
                    <span className="secretary-form-row-label">Deposit amount</span>
                    <input
                      id="league-deposit-fee-amount"
                      type="number"
                      step="0.01"
                      min={0}
                      className="text-input"
                      value={form.depositFeeAmount}
                      onChange={(event) =>
                        setForm({ ...form, depositFeeAmount: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label
                    className="secretary-form-row"
                    htmlFor="league-prize-fund-cover-charge-due-week"
                  >
                    <span className="secretary-form-row-label">Deposit due by week</span>
                    <input
                      id="league-prize-fund-cover-charge-due-week"
                      type="number"
                      min={0}
                      className="text-input"
                      value={form.prizeFundCoverChargeDueWeek}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          prizeFundCoverChargeDueWeek: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </>
              )}
              <label className="secretary-form-row" htmlFor="league-last-two-weeks-due-week">
                <span className="secretary-form-row-label">
                  &quot;Last two weeks&quot; dues due by week
                </span>
                <input
                  id="league-last-two-weeks-due-week"
                  type="number"
                  min={0}
                  className="text-input"
                  value={form.lastTwoWeeksDueWeek}
                  onChange={(event) =>
                    setForm({ ...form, lastTwoWeeksDueWeek: Number(event.target.value) })
                  }
                />
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={updateLeague.isPending}>
              Save changes
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
