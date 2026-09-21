import type { WeekStats } from '@shared/logic/duesLedger';
import { formatCurrency } from '../../utils/formatCurrency';

interface PrintWeeklyBankingProps {
  leagueName: string;
  week: number;
  stats: WeekStats;
}

/**
 * Purpose-built, print-only rendering of one week's Weekly Banking report —
 * mirrors `PrintSchedule.tsx`'s pattern (always mounted, hidden on screen,
 * shown only under `@media print`; see PrintWeeklyBanking.css and the print
 * rules in styles.css that hide the rest of the app's chrome). Unlike
 * `PrintSchedule`, the week being printed isn't necessarily the one
 * currently on screen — the Weekly History table's per-row "Print" button
 * can print any past week — so the page passes whichever week was last
 * clicked, not just "whatever's currently displayed."
 */
export function PrintWeeklyBanking({
  leagueName,
  week,
  stats,
}: PrintWeeklyBankingProps): React.JSX.Element {
  const rows: Array<[string, string | number]> = [
    ['Active Bowlers', stats.activeBowlers],
    ['Requirement (Dues + Vacancy)', formatCurrency(stats.requirement)],
    ['Covered This Week', formatCurrency(stats.coveredThisWeek)],
    ['Prepayment Credit Applied', formatCurrency(stats.prepaymentCredit)],
    ['Paid Down Arrears', formatCurrency(stats.arrearsPaydown)],
    ['Total Cash Collected', formatCurrency(stats.totalCash)],
    ['Lineage Pass-Through', formatCurrency(stats.lineagePassThrough)],
    ['League Keeps', formatCurrency(stats.leagueKeeps)],
  ];

  return (
    <div className="print-weekly-banking">
      <h1 className="print-weekly-banking-title">{leagueName}</h1>
      <p className="print-weekly-banking-subtitle">
        Weekly Banking Report — Week {week} &nbsp;•&nbsp; Printed{' '}
        {new Date().toLocaleDateString()}
      </p>
      <table className="print-weekly-banking-table">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className={label === 'League Keeps' ? 'print-weekly-banking-total' : undefined}>
              <td>{label}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {stats.vacantFeeTotal > 0 && (
        <p className="print-weekly-banking-note">
          Includes {formatCurrency(stats.vacantFeeTotal)} in unfilled-spot vacancy fees owed this
          week — not tied to any specific bowler.
        </p>
      )}
    </div>
  );
}
