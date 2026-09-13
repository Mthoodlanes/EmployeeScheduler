import type { Migration } from './types';

/**
 * Adds a single GLOBAL `sort_order` column to `employees`, backing the
 * Schedule Board's persistent drag-and-drop row reordering feature. A plain
 * `ALTER TABLE ... ADD COLUMN` — unlike migrations 004/005/006/008, no CHECK
 * constraint is involved here, so none of the recreate-table dance those
 * needed applies.
 *
 * Backfill: `ADD COLUMN ... DEFAULT 0` alone would leave every existing
 * employee at the same value (0), which would make the Schedule Board look
 * broken (every row a coin-flip tie) the moment this ships. Instead, this
 * assigns sequential values (0, 1, 2, ...) in the employees' current
 * alphabetical-by-name order — exactly the order `employeeRepo.listAll()`
 * used before this migration — so the Schedule Board's row order is
 * VISUALLY IDENTICAL immediately after the migration runs. Nothing appears
 * shuffled until a manager actually drags a row, at which point `sort_order`
 * (not `name`) becomes the source of truth.
 */
export const migration009EmployeeSortOrder: Migration = {
  id: 9,
  name: 'employee_sort_order',
  up: (db) => {
    db.exec(`ALTER TABLE employees ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);

    const employeesByName = db.prepare('SELECT id FROM employees ORDER BY name').all() as {
      id: number;
    }[];
    const setSortOrder = db.prepare('UPDATE employees SET sort_order = ? WHERE id = ?');
    employeesByName.forEach((employee, index) => {
      setSortOrder.run(index, employee.id);
    });
  },
};
