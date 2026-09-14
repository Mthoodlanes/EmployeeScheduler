import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShiftCard } from '../../../src/renderer/src/components/ScheduleGrid/ShiftCard';
import { TimeFormatProvider } from '../../../src/renderer/src/settings/TimeFormatProvider';
import type { ScheduledShift } from '../../../src/shared/types/domain';

const SHIFT: ScheduledShift = {
  id: 1,
  employeeId: 1,
  department: 'bar',
  shiftDate: '2026-09-12',
  startTime: '16:00',
  endTime: '23:00',
  startAnchor: 'fixed',
  endAnchor: 'fixed',
  templateId: 5,
  isOverride: false,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** `ShiftCard` reads the time-format setting via `useTimeFormat()`, which requires a `TimeFormatProvider` ancestor — this wraps every render the same way `main.tsx` does. */
function renderShiftCard(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<TimeFormatProvider>{ui}</TimeFormatProvider>);
}

describe('ShiftCard', () => {
  it('shows the Flexible tag when the assigned employee is salaried', () => {
    renderShiftCard(
      <ShiftCard
        shift={SHIFT}
        color="#7C3AED"
        isSalaried
        preferenceMatch="none"
        resolvedStartTime={SHIFT.startTime}
        resolvedEndTime={SHIFT.endTime}
        templateName={null}
        onClick={() => {}}
      />,
    );

    expect(screen.getByTestId('salaried-tag')).toHaveTextContent('Flexible');
  });

  it('does not show the Flexible tag for a non-salaried employee', () => {
    renderShiftCard(
      <ShiftCard
        shift={SHIFT}
        color="#7C3AED"
        isSalaried={false}
        preferenceMatch="none"
        resolvedStartTime={SHIFT.startTime}
        resolvedEndTime={SHIFT.endTime}
        templateName={null}
        onClick={() => {}}
      />,
    );

    expect(screen.queryByTestId('salaried-tag')).not.toBeInTheDocument();
  });

  it('renders no preference indicator when there is no stated preference', () => {
    renderShiftCard(
      <ShiftCard
        shift={SHIFT}
        color="#7C3AED"
        isSalaried={false}
        preferenceMatch="none"
        resolvedStartTime={SHIFT.startTime}
        resolvedEndTime={SHIFT.endTime}
        templateName={null}
        onClick={() => {}}
      />,
    );

    expect(screen.queryByTestId('preference-indicator')).not.toBeInTheDocument();
  });

  it('renders a "matches" preference indicator', () => {
    renderShiftCard(
      <ShiftCard
        shift={SHIFT}
        color="#7C3AED"
        isSalaried={false}
        preferenceMatch="matches"
        resolvedStartTime={SHIFT.startTime}
        resolvedEndTime={SHIFT.endTime}
        templateName={null}
        onClick={() => {}}
      />,
    );

    const indicator = screen.getByTestId('preference-indicator');
    expect(indicator).toHaveAttribute('data-preference-result', 'matches');
  });

  it('renders an "outside" preference indicator', () => {
    renderShiftCard(
      <ShiftCard
        shift={SHIFT}
        color="#7C3AED"
        isSalaried={false}
        preferenceMatch="outside"
        resolvedStartTime={SHIFT.startTime}
        resolvedEndTime={SHIFT.endTime}
        templateName={null}
        onClick={() => {}}
      />,
    );

    const indicator = screen.getByTestId('preference-indicator');
    expect(indicator).toHaveAttribute('data-preference-result', 'outside');
  });

  it('shows the shift time range and the edited badge when overridden', () => {
    renderShiftCard(
      <ShiftCard
        shift={{ ...SHIFT, isOverride: true }}
        color="#7C3AED"
        isSalaried={false}
        preferenceMatch="none"
        resolvedStartTime={SHIFT.startTime}
        resolvedEndTime={SHIFT.endTime}
        templateName={null}
        onClick={() => {}}
      />,
    );

    expect(screen.getByText('16:00–23:00')).toBeInTheDocument();
    expect(screen.getByTestId('shift-card-edited-1')).toBeInTheDocument();
  });

  it('shows no template badge for a from-scratch custom-time shift with no template and no override', () => {
    renderShiftCard(
      <ShiftCard
        shift={{ ...SHIFT, templateId: null, isOverride: false }}
        color="#7C3AED"
        isSalaried={false}
        preferenceMatch="none"
        resolvedStartTime={SHIFT.startTime}
        resolvedEndTime={SHIFT.endTime}
        templateName={null}
        onClick={() => {}}
      />,
    );

    expect(screen.queryByTestId('shift-card-template-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shift-card-edited-1')).not.toBeInTheDocument();
  });

  it('shows the template name badge for a shift assigned from a standard template', () => {
    renderShiftCard(
      <ShiftCard
        shift={{ ...SHIFT, templateId: 5, isOverride: false }}
        color="#7C3AED"
        isSalaried={false}
        preferenceMatch="none"
        resolvedStartTime={SHIFT.startTime}
        resolvedEndTime={SHIFT.endTime}
        templateName="Bar Open"
        onClick={() => {}}
      />,
    );

    expect(screen.getByTestId('shift-card-template-1')).toHaveTextContent('Bar Open');
    expect(screen.queryByTestId('shift-card-edited-1')).not.toBeInTheDocument();
  });

  it('shows the anchor label instead of a literal end time, plus the resolved time as a secondary note', () => {
    const anchoredShift: ScheduledShift = {
      ...SHIFT,
      startTime: '14:00',
      endTime: null,
      endAnchor: 'close',
    };
    renderShiftCard(
      <ShiftCard
        shift={anchoredShift}
        color="#7C3AED"
        isSalaried={false}
        preferenceMatch="none"
        resolvedStartTime="14:00"
        resolvedEndTime="23:00"
        templateName={null}
        onClick={() => {}}
      />,
    );

    expect(screen.getByText('14:00–Close')).toBeInTheDocument();
    expect(screen.getByTestId('shift-card-anchor-note-1')).toHaveTextContent(
      'Resolves to 14:00–23:00',
    );
  });

  it('shows an unresolved flag instead of a note when the anchored edge cannot be resolved (store closed that day)', () => {
    const anchoredShift: ScheduledShift = {
      ...SHIFT,
      startTime: '14:00',
      endTime: null,
      endAnchor: 'close',
    };
    renderShiftCard(
      <ShiftCard
        shift={anchoredShift}
        color="#7C3AED"
        isSalaried={false}
        preferenceMatch="none"
        resolvedStartTime="14:00"
        resolvedEndTime={null}
        templateName={null}
        onClick={() => {}}
      />,
    );

    expect(screen.getByTestId('shift-card-anchor-unresolved-1')).toBeInTheDocument();
  });
});
