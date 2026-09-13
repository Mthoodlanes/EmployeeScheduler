import { describe, expect, it } from 'vitest';
import type { ApprovalStatus } from '../../../src/shared/types/domain';
import {
  applyTransition,
  canTransition,
  InvalidApprovalTransitionError,
} from '../../../src/shared/logic/approvalStateMachine';

const STATUSES: ApprovalStatus[] = ['pending', 'approved', 'denied'];

const VALID_TRANSITIONS: Array<[ApprovalStatus, ApprovalStatus]> = [
  ['pending', 'approved'],
  ['pending', 'denied'],
];

describe('approvalStateMachine', () => {
  describe('canTransition', () => {
    it.each(VALID_TRANSITIONS)('allows %s -> %s', (from, to) => {
      expect(canTransition(from, to)).toBe(true);
    });

    it('exercises every from/to combination, allowing only pending -> approved/denied', () => {
      const results: Array<{ from: ApprovalStatus; to: ApprovalStatus; allowed: boolean }> = [];
      STATUSES.forEach((from) => {
        STATUSES.forEach((to) => {
          results.push({ from, to, allowed: canTransition(from, to) });
        });
      });

      const allowedPairs = results.filter((r) => r.allowed).map(({ from, to }) => `${from}->${to}`);
      expect(allowedPairs.sort()).toEqual(['pending->approved', 'pending->denied']);
    });

    it('rejects a no-op transition to the same status', () => {
      expect(canTransition('pending', 'pending')).toBe(false);
      expect(canTransition('approved', 'approved')).toBe(false);
      expect(canTransition('denied', 'denied')).toBe(false);
    });

    it('treats approved as terminal', () => {
      expect(canTransition('approved', 'pending')).toBe(false);
      expect(canTransition('approved', 'denied')).toBe(false);
    });

    it('treats denied as terminal', () => {
      expect(canTransition('denied', 'pending')).toBe(false);
      expect(canTransition('denied', 'approved')).toBe(false);
    });
  });

  describe('applyTransition', () => {
    it.each(VALID_TRANSITIONS)(
      'returns the new status for a valid %s -> %s transition',
      (from, to) => {
        expect(applyTransition(from, to)).toBe(to);
      },
    );

    it('throws InvalidApprovalTransitionError for an invalid transition', () => {
      expect(() => applyTransition('approved', 'pending')).toThrow(InvalidApprovalTransitionError);
      expect(() => applyTransition('denied', 'approved')).toThrow(InvalidApprovalTransitionError);
      expect(() => applyTransition('approved', 'denied')).toThrow(InvalidApprovalTransitionError);
      expect(() => applyTransition('pending', 'pending')).toThrow(InvalidApprovalTransitionError);
    });

    it('includes the offending states in the error message', () => {
      expect(() => applyTransition('approved', 'denied')).toThrow(/approved.*denied/);
    });
  });
});
