import { DEPARTMENTS, DEPARTMENT_LABELS } from '@shared/types/domain';
import type { Department } from '@shared/types/domain';

interface DepartmentTabsProps {
  value: Department;
  onChange: (department: Department) => void;
}

export function DepartmentTabs({ value, onChange }: DepartmentTabsProps): React.JSX.Element {
  return (
    <div className="department-tabs" role="tablist" aria-label="Department">
      {DEPARTMENTS.map((department) => {
        const isActive = value === department;
        return (
          <button
            key={department}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={isActive ? 'department-tab active' : 'department-tab'}
            onClick={() => onChange(department)}
          >
            {DEPARTMENT_LABELS[department]}
          </button>
        );
      })}
    </div>
  );
}
