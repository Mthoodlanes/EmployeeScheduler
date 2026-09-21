import { describe, expect, it } from 'vitest';
import {
  aggregateBowlerSummaryTotals,
  aggregateLeagueTotals,
  buildBowlerLedger,
  buildBowlerStatement,
  buildBowlerSummaryRows,
  buildFlatEntries,
  buildLastTwoWeeksBalanceByBowler,
  buildRunningBalanceByWeek,
  buildTeamSummaryRows,
  computeStandardWeeklyDue,
  computeVacantDueForTeam,
  computeWeekStats,
  computeWeeklyDueForBowler,
  isDepositOverdue,
  isLastTwoWeeksOverdue,
  isSponsorFeeOverdue,
  isUsbcCardOverdue,
} from '../../../src/shared/logic/duesLedger';
import type { Bowler, DuesTeam, League, WeeklyEntry } from '../../../src/shared/types/domain';

function makeLeague(overrides: Partial<League> = {}): League {
  return {
    id: 1,
    name: 'Test League',
    spotsPerTeam: 2,
    numWeeks: 4,
    currentWeek: 4,
    prizeFund: 10,
    lineage: 5,
    sweeperActive: false,
    sweeperAmount: 0,
    vacancyFee: 3,
    lineageDiscountAmount: 2,
    prizeFundDiscountAmount: 1,
    sponsorFeePerTeam: 0,
    sponsorFeeActive: false,
    depositFeeActive: false,
    depositFeeAmount: 0,
    sponsorFeeDueWeek: 0,
    prizeFundCoverChargeDueWeek: 0,
    lastTwoWeeksDueWeek: 3,
    sanctionedLeague: false,
    createdByEmployeeId: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeBowler(overrides: Partial<Bowler> = {}): Bowler {
  return {
    id: 1,
    teamId: 1,
    name: 'Alex Bowler',
    status: 'active',
    phone: '',
    lineageDiscount: false,
    prizeFundDiscount: false,
    dropNoticeWeek: '',
    notes: '',
    depositPaid: 0,
    depositOptOut: false,
    usbcCardPaid: false,
    ...overrides,
  };
}

function makeTeam(overrides: Partial<DuesTeam> = {}): DuesTeam {
  return { id: 1, leagueId: 1, name: 'Team One', folded: false, sponsorPaid: 0, ...overrides };
}

function makeEntry(overrides: Partial<WeeklyEntry> = {}): WeeklyEntry {
  return { id: 1, bowlerId: 1, week: 1, amountPaid: 0, ...overrides };
}

describe('computeStandardWeeklyDue', () => {
  it('sums prize fund + lineage when the sweeper is off', () => {
    expect(computeStandardWeeklyDue(makeLeague({ prizeFund: 10, lineage: 5 }))).toBe(15);
  });

  it('adds the sweeper amount only when it is active', () => {
    expect(
      computeStandardWeeklyDue(
        makeLeague({ prizeFund: 10, lineage: 5, sweeperActive: true, sweeperAmount: 4 }),
      ),
    ).toBe(19);
    expect(
      computeStandardWeeklyDue(
        makeLeague({ prizeFund: 10, lineage: 5, sweeperActive: false, sweeperAmount: 4 }),
      ),
    ).toBe(15);
  });
});

describe('computeWeeklyDueForBowler', () => {
  const league = makeLeague({ lineageDiscountAmount: 2, prizeFundDiscountAmount: 1 });

  it('applies no discount by default', () => {
    expect(computeWeeklyDueForBowler(15, league, makeBowler())).toBe(15);
  });

  it('applies the lineage discount alone', () => {
    expect(computeWeeklyDueForBowler(15, league, makeBowler({ lineageDiscount: true }))).toBe(13);
  });

  it('stacks both discounts', () => {
    expect(
      computeWeeklyDueForBowler(
        15,
        league,
        makeBowler({ lineageDiscount: true, prizeFundDiscount: true }),
      ),
    ).toBe(12);
  });

  it('never goes below zero even if discounts exceed the standard due', () => {
    expect(
      computeWeeklyDueForBowler(
        1,
        makeLeague({ lineageDiscountAmount: 5 }),
        makeBowler({ lineageDiscount: true }),
      ),
    ).toBe(0);
  });
});

describe('buildFlatEntries', () => {
  it('resolves each entry to its bowler team and current due, sorted by week', () => {
    const league = makeLeague();
    const bowlers = [
      makeBowler({ id: 1, teamId: 1 }),
      makeBowler({ id: 2, teamId: 1, lineageDiscount: true }),
    ];
    const entries = [
      makeEntry({ id: 1, bowlerId: 2, week: 2, amountPaid: 13 }),
      makeEntry({ id: 2, bowlerId: 1, week: 1, amountPaid: 15 }),
    ];

    const flat = buildFlatEntries(league, bowlers, entries);

    expect(flat).toEqual([
      { week: 1, bowlerId: 1, teamId: 1, due: 15, paid: 15 },
      { week: 2, bowlerId: 2, teamId: 1, due: 13, paid: 13 },
    ]);
  });

  it('silently drops an entry whose bowler no longer exists', () => {
    const league = makeLeague();
    const flat = buildFlatEntries(
      league,
      [makeBowler({ id: 1 })],
      [
        makeEntry({ bowlerId: 1, week: 1, amountPaid: 15 }),
        makeEntry({ bowlerId: 999, week: 1, amountPaid: 15 }),
      ],
    );
    expect(flat).toHaveLength(1);
    expect(flat[0].bowlerId).toBe(1);
  });
});

describe('buildBowlerLedger', () => {
  it('totals due/paid through currentWeek, excluding later weeks', () => {
    const league = makeLeague();
    const bowlers = [makeBowler({ id: 1 })];
    const entries = [
      makeEntry({ id: 1, bowlerId: 1, week: 1, amountPaid: 15 }),
      makeEntry({ id: 2, bowlerId: 1, week: 2, amountPaid: 10 }),
      makeEntry({ id: 3, bowlerId: 1, week: 3, amountPaid: 999 }), // beyond currentWeek
    ];
    const flat = buildFlatEntries(league, bowlers, entries);

    const ledger = buildBowlerLedger(flat, 2);

    expect(ledger[1]).toEqual({ dueTotal: 30, paidTotal: 25 });
  });
});

describe('buildRunningBalanceByWeek', () => {
  it('accumulates a running balance per bowler across weeks', () => {
    const league = makeLeague();
    const bowlers = [makeBowler({ id: 1 })];
    const entries = [
      makeEntry({ id: 1, bowlerId: 1, week: 1, amountPaid: 10 }), // due 15, paid 10 -> -5
      makeEntry({ id: 2, bowlerId: 1, week: 2, amountPaid: 20 }), // due 15, paid 20 -> running +5
    ];
    const flat = buildFlatEntries(league, bowlers, entries);

    const running = buildRunningBalanceByWeek(flat);

    expect(running[1]).toEqual({ 1: 5, 2: 0 });
  });
});

describe('buildLastTwoWeeksBalanceByBowler', () => {
  it('is credit-aware: an earlier prepayment offsets what is owed for the final two weeks', () => {
    const league = makeLeague({ numWeeks: 4 });
    const bowlers = [makeBowler({ id: 1 })];
    // Week 1: due 15, paid 30 -> a 15 credit banked before the final two weeks.
    // Weeks 3-4 (the final two, since numWeeks=4): due 15 each = 30, nothing paid.
    const entries = [
      makeEntry({ id: 1, bowlerId: 1, week: 1, amountPaid: 30 }),
      makeEntry({ id: 2, bowlerId: 1, week: 3, amountPaid: 0 }),
      makeEntry({ id: 3, bowlerId: 1, week: 4, amountPaid: 0 }),
    ];
    const flat = buildFlatEntries(league, bowlers, entries);

    const result = buildLastTwoWeeksBalanceByBowler(flat, 4);

    // Owed 30, credit 15 -> 15 still owed.
    expect(result[1]).toBe(15);
  });

  it('does NOT let an ordinary mid-season debt reduce the final-two-weeks number', () => {
    const league = makeLeague({ numWeeks: 4 });
    const bowlers = [makeBowler({ id: 1 })];
    // Week 1: due 15, paid 0 -> a 15 DEBT (not a credit) before the final two weeks.
    // Weeks 3-4: due 15 each, paid in full.
    const entries = [
      makeEntry({ id: 1, bowlerId: 1, week: 1, amountPaid: 0 }),
      makeEntry({ id: 2, bowlerId: 1, week: 3, amountPaid: 15 }),
      makeEntry({ id: 3, bowlerId: 1, week: 4, amountPaid: 15 }),
    ];
    const flat = buildFlatEntries(league, bowlers, entries);

    const result = buildLastTwoWeeksBalanceByBowler(flat, 4);

    // Fully paid for weeks 3-4 -> 0 owed for the final two weeks specifically,
    // even though the bowler is behind overall from week 1.
    expect(result[1]).toBe(0);
  });

  it('never goes negative — a bigger credit than owed just fully covers it', () => {
    const league = makeLeague({ numWeeks: 4 });
    const bowlers = [makeBowler({ id: 1 })];
    const entries = [
      makeEntry({ id: 1, bowlerId: 1, week: 1, amountPaid: 100 }),
      makeEntry({ id: 2, bowlerId: 1, week: 3, amountPaid: 0 }),
      makeEntry({ id: 3, bowlerId: 1, week: 4, amountPaid: 0 }),
    ];
    const flat = buildFlatEntries(league, bowlers, entries);

    expect(buildLastTwoWeeksBalanceByBowler(flat, 4)[1]).toBe(0);
  });
});

describe('computeWeekStats', () => {
  it('counts an empty team toward the vacancy-fee requirement', () => {
    const league = makeLeague({ spotsPerTeam: 2, vacancyFee: 3, lineage: 5 });
    const stats = computeWeekStats(1, league, [1, 2], []); // team 2 has no bowlers at all
    // Team 1: 2 vacant spots, team 2: 2 vacant spots -> 4 * 3 = 12.
    expect(stats.vacantFeeTotal).toBe(12);
    expect(stats.requirement).toBe(12);
    expect(stats.activeBowlers).toBe(0);
  });

  it('applies a payment to arrears first, then this week, then treats the remainder as prepayment credit', () => {
    const league = makeLeague({ spotsPerTeam: 1, vacancyFee: 0, lineage: 5 });
    const bowlers = [makeBowler({ id: 1, teamId: 1 })];
    // Week 1: due 15, paid 0 -> arrears of 15 going into week 2.
    // Week 2: due 15, pays 40 -> 15 to arrears, 15 to this week, 10 left as prepayment credit.
    const entries = [
      makeEntry({ id: 1, bowlerId: 1, week: 1, amountPaid: 0 }),
      makeEntry({ id: 2, bowlerId: 1, week: 2, amountPaid: 40 }),
    ];
    const flat = buildFlatEntries(league, bowlers, entries);

    const stats = computeWeekStats(2, league, [1], flat);

    expect(stats.arrearsPaydown).toBe(15);
    expect(stats.coveredThisWeek).toBe(15);
    expect(stats.prepaymentCredit).toBe(10);
    expect(stats.totalCash).toBe(40);
    expect(stats.lineagePassThrough).toBe(5);
    expect(stats.leagueKeeps).toBe(35);
  });
});

describe('computeVacantDueForTeam', () => {
  it('accumulates vacancy fees across every week through currentWeek', () => {
    const league = makeLeague({ spotsPerTeam: 2, vacancyFee: 3 });
    const bowlers = [makeBowler({ id: 1, teamId: 1 })];
    // One filled spot each week -> 1 vacant spot/week * 3 = 3/week.
    const entries = [
      makeEntry({ id: 1, bowlerId: 1, week: 1, amountPaid: 15 }),
      makeEntry({ id: 2, bowlerId: 1, week: 2, amountPaid: 15 }),
    ];
    const flat = buildFlatEntries(league, bowlers, entries);

    expect(computeVacantDueForTeam(1, 2, league, flat)).toBe(6);
  });
});

describe('overdue predicates', () => {
  it('isLastTwoWeeksOverdue requires both a positive balance and reaching the due week', () => {
    expect(isLastTwoWeeksOverdue(10, 3, 3)).toBe(true);
    expect(isLastTwoWeeksOverdue(0, 3, 3)).toBe(false);
    expect(isLastTwoWeeksOverdue(10, 2, 3)).toBe(false);
  });

  it('isUsbcCardOverdue only applies to sanctioned leagues from week 2 onward', () => {
    expect(isUsbcCardOverdue(true, false, 2)).toBe(true);
    expect(isUsbcCardOverdue(true, false, 1)).toBe(false);
    expect(isUsbcCardOverdue(false, false, 2)).toBe(false);
    expect(isUsbcCardOverdue(true, true, 2)).toBe(false);
  });

  it('isDepositOverdue requires the fee active, a balance owed, and reaching the due week', () => {
    expect(isDepositOverdue(true, 5, 3, 3)).toBe(true);
    expect(isDepositOverdue(false, 5, 3, 3)).toBe(false);
    expect(isDepositOverdue(true, 0, 3, 3)).toBe(false);
    expect(isDepositOverdue(true, 5, 2, 3)).toBe(false);
  });

  it('isSponsorFeeOverdue requires the fee active, a balance owed, and reaching the due week', () => {
    expect(isSponsorFeeOverdue(true, 5, 3, 3)).toBe(true);
    expect(isSponsorFeeOverdue(false, 5, 3, 3)).toBe(false);
    expect(isSponsorFeeOverdue(true, 0, 3, 3)).toBe(false);
  });
});

describe('buildBowlerSummaryRows', () => {
  it('skips a blank-name roster placeholder', () => {
    const league = makeLeague();
    const rows = buildBowlerSummaryRows(
      league,
      [makeTeam()],
      [makeBowler({ id: 1, name: '' }), makeBowler({ id: 2, name: 'Real Bowler' })],
      {},
      {},
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Real Bowler');
  });

  it('computes depositDue as zero when the fee is inactive or the bowler opted out', () => {
    const activeLeague = makeLeague({ depositFeeActive: true, depositFeeAmount: 20 });
    const [optedIn] = buildBowlerSummaryRows(
      activeLeague,
      [makeTeam()],
      [makeBowler({ id: 1, name: 'Bowler', depositOptOut: false, depositPaid: 5 })],
      {},
      {},
    );
    expect(optedIn.depositDue).toBe(20);
    expect(optedIn.depositBalance).toBe(15);

    const [optedOut] = buildBowlerSummaryRows(
      activeLeague,
      [makeTeam()],
      [makeBowler({ id: 1, name: 'Bowler', depositOptOut: true })],
      {},
      {},
    );
    expect(optedOut.depositDue).toBe(0);

    const [inactive] = buildBowlerSummaryRows(
      makeLeague({ depositFeeActive: false }),
      [makeTeam()],
      [makeBowler({ id: 1, name: 'Bowler' })],
      {},
      {},
    );
    expect(inactive.depositDue).toBe(0);
  });
});

describe('aggregateBowlerSummaryTotals', () => {
  it('counts only positive balances as "behind," and sums collected regardless of balance', () => {
    const league = makeLeague();
    const rows = buildBowlerSummaryRows(
      league,
      [makeTeam()],
      [makeBowler({ id: 1, name: 'Behind' }), makeBowler({ id: 2, name: 'Ahead' })],
      { 1: { dueTotal: 30, paidTotal: 10 }, 2: { dueTotal: 15, paidTotal: 30 } },
      {},
    );

    const totals = aggregateBowlerSummaryTotals(rows);

    expect(totals.bowlersBehind).toBe(1);
    expect(totals.totalBehind).toBe(20);
    expect(totals.totalCollected).toBe(40);
  });
});

describe('buildTeamSummaryRows / aggregateLeagueTotals', () => {
  it('rolls up bowler ledgers plus vacancy fees per team, including an empty team', () => {
    const league = makeLeague({ spotsPerTeam: 1, vacancyFee: 3, currentWeek: 1 });
    const teams = [makeTeam({ id: 1, name: 'Full Team' }), makeTeam({ id: 2, name: 'Empty Team' })];
    const bowlers = [makeBowler({ id: 1, teamId: 1 })];
    const entries = [makeEntry({ id: 1, bowlerId: 1, week: 1, amountPaid: 15 })];
    const flat = buildFlatEntries(league, bowlers, entries);
    const ledger = buildBowlerLedger(flat, 1);

    const rows = buildTeamSummaryRows(league, teams, bowlers, ledger, flat, {});

    // Team 1: due 15 (bowler) + 0 vacancy (spot filled) = 15, paid 15.
    expect(rows[0]).toMatchObject({ teamId: 1, due: 15, paid: 15, balance: 0 });
    // Team 2: no bowlers, but 1 vacant spot * 3 = 3 owed, 0 paid.
    expect(rows[1]).toMatchObject({ teamId: 2, due: 3, paid: 0, balance: 3 });

    const totals = aggregateLeagueTotals(rows);
    expect(totals.due).toBe(18);
    expect(totals.paid).toBe(15);
  });

  it('keeps a folded team counted in league totals', () => {
    const league = makeLeague({ currentWeek: 1 });
    const teams = [makeTeam({ id: 1, folded: true })];
    const bowlers = [makeBowler({ id: 1, teamId: 1 })];
    const entries = [makeEntry({ id: 1, bowlerId: 1, week: 1, amountPaid: 15 })];
    const flat = buildFlatEntries(league, bowlers, entries);
    const ledger = buildBowlerLedger(flat, 1);

    const rows = buildTeamSummaryRows(league, teams, bowlers, ledger, flat, {});

    expect(rows[0].folded).toBe(true);
    expect(rows[0].paid).toBe(15);
  });
});

describe('buildBowlerStatement', () => {
  it('produces a running week-by-week balance through currentWeek only', () => {
    const league = makeLeague();
    const bowlers = [makeBowler({ id: 1 })];
    const entries = [
      makeEntry({ id: 1, bowlerId: 1, week: 1, amountPaid: 10 }),
      makeEntry({ id: 2, bowlerId: 1, week: 2, amountPaid: 20 }),
      makeEntry({ id: 3, bowlerId: 1, week: 3, amountPaid: 0 }), // beyond currentWeek=2, excluded
    ];
    const flat = buildFlatEntries(league, bowlers, entries);

    const statement = buildBowlerStatement(1, 2, flat);

    expect(statement).toEqual([
      { week: 1, due: 15, paid: 10, balance: 5 },
      { week: 2, due: 15, paid: 20, balance: 0 },
    ]);
  });
});
