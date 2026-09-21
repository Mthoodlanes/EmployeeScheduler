/**
 * Secretary Apps Milestone 3 — every derived dues/balance/banking number,
 * ported line-for-line from the existing Electron app's calculation logic
 * (Desktop\Jesse\BowlingDuesTracker-ElectronApp\BowlingDuesTracker.tsx) into
 * pure, side-effect-free functions, mirroring how `hoursResolution.ts`/
 * `overlapDetection.ts` isolate this app's own subtle business logic for
 * direct unit testing. The arithmetic here is DELIBERATELY unchanged from
 * the source app (including its use of plain floating-point `number` rather
 * than an exact-decimal library) — the acceptance bar for this port is
 * identical output to the existing app for the same input data, not an
 * "improved" calculation.
 *
 * A `WeeklyEntry` only ever stores `amountPaid` — how much was DUE for that
 * bowler that week is never stored, since it depends on that bowler's
 * discount flags and the league's current fee setup, both of which can
 * change after the fact. `buildFlatEntries` is the one place that combines
 * a raw `WeeklyEntry` with its bowler's/league's CURRENT settings to
 * produce a due amount — every other function here operates on its output
 * (`EntryFlat[]`), never on raw `WeeklyEntry[]` directly.
 */
import type { Bowler, DuesTeam, League, WeeklyEntry } from '../types/domain';

export interface EntryFlat {
  week: number;
  bowlerId: number;
  teamId: number;
  due: number;
  paid: number;
}

export type BowlerLedger = Record<number, { dueTotal: number; paidTotal: number }>;

/** Per-bowler, per-week running balance through that week (for Weekly Entries' live display). */
export type RunningBalanceByWeek = Record<number, Record<number, number>>;

export interface WeekStats {
  activeBowlers: number;
  requirement: number;
  vacantFeeTotal: number;
  coveredThisWeek: number;
  prepaymentCredit: number;
  arrearsPaydown: number;
  totalCash: number;
  lineagePassThrough: number;
  leagueKeeps: number;
}

export interface BowlerSummaryRow {
  bowlerId: number;
  teamName: string;
  name: string;
  status: Bowler['status'];
  dueTotal: number;
  paidTotal: number;
  balance: number;
  depositDue: number;
  depositPaid: number;
  depositBalance: number;
  lastTwoWeeksBalance: number;
  usbcCardPaid: boolean;
}

export interface TeamSummaryRow {
  teamId: number;
  name: string;
  folded: boolean;
  due: number;
  paid: number;
  balance: number;
  sponsorDue: number;
  sponsorPaid: number;
  sponsorBalance: number;
  lastTwoWeeksBalance: number;
}

export interface LeagueTotals {
  due: number;
  paid: number;
  sponsorDue: number;
  sponsorPaid: number;
  lastTwoWeeksBalance: number;
}

export interface BowlerStatementRow {
  week: number;
  due: number;
  paid: number;
  balance: number;
}

/** A league's flat per-bowler weekly due before any individual discount — prize fund + lineage + (sweeper, if active). */
export function computeStandardWeeklyDue(
  league: Pick<League, 'prizeFund' | 'lineage' | 'sweeperActive' | 'sweeperAmount'>,
): number {
  return league.prizeFund + league.lineage + (league.sweeperActive ? league.sweeperAmount : 0);
}

/** Never negative — a bowler's discounts can reduce their due to $0, not below it. */
export function computeWeeklyDueForBowler(
  standardWeeklyDue: number,
  league: Pick<League, 'lineageDiscountAmount' | 'prizeFundDiscountAmount'>,
  bowler: Pick<Bowler, 'lineageDiscount' | 'prizeFundDiscount'>,
): number {
  let due = standardWeeklyDue;
  if (bowler.lineageDiscount) due -= league.lineageDiscountAmount;
  if (bowler.prizeFundDiscount) due -= league.prizeFundDiscountAmount;
  return Math.max(due, 0);
}

/**
 * Combines raw `WeeklyEntry` rows with each bowler's CURRENT due (see file
 * header) into the flat, chronologically-ordered shape every other function
 * in this module consumes. An entry whose bowler no longer exists is
 * silently dropped (matches the source app: a deleted bowler's historical
 * entries stop contributing to anything, rather than erroring).
 */
export function buildFlatEntries(
  league: League,
  bowlers: Bowler[],
  entries: WeeklyEntry[],
): EntryFlat[] {
  const standardWeeklyDue = computeStandardWeeklyDue(league);
  const bowlerById = new Map(bowlers.map((bowler) => [bowler.id, bowler]));
  const flat: EntryFlat[] = [];
  for (const entry of entries) {
    const bowler = bowlerById.get(entry.bowlerId);
    if (bowler) {
      flat.push({
        week: entry.week,
        bowlerId: entry.bowlerId,
        teamId: bowler.teamId,
        due: computeWeeklyDueForBowler(standardWeeklyDue, league, bowler),
        paid: entry.amountPaid,
      });
    }
  }
  return flat.sort((a, b) => a.week - b.week);
}

