import type { EndAnchor, StartAnchor } from '@shared/types/domain';

/** The literal-time-or-anchor-label text for one edge of a shift/template (e.g. "14:00" or "Close"). */
export function formatStartEdge(anchor: StartAnchor, time: string | null): string {
  return anchor === 'fixed' ? (time ?? '—') : 'Open';
}

export function formatEndEdge(anchor: EndAnchor, time: string | null): string {
  return anchor === 'fixed' ? (time ?? '—') : 'Close';
}
