/**
 * Pure merge logic behind the Schedule Board's persistent employee
 * drag-and-drop reordering (see the feature plan). `employees.sort_order` is
 * a single GLOBAL ordering column, but a manager only ever drags rows within
 * whichever department tab they're currently viewing — and that tab shows
 * only a SUBSET of all employees (those assigned to that department). This
 * module reconciles the two: given the full current global order and the
 * new relative order of just the dragged subset, it produces the complete
 * new global order to send to the reorder endpoint.
 *
 * The rule (see the feature plan's "Reorder endpoint" section): every
 * employee NOT in the dragged subset keeps its exact position — the set of
 * grid "slots" the subset occupies in the full order is left untouched, and
 * only WHICH ids fill those slots changes, per the subset's new order. This
 * is what "leaving every other employee's relative position unchanged"
 * means in practice: an employee working two departments who gets dragged
 * in one tab moves relative to the OTHER employees shown in that tab, but
 * every employee outside the subset — including ones interleaved between
 * subset members in the full order — never shifts.
 */

/**
 * Merges a reordered subset of ids back into the full ordered list.
 *
 * @param fullOrder The complete current global order of every employee id.
 * @param reorderedSubset The new relative order of exactly the ids that
 *   belong to the subset being reordered (e.g. one department's employees,
 *   in their post-drag order). Must contain the same set of ids — no more,
 *   no fewer, no duplicates — as appear in `fullOrder`.
 * @returns A new array, the same length as `fullOrder`, with subset ids
 *   redistributed into the slots they collectively occupied, in
 *   `reorderedSubset`'s order, and every other id untouched.
 */
export function mergeReorderedSubset(fullOrder: number[], reorderedSubset: number[]): number[] {
  const subsetIds = new Set(reorderedSubset);
  if (subsetIds.size !== reorderedSubset.length) {
    throw new Error('reorderedSubset must not contain duplicate ids');
  }

  const slots: number[] = [];
  fullOrder.forEach((id, index) => {
    if (subsetIds.has(id)) {
      slots.push(index);
    }
  });

  if (slots.length !== reorderedSubset.length) {
    throw new Error(
      "reorderedSubset must contain exactly the ids that appear in fullOrder's matching subset",
    );
  }

  const merged = [...fullOrder];
  slots.forEach((slotIndex, i) => {
    merged[slotIndex] = reorderedSubset[i];
  });
  return merged;
}
