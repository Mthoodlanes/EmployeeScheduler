import type { PreferenceMatchResult } from '@shared/logic/preferenceMatch';

interface PreferenceIndicatorProps {
  result: PreferenceMatchResult;
}

const LABELS: Record<'matches' | 'partial' | 'outside', string> = {
  matches: 'Matches stated preference',
  partial: 'Partly outside stated preference',
  outside: 'Outside stated preference',
};

const SYMBOLS: Record<'matches' | 'partial' | 'outside', string> = {
  matches: '✓',
  partial: '~',
  outside: '!',
};

/**
 * A small, purely informational cue on a shift card showing whether it
 * matches the employee's manager-entered preference for that day of week.
 * Never blocks assignment. Renders nothing when the employee has stated no
 * preference for that day at all — that's the neutral default, not a
 * conflict signal worth calling out.
 */
export function PreferenceIndicator({
  result,
}: PreferenceIndicatorProps): React.JSX.Element | null {
  if (result === 'none') {
    return null;
  }

  return (
    <span
      className={`preference-indicator preference-indicator-${result}`}
      title={LABELS[result]}
      data-testid="preference-indicator"
      data-preference-result={result}
    >
      {SYMBOLS[result]}
    </span>
  );
}
