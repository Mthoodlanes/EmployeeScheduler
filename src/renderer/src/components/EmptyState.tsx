import type { ReactNode } from 'react';
import { IconInbox } from './icons';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body?: string;
}

/** A consistent, on-brand placeholder for any list or page with no data yet — never a blank container. */
export function EmptyState({
  icon = <IconInbox />,
  title,
  body,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        {icon}
      </span>
      <p className="empty-state-title">{title}</p>
      {body && <p className="empty-state-body">{body}</p>}
    </div>
  );
}

/** A consistent loading placeholder (spinner + label) used in place of a raw "Loading..." text node. */
export function LoadingState({ label = 'Loading…' }: { label?: string }): React.JSX.Element {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}