function groupByBowler(flatEntries: EntryFlat[]): Map<number, EntryFlat[]> {
  const byBowler = new Map<number, EntryFlat[]>();
  for (const entry of flatEntries) {
    const list = byBowler.get(entry.bowlerId);
    if (list) {
      list.push(entry);
    } else {
      byBowler.set(entry.bowlerId, [entry]);
    }
  }
  return byBowler;
}

/** Running due/paid totals per bowler, through (and including) `currentWeek` — anything logged for a later week doesn't count yet. */
export function buildBowlerLedger(flatEntries: EntryFlat[], currentWeek: number): BowlerLedger {
  const ledger: BowlerLedger = {};
  for (const entry of flatEntries) {
    if (entry.week <= currentWeek) {
      const totals = ledger[entry.bowlerId] ?? { dueTotal: 0, paidTotal: 0 };
      totals.dueTotal += entry.due;
      totals.paidTotal += entry.paid;
      ledger[entry.bowlerId] = totals;
    }
  }
  return ledger;
}

/** One pass per bowler, not O(n^2) — `flatEntries` is already week-sorted by `buildFlatEntries`. */
export function buildRunningBalanceByWeek(flatEntries: EntryFlat[]): RunningBalanceByWeek {
  const running: RunningBalanceByWeek = {};
  for (const [bowlerId, entries] of groupByBowler(flatEntries)) {
    let due = 0;
    let paid = 0;
    const perWeek: Record<number, number> = {};
    for (const entry of entries) {
      due += entry.due;
      paid += entry.paid;
      perWeek[entry.week] = due - paid;
    }
    running[bowlerId] = perWeek;
  }
  return running;
}

/**
 * What each bowler owes specifically for the season's final two weeks,
 * crediting any prepayment they'd already built up before those two weeks
 * began — an ordinary mid-season DEBT does not reduce this (it's already
 * reflected in their whole-season balance); only a CREDIT does, and only
 * once, against this specific number. `lastTwoWeeksPaidByBowler` is a
 * SECOND, independent source of that same kind of credit: a running amount
 * the secretary records directly on the bowler (see `Bowler.lastTwoWeeksPaid`)
 * rather than needing to overpay some earlier week's entry to create the
 * credit indirectly. Both sources are simply added together — a bowler with
 * no weekly entries recorded at all yet can still show a $0 balance here
 * purely from this manual credit, which is why bowler ids come from the
 * union of both inputs, not just whoever has an entry.
 */
export function buildLastTwoWeeksBalanceByBowler(
  flatEntries: EntryFlat[],
  numWeeks: number,
  lastTwoWeeksPaidByBowler: Record<number, number>,
): Record<number, number> {
  const result: Record<number, number> = {};
  const lastTwoWeekNums = new Set([numWeeks - 1, numWeeks].filter((week) => week >= 1));
  const entriesByBowler = groupByBowler(flatEntries);
  const bowlerIds = new Set([
    ...entriesByBowler.keys(),
    ...Object.keys(lastTwoWeeksPaidByBowler).map(Number),
  ]);
  for (const bowlerId of bowlerIds) {
    const entries = entriesByBowler.get(bowlerId) ?? [];
    const priorEntries = entries.filter((entry) => entry.week <= numWeeks - 2);
    const priorDue = priorEntries.reduce((sum, entry) => sum + entry.due, 0);
    const priorPaid = priorEntries.reduce((sum, entry) => sum + entry.paid, 0);
    const priorBalance = priorDue - priorPaid;
    const automaticCredit = priorBalance < 0 ? -priorBalance : 0;
    const manualCredit = lastTwoWeeksPaidByBowler[bowlerId] ?? 0;

    const relevant = entries.filter((entry) => lastTwoWeekNums.has(entry.week));
    const due = relevant.reduce((sum, entry) => sum + entry.due, 0);
    const paid = relevant.reduce((sum, entry) => sum + entry.paid, 0);
    result[bowlerId] = Math.max(0, due - paid - automaticCredit - manualCredit);
  }
  return result;
}

/**
 * The Weekly Banking report's full cash breakdown for one week: how much of
 * what was collected covered THIS week's dues outright, how much was
 * prepayment credit (paid beyond what's owed through this week), and how
 * much paid down an existing arrears balance from before this week —
 * applied in that priority order (arrears first, then this week, then
 * anything left over becomes prepayment credit) per bowler, then summed.
 * `teamIds` must include every team in the league, even an empty one — an
 * empty team still contributes vacancy-fee "requirement," matching the
 * source app's unconditional iteration over `teams`.
 */
