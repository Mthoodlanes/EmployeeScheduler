import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShiftCard } from '../../../src/renderer/src/components/ScheduleGrid/ShiftCard';
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

describe('ShiftCard', () => {
  it('shows the Flexible tag when the assigned employee is salaried', () => {
    render(
      <ShiftCard
        shift={SHIFT}
        color="#7C3AED"
        isSalaried
        preferenceMatch="none"
        resolvedStartTime={SHIFT.startTime}
        resolvedEndTime={SHIFT.endTime}
        onClick={() => {}}
      />,
    );

    expect(screen.getByTestId('salaried-tag')).toHaveTextContent('Flexible');
  });

  it('does not show the Flexible tag for a non-salaried employee', () => {
    render(
      <ShiftCard
        shift={SHIFT}
        color="#7C3AED"
        isSalaried={false}
        preferenceMatch="none"
        resolvedStartTime={SHIFT.startTime}
        resolvedEndTime={SHIFT.endTime}
        onClick={() => {}}
      />,
    );

    expect(screen.queryByTestId('salaried-tag')).not.toBeInTheDocument();
  });

  it('renders no preference indicator when there is no stated preference', () => {
    render(
      <ShiftCard
        shift={SHIFT}
        color="#7C3AED"
        isSalaried={false}
        preferenceMatch="none"
        resolvedStartTime={SHIFT.startTime}
        resolvedEndTime={SHIFT.endTime}
        onClick={() => {}}
      />,
    );

    expect(screen.queryByTestId('preference-indicator')).not.toBeInTheDocument();
  });

  it('renders a "matches" preference indicator', () => {
    render(
      <ShiftCard
        shift={SHIFT}
        color="#7C3AED"
        isSalaried={false}
        preferenceMatch="matches"
        resolvedStartTime={SHIFT.startTime}
        resolvedEndTime={SHIFT.endTime}
        onClick={() => {}}
      />,
    );

    const indicator = screen.getByTestId('preference-indicator');
    expect(indicator).toHaveAttribute('data-preference-result', 'matches');
  });

  it('renders an "outside" preference indicator', () => {
    render(
      <ShiftCard
        shift={SHIFT}
        color="#7C3AED"
        isSalaried={false}
        preferenceMatch="outside"
        resolvedStartTime={SHIFT.startTime}
        resolvedEndTime={SHIFT.endTime}
        onClick={() => {}}
      />,
    );

    const indicator = screen.getByTestId('preference-indicator');
    expect(indicator).toHaveAttribute('data-preference-result', 'outside');
  });

  it('shows the shift time range and the edited badge when overridden', () => {
    render(
      <ShiftCard
        shift={{ ...SHIFT, isOverride: true }}
        color="#7C3AED"
        isSalaried={false}
        preferenceMatch="none"
        resolvedStartTime={SHIFT.startTime}
        resolvedEndTime={SHIFT.endTime}
        onClick={() => {}}
      />,
    );

    expect(screen.getByText('16:00–23:00')).toBeInTheDocument();
    expect(screen.getByTestId('shift-card-edited-1')).toBeInTheDocument();
  });

  it('shows a "Custom" badge for a from-scratch shift with no template and no override', () => {
    render(
      <ShiftCard
        shift={{ ...SHIFT, templateId: null, isOverride: false }}
        color="#7C3AED"
        isSalaried={false}
        preferenceMatch="none"
        resolvedStartTime={SHIFT.startTime}
        resolvedEndTime={SHIFT.endTime}
        onClick={() => {}}
      />,
    );

    expect(screen.getByTestId('shift-card-custom-1')).toBeInTheDocument();
    expect(screen.queryByTestId('shift-card-edited-1')).not.toBeInTheDocument();
  });

  it('shows the anchor label instead of a literal end time, plus the resolved time as a secondary note', () => {
    const anchoredShift: ScheduledShift = {
      ...SHIFT,
      startTime: '14:00',
      endTime: null,
      endAnchor: 'close',
    };
    render(
      <ShiftCard
        shift={anchoredShift}
        color="#7C3AED"
        isSalaried={false}
        preferenceMatch="none"
        resolvedStartTime="14:00"
        resolvedEndTime="23:00"
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
    render(
      <ShiftCard
        shift={anchoredShift}
        color="#7C3AED"
        isSalaried={false}
        preferenceMatch="none"
        resolvedStartTime="14:00"
        resolvedEndTime={null}
        onClick={() => {}}
      />,
    );

    expect(screen.getByTestId('shift-card-anchor-unresolved-1')).toBeInTheDocument();
  });
});
