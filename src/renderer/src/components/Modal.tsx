import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface ModalProps {
  children: ReactNode;
  testId?: string;
}

/**
 * Portals its content to `document.body` rather than rendering in place.
 * Every dialog in the app is nested somewhere inside `.app-content`, which
 * (like several other elements) carries a CSS animation for the subtle
 * page-transition polish — and in Chromium, an ancestor with a running CSS
 * animation can become the containing block for a `position: fixed`
 * descendant, which would otherwise misposition/clip a modal instead of
 * centering it over the whole viewport. Portaling to `document.body`
 * sidesteps that entirely, which is also just correct practice for modals.
 */
export function Modal({ children, testId }: ModalProps): React.JSX.Element {
  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true" data-testid={testId}>
      <div className="modal-card">{children}</div>
    </div>,
    document.body,
  );
}