export function computeWeekStats(
  week: number,
  league: Pick<League, 'spotsPerTeam' | 'vacancyFee' | 'lineage'>,
  teamIds: number[],
  flatEntries: EntryFlat[],
): WeekStats {
  const weekEntries = flatEntries.filter((entry) => entry.week === week);
  const activeBowlers = weekEntries.length;

  let vacantFeeTotal = 0;
  for (const teamId of teamIds) {
    const filled = weekEntries.filter((entry) => entry.teamId === teamId).length;
    const vacant = Math.max(0, league.spotsPerTeam - filled);
    vacantFeeTotal += vacant * league.vacancyFee;
  }

  const bowlerDue = weekEntries.reduce((sum, entry) => sum + entry.due, 0);
  const requirement = bowlerDue + vacantFeeTotal;

  let coveredThisWeek = 0;
  let prepaymentCredit = 0;
  let arrearsPaydown = 0;
  let lineagePassThrough = 0;
  for (const entry of weekEntries) {
    const priorEntries = flatEntries.filter(
      (candidate) => candidate.bowlerId === entry.bowlerId && candidate.week < week,
    );
    const priorDue = priorEntries.reduce((sum, prior) => sum + prior.due, 0);
    const priorPaid = priorEntries.reduce((sum, prior) => sum + prior.paid, 0);
    const arrears = Math.max(priorDue - priorPaid, 0);

    let remaining = entry.paid;
    const toArrears = Math.min(remaining, arrears);
    remaining -= toArrears;
    const toThisWeek = Math.min(remaining, entry.due);
    remaining -= toThisWeek;

    arrearsPaydown += toArrears;
    coveredThisWeek += toThisWeek;
    prepaymentCredit += remaining;
    lineagePassThrough += league.lineage;
  }
  const totalCash = coveredThisWeek + prepaymentCredit + arrearsPaydown;
  const leagueKeeps = totalCash - lineagePassThrough;
  return {
    activeBowlers,
    requirement,
    vacantFeeTotal,
    coveredThisWeek,
    prepaymentCredit,
    arrearsPaydown,
    totalCash,
    lineagePassThrough,
    leagueKeeps,
  };
}

/** Total vacancy fees owed by one team across every week through `currentWeek` (used on Season Summary — Weekly Banking's own vacancy figure is single-week). */
export function computeVacantDueForTeam(
  teamId: number,
  currentWeek: number,
  league: Pick<League, 'spotsPerTeam' | 'vacancyFee'>,
  flatEntries: EntryFlat[],
): number {
  let total = 0;
  for (let week = 1; week <= currentWeek; week += 1) {
    const filled = flatEntries.filter(
      (entry) => entry.teamId === teamId && entry.week === week,
    ).length;
    const vacant = Math.max(0, league.spotsPerTeam - filled);
    total += vacant * league.vacancyFee;
  }
  return total;
}

export function isLastTwoWeeksOverdue(
  lastTwoWeeksBalance: number,
  currentWeek: number,
  lastTwoWeeksDueWeek: number,
): boolean {
  return lastTwoWeeksBalance > 0 && currentWeek >= lastTwoWeeksDueWeek;
}

/** USBC card tracking only ever applies to sanctioned leagues, and only starts flagging once Current Week reaches 2. */
export function isUsbcCardOverdue(
  sanctionedLeague: boolean,
  usbcCardPaid: boolean,
  currentWeek: number,
): boolean {
  return sanctionedLeague && !usbcCardPaid && currentWeek >= 2;
}

export function isDepositOverdue(
  depositFeeActive: boolean,
  depositBalance: number,
  currentWeek: number,
  prizeFundCoverChargeDueWeek: number,
): boolean {
  return depositFeeActive && depositBalance > 0 && currentWeek >= prizeFundCoverChargeDueWeek;
}

export function isSponsorFeeOverdue(
  sponsorFeeActive: boolean,
  sponsorBalance: number,
  currentWeek: number,
  sponsorFeeDueWeek: number,
): boolean {
  return sponsorFeeActive && sponsorBalance > 0 && currentWeek >= sponsorFeeDueWeek;
}

