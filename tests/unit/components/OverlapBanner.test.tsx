import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OverlapBanner } from '../../../src/renderer/src/components/OverlapBanner';
import type { OverlapWarning } from '../../../src/shared/logic/overlapDetection';

function makeWarning(overrides: Partial<OverlapWarning> = {}): OverlapWarning {
  return {
    employeeId: 1,
    employeeName: 'Casey Nguyen',
    date: '2026-09-12',
    shiftA: { department: 'cafe', shiftId: 10, start: '09:00', end: '14:00' },
    shiftB: { department: 'bar', shiftId: 11, start: '13:00', end: '18:00' },
    ...overrides,
  };
}

describe('OverlapBanner', () => {
  it('renders nothing when there are no warnings', () => {
    const { container } = render(<OverlapBanner warnings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one entry per warning with the employee name and both shifts described', () => {
    render(<OverlapBanner warnings={[makeWarning()]} />);

    const banner = screen.getByTestId('overlap-banner');
    expect(banner).toHaveTextContent('Casey Nguyen');
    expect(banner).toHaveTextContent('Cafe 09:00–14:00');
    expect(banner).toHaveTextContent('Bar 13:00–18:00');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('renders multiple entries, one per conflicting pair', () => {
    const warnings = [
      makeWarning(),
      makeWarning({
        employeeId: 2,
        employeeName: 'Alex Chen',
        date: '2026-09-13',
        shiftA: { department: 'front_desk', shiftId: 20, start: '08:00', end: '14:00' },
        shiftB: { department: 'front_desk', shiftId: 21, start: '12:00', end: '18:00' },
      }),
    ];

    render(<OverlapBanner warnings={warnings} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByTestId('overlap-banner')).toHaveTextContent('Alex Chen');
    expect(screen.getByText(/2 scheduling conflicts detected/i)).toBeInTheDocument();
  });
});
