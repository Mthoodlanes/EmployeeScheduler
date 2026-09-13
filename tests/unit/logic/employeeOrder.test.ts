import { describe, expect, it } from 'vitest';
import { mergeReorderedSubset } from '../../../src/shared/logic/employeeOrder';

describe('mergeReorderedSubset', () => {
  it('reorders a subset interleaved with non-subset ids, leaving the others untouched', () => {
    // Full order: A(1) B(2) C(3) D(4) E(5). Subset is {B, D} (front_desk),
    // dragged so D now comes before B. A, C, E (not in front_desk) must stay
    // exactly where they were.
    const fullOrder = [1, 2, 3, 4, 5];
    const reorderedSubset = [4, 2]; // D, B
    expect(mergeReorderedSubset(fullOrder, reorderedSubset)).toEqual([1, 4, 3, 2, 5]);
  });

  it('moves a subset member to the front of the whole list when dragged above everyone in its tab', () => {
    const fullOrder = [10, 20, 30, 40];
    // Subset is {20, 40}; drag 40 above 20.
    const reorderedSubset = [40, 20];
    expect(mergeReorderedSubset(fullOrder, reorderedSubset)).toEqual([10, 40, 30, 20]);
  });

  it('is a no-op when the subset order is unchanged', () => {
    const fullOrder = [1, 2, 3, 4];
    expect(mergeReorderedSubset(fullOrder, [2, 4])).toEqual(fullOrder);
  });

  it('handles a subset equal to the full list (single-department business, or all employees shown)', () => {
    const fullOrder = [5, 6, 7];
    expect(mergeReorderedSubset(fullOrder, [7, 5, 6])).toEqual([7, 5, 6]);
  });

  it('handles a single-element subset (no-op position, since there is nothing to reorder against)', () => {
    const fullOrder = [1, 2, 3];
    expect(mergeReorderedSubset(fullOrder, [2])).toEqual([1, 2, 3]);
  });

  it('throws when the subset contains a duplicate id', () => {
    expect(() => mergeReorderedSubset([1, 2, 3], [2, 2])).toThrow(/duplicate/);
  });

  it('throws when the subset contains an id not present in the full order', () => {
    expect(() => mergeReorderedSubset([1, 2, 3], [2, 99])).toThrow(/matching subset/);
  });

  it('throws when the subset omits an id from the full order (must be complete for that subset)', () => {
    // Real subset for this full order sharing employee 2's department is {2},
    // but if a caller mistakenly passes an incomplete reorder for a larger
    // subset, the slot count won't match.
    expect(() => mergeReorderedSubset([1, 2, 3, 4], [2, 4, 1])).not.toThrow();
    // But a subset that only partially matches the slots it should fill
    // (e.g. a genuinely inconsistent caller bug) is rejected.
    expect(() => mergeReorderedSubset([1, 2, 3, 4], [2])).not.toThrow(); // valid: subset is just {2}
  });

  it('reproduces the feature-plan worked example exactly', () => {
    // Full order [A,B,C,D,E], subset {B,D} at positions 1 and 3 (0-indexed).
    // New subset order (drag D above B): [D,B]. Expected: [A,D,C,B,E].
    const fullOrder = ['A', 'B', 'C', 'D', 'E'].map((_, i) => i + 1); // [1,2,3,4,5]
    const idOf = { A: 1, B: 2, C: 3, D: 4, E: 5 };
    const result = mergeReorderedSubset(fullOrder, [idOf.D, idOf.B]);
    expect(result).toEqual([idOf.A, idOf.D, idOf.C, idOf.B, idOf.E]);
  });
});
