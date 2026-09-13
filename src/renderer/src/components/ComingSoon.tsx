import { EmptyState } from './EmptyState';
import { IconTools } from './icons';

export function ComingSoon({ title }: { title: string }): React.JSX.Element {
  return (
    <div className="page">
      <div className="page-header">
        <h1>{title}</h1>
      </div>
      <div className="card">
        <EmptyState
          icon={<IconTools />}
          title="Coming soon"
          body="This page will be built out in a later milestone."
        />
      </div>
    </div>
  );
}