/** One row per NAMED bowler (a blank placeholder row from an empty roster slot is skipped, matching the source app). */
export function buildBowlerSummaryRows(
  league: Pick<League, 'depositFeeActive' | 'depositFeeAmount'>,
  teams: Array<Pick<DuesTeam, 'id' | 'name'>>,
  bowlers: Bowler[],
  ledger: BowlerLedger,
  lastTwoWeeksBalanceByBowler: Record<number, number>,
): BowlerSummaryRow[] {
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const rows: BowlerSummaryRow[] = [];
  for (const bowler of bowlers) {
    if (bowler.name.trim()) {
      const totals = ledger[bowler.id] ?? { dueTotal: 0, paidTotal: 0 };
      const balance = totals.dueTotal - totals.paidTotal;
      const depositDue =
        league.depositFeeActive && !bowler.depositOptOut ? league.depositFeeAmount : 0;
      rows.push({
        bowlerId: bowler.id,
        teamName: teamNameById.get(bowler.teamId) ?? '',
        name: bowler.name,
        status: bowler.status,
        dueTotal: totals.dueTotal,
        paidTotal: totals.paidTotal,
        balance,
        depositDue,
        depositPaid: bowler.depositPaid,
        depositBalance: depositDue - bowler.depositPaid,
        lastTwoWeeksBalance: lastTwoWeeksBalanceByBowler[bowler.id] ?? 0,
        usbcCardPaid: bowler.usbcCardPaid,
      });
    }
  }
  return rows;
}

export function aggregateBowlerSummaryTotals(rows: BowlerSummaryRow[]): {
  bowlersBehind: number;
  totalBehind: number;
  totalCollected: number;
} {
  return {
    bowlersBehind: rows.filter((row) => row.balance > 0).length,
    totalBehind: rows.reduce((sum, row) => sum + Math.max(row.balance, 0), 0),
    totalCollected: rows.reduce((sum, row) => sum + row.paidTotal, 0),
  };
}

/** One row per team, including an empty or folded one — a folded team's history always stays counted (matches the source app; "folded" is informational only). */
export function buildTeamSummaryRows(
  league: Pick<
    League,
    'currentWeek' | 'spotsPerTeam' | 'vacancyFee' | 'sponsorFeeActive' | 'sponsorFeePerTeam'
  >,
  teams: DuesTeam[],
  bowlers: Bowler[],
  ledger: BowlerLedger,
  flatEntries: EntryFlat[],
  lastTwoWeeksBalanceByBowler: Record<number, number>,
): TeamSummaryRow[] {
  return teams.map((team) => {
    const teamBowlers = bowlers.filter((bowler) => bowler.teamId === team.id);
    let due = 0;
    let paid = 0;
    for (const bowler of teamBowlers) {
      const totals = ledger[bowler.id];
      if (totals) {
        due += totals.dueTotal;
        paid += totals.paidTotal;
      }
    }
    due += computeVacantDueForTeam(team.id, league.currentWeek, league, flatEntries);
    const sponsorDue = league.sponsorFeeActive ? league.sponsorFeePerTeam : 0;
    const lastTwoWeeksBalance = teamBowlers.reduce(
      (sum, bowler) => sum + (lastTwoWeeksBalanceByBowler[bowler.id] ?? 0),
      0,
    );
    return {
      teamId: team.id,
      name: team.name,
      folded: team.folded,
      due,
      paid,
      balance: due - paid,
      sponsorDue,
      sponsorPaid: team.sponsorPaid,
      sponsorBalance: sponsorDue - team.sponsorPaid,
      lastTwoWeeksBalance,
    };
  });
}

export function aggregateLeagueTotals(teamRows: TeamSummaryRow[]): LeagueTotals {
  return teamRows.reduce(
    (totals, row) => ({
      due: totals.due + row.due,
      paid: totals.paid + row.paid,
      sponsorDue: totals.sponsorDue + row.sponsorDue,
      sponsorPaid: totals.sponsorPaid + row.sponsorPaid,
      lastTwoWeeksBalance: totals.lastTwoWeeksBalance + row.lastTwoWeeksBalance,
    }),
    { due: 0, paid: 0, sponsorDue: 0, sponsorPaid: 0, lastTwoWeeksBalance: 0 },
  );
}

/** One bowler's full week-by-week Due/Paid/Running-Balance history through `currentWeek` — the Bowler Summary click-to-expand statement. */
export function buildBowlerStatement(
  bowlerId: number,
  currentWeek: number,
  flatEntries: EntryFlat[],
): BowlerStatementRow[] {
  const weeks = flatEntries
    .filter((entry) => entry.bowlerId === bowlerId && entry.week <= currentWeek)
    .sort((a, b) => a.week - b.week);
  let runDue = 0;
  let runPaid = 0;
  return weeks.map((entry) => {
    runDue += entry.due;
    runPaid += entry.paid;
    return { week: entry.week, due: entry.due, paid: entry.paid, balance: runDue - runPaid };
  });
}
