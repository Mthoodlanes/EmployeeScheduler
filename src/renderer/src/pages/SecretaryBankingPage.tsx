import { EmptyState } from '../components/EmptyState';
import { IconFolder } from '../components/icons';

/** Placeholder for a future Secretary Apps tool, alongside the dues-tracker Leagues app — no functionality yet. */
export function SecretaryBankingPage(): React.JSX.Element {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Banking</h1>
      </div>

      <div className="card section">
        <EmptyState icon={<IconFolder />} title="Coming Soon" />
      </div>
    </div>
  );
}
