import type { Employee } from '@shared/types/domain';

interface EmployeeSelectProps {
  id: string;
  label: string;
  employees: Employee[];
  value: number | null;
  onChange: (employeeId: number) => void;
  disabled?: boolean;
}

/**
 * A plain employee picker used by manager-submit-on-behalf flows (time off,
 * unavailability) — lets a manager create a request directly for any active
 * employee instead of just themselves. Only rendered for managers; a
 * regular employee never sees it and always submits for themselves. Renders
 * its own `<label>` (rather than accepting the select as a label's child)
 * so the label/control association stays explicit for a11y linting,
 * mirroring `AnchorTimeField`.
 */
export function EmployeeSelect({
  id,
  label,
  employees,
  value,
  onChange,
  disabled,
}: EmployeeSelectProps): React.JSX.Element {
  return (
    <label className="field-label" htmlFor={id}>
      {label}
      <select
        id={id}
        className="text-input"
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        <option value="" disabled>
          Select an employee…
        </option>
        {employees
          .filter((employee) => employee.isActive)
          .map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
      </select>
    </label>
  );
}
