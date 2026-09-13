import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SpecialEventBadge } from '../../../src/renderer/src/components/SpecialEventBadge';
import type { ResolvedHours } from '../../../src/shared/logic/hoursResolution';

function makeHours(overrides: Partial<ResolvedHours> = {}): ResolvedHours {
  return {
    openTime: '10:00',
    closeTime: '22:00',
    isClosed: false,
    isOverride: false,
    ...overrides,
  };
}

describe('SpecialEventBadge', () => {
  it('shows the plain hours range on a normal day', () => {
    render(<SpecialEventBadge hours={makeHours()} />);

    const badge = screen.getByTestId('hours-badge-default');
    expect(badge).toHaveTextContent('10:00–22:00');
  });

  it('shows the label and hours for a special-event override day', () => {
    render(
      <SpecialEventBadge
        hours={makeHours({
          isOverride: true,
          label: 'League Night',
          openTime: '08:00',
          closeTime: '22:00',
        })}
      />,
    );

    const badge = screen.getByTestId('hours-badge-event');
    expect(badge).toHaveTextContent('League Night');
    expect(badge).toHaveTextContent('08:00–22:00');
  });

  it('shows a distinct "Closed" treatment for a fully closed day', () => {
    render(
      <SpecialEventBadge
        hours={makeHours({ isClosed: true, openTime: null, closeTime: null, isOverride: false })}
      />,
    );

    const badge = screen.getByTestId('hours-badge-closed');
    expect(badge).toHaveTextContent('Closed');
  });

  it('includes the override label alongside "Closed" when a closed override carries one', () => {
    render(
      <SpecialEventBadge
        hours={makeHours({
          isClosed: true,
          isOverride: true,
          label: 'Private Party',
          openTime: null,
          closeTime: null,
        })}
      />,
    );

    const badge = screen.getByTestId('hours-badge-closed');
    expect(badge).toHaveTextContent('Closed — Private Party');
  });

  it('shows an "hours not set" state when neither the weekly default nor an override exist', () => {
    render(
      <SpecialEventBadge hours={makeHours({ isClosed: false, openTime: null, closeTime: null })} />,
    );

    expect(screen.getByTestId('hours-badge-unknown')).toHaveTextContent('Hours not set');
  });
});
