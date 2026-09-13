import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { DAY_OF_WEEK_LABELS, DEPARTMENTS, DEPARTMENT_LABELS } from '@shared/types/domain';
import type { Department, Role } from '@shared/types/domain';
import type { EmployeeWithDepartments } from '@shared/types/ipc';
import {
  useCreateEmployee,
  useDeactivateEmployee,
  useEmployees,
  useSetEmployeeDepartments,
  useUpdateEmployee,
} from '../hooks/useEmployees';
import {
  useCreatePreference,
  useEmployeePreferences,
  useRemovePreference,
} from '../hooks/useEmployeePreferences';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { IconCalendar, IconUsers } from '../components/icons';

interface EmployeeFormState {
  id: number | null;
  name: string;
  username: string;
  password: string;
  role: Role;
  isSalaried: boolean;
  isActive: boolean;
  departments: Department[];
}

const EMPTY_FORM: EmployeeFormState = {
  id: null,
  name: '',
  username: '',
  password: '',
  role: 'employee',
  isSalaried: false,
  isActive: true,
  departments: [],
};

function toFormState(employee: EmployeeWithDepartments): EmployeeFormState {
  return {
    id: employee.id,
    name: employee.name,
    username: employee.username,
    password: '',
    role: employee.role,
    isSalaried: employee.isSalaried,
    isActive: employee.isActive,
    departments: employee.departments,
  };
}

interface PreferenceFormState {
  dayOfWeek: number;
  preferredStartTime: string;
  preferredEndTime: string;
  note: string;
}

const EMPTY_PREFERENCE_FORM: PreferenceFormState = {
  dayOfWeek: 1,
  preferredStartTime: '08:00',
  preferredEndTime: '12:00',
  note: '',
};

interface EmployeePreferencesPanelProps {
  employeeId: number;
  employeeName: string;
}

/** Manager-only editor for one employee's stated day-of-week preference windows. An employee may have several. */
function EmployeePreferencesPanel({
  employeeId,
  employeeName,
}: EmployeePreferencesPanelProps): React.JSX.Element {
  const { data: allPreferences } = useEmployeePreferences();
  const createPreference = useCreatePreference();
  const removePreference = useRemovePreference();

  const [prefForm, setPrefForm] = useState<PreferenceFormState>(EMPTY_PREFERENCE_FORM);
  const [prefError, setPrefError] = useState<string | null>(null);

  const employeePreferences = (allPreferences ?? []).filter(
    (pref) => pref.employeeId === employeeId,
  );

  const handleAddPreference = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setPrefError(null);
    try {
      await createPreference.mutateAsync({
        employeeId,
        dayOfWeek: prefForm.dayOfWeek,
        preferredStartTime: prefForm.preferredStartTime,
        preferredEndTime: prefForm.preferredEndTime,
        note: prefForm.note ? prefForm.note : undefined,
      });
      setPrefForm(EMPTY_PREFERENCE_FORM);
    } catch (err) {
      setPrefError(err instanceof Error ? err.message : 'Could not save preference');
    }
  };

  const handleRemovePreference = async (id: number): Promise<void> => {
    await removePreference.mutateAsync(id);
  };

  return (
    <div className="card section-top" data-testid="preferences-panel">
      <h2>{employeeName}&rsquo;s preferences</h2>
      <p className="modal-subtitle">
        Soft, non-blocking scheduling preferences — shown as a hint on the schedule grid.
      </p>

      {employeePreferences.length === 0 ? (
        <EmptyState
          icon={<IconCalendar />}
          title="No preferences stated yet"
          body="Add a preferred day-of-week window below to show a soft match hint on the schedule grid."
        />
      ) : (
        <table className="data-table" data-testid="preferences-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Preferred window</th>
              <th>Note</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {employeePreferences.map((pref) => (
              <tr key={pref.id}>
                <td>{DAY_OF_WEEK_LABELS[pref.dayOfWeek]}</td>
                <td>
                  {pref.preferredStartTime}–{pref.preferredEndTime}
                </td>
                <td>{pref.note ?? ''}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-link"
                    data-testid={`preference-remove-${pref.id}`}
                    onClick={() => {
                      handleRemovePreference(pref.id);
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form
        className="form-grid form-top-gap"
        onSubmit={(event) => {
          handleAddPreference(event);
        }}
      >
        {prefError && (
          <div role="alert" className="form-error">
            {prefError}
          </div>
        )}

        <label className="field-label" htmlFor="preference-day">
          Day of week
          <select
            id="preference-day"
            className="text-input"
            value={prefForm.dayOfWeek}
            onChange={(event) =>
              setPrefForm((prev) => ({ ...prev, dayOfWeek: Number(event.target.value) }))
            }
          >
            {DAY_OF_WEEK_LABELS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-label" htmlFor="preference-start">
          Preferred start
          <input
            id="preference-start"
            type="time"
            className="text-input"
            value={prefForm.preferredStartTime}
            onChange={(event) =>
              setPrefForm((prev) => ({ ...prev, preferredStartTime: event.target.value }))
            }
          />
        </label>

        <label className="field-label" htmlFor="preference-end">
          Preferred end
          <input
            id="preference-end"
            type="time"
            className="text-input"
            value={prefForm.preferredEndTime}
            onChange={(event) =>
              setPrefForm((prev) => ({ ...prev, preferredEndTime: event.target.value }))
            }
          />
        </label>

        <label className="field-label" htmlFor="preference-note">
          Note (optional)
          <input
            id="preference-note"
            className="text-input"
            value={prefForm.note}
            onChange={(event) => setPrefForm((prev) => ({ ...prev, note: event.target.value }))}
          />
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={createPreference.isPending}>
            Add preference
          </button>
        </div>
      </form>
    </div>
  );
}

export function EmployeesAdminPage(): React.JSX.Element {
  const { data: employees, isLoading, error } = useEmployees();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deactivateEmployee = useDeactivateEmployee();
  const setDepartments = useSetEmployeeDepartments();

  const [form, setForm] = useState<EmployeeFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = form.id !== null;
  const formCardRef = useRef<HTMLDivElement>(null);

  // `useEmployees()` returns the Schedule Board's `sort_order` order (drag-
  // and-drop position), not alphabetical. This page is about finding/editing
  // a specific person by name, not matching the physical schedule board, so
  // it sorts alphabetically here rather than adopting that order — keeps
  // this table's existing lookup usability unchanged by the reordering
  // feature.
  const alphabeticalEmployees = useMemo(
    () => [...(employees ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [employees],
  );

  const editEmployee = (employee: EmployeeWithDepartments): void => {
    setForm(toFormState(employee));
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const resetForm = (): void => {
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const toggleDepartment = (department: Department): void => {
    setForm((prev) => ({
      ...prev,
      departments: prev.departments.includes(department)
        ? prev.departments.filter((d) => d !== department)
        : [...prev.departments, department],
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(null);
    try {
      if (isEditing && form.id !== null) {
        await updateEmployee.mutateAsync({
          id: form.id,
          name: form.name,
          role: form.role,
          isSalaried: form.isSalaried,
          isActive: form.isActive,
          password: form.password ? form.password : undefined,
        });
        await setDepartments.mutateAsync({ id: form.id, departments: form.departments });
      } else {
        await createEmployee.mutateAsync({
          name: form.name,
          username: form.username,
          password: form.password,
          role: form.role,
          isSalaried: form.isSalaried,
          departments: form.departments,
        });
      }
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save employee');
    }
  };

  const handleDeactivate = async (id: number): Promise<void> => {
    await deactivateEmployee.mutateAsync(id);
    if (form.id === id) {
      resetForm();
    }
  };

  const isSaving = createEmployee.isPending || updateEmployee.isPending || setDepartments.isPending;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Employees</h1>
      </div>

      <div className="card section">
        {isLoading && <LoadingState label="Loading employees…" />}
        {error && (
          <div role="alert" className="form-error">
            {error instanceof Error ? error.message : 'Failed to load employees'}
          </div>
        )}
        {employees && employees.length === 0 && (
          <EmptyState
            icon={<IconUsers />}
            title="No employees yet"
            body="Add the first employee below to start building the schedule."
          />
        )}
        {employees && employees.length > 0 && (
          <table className="data-table" data-testid="employees-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Departments</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {alphabeticalEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.name}</td>
                  <td>{employee.username}</td>
                  <td>{employee.role}</td>
                  <td>
                    {employee.departments.map((department) => (
                      <span key={department} className="tag">
                        {DEPARTMENT_LABELS[department]}
                      </span>
                    ))}
                    {employee.isSalaried && <span className="tag tag-salaried">Salaried</span>}
                  </td>
                  <td>
                    {employee.isActive ? (
                      <span className="tag tag-success">Active</span>
                    ) : (
                      <span className="tag tag-inactive">Inactive</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-link"
                      onClick={() => editEmployee(employee)}
                    >
                      Edit
                    </button>
                    {employee.isActive && (
                      <button
                        type="button"
                        className="btn btn-link"
                        onClick={() => {
                          handleDeactivate(employee.id);
                        }}
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" ref={formCardRef}>
        <h2>{isEditing ? `Edit ${form.name}` : 'Add employee'}</h2>
        <form
          className="form-grid"
          onSubmit={(event) => {
            handleSubmit(event);
          }}
        >
          {formError && (
            <div role="alert" className="form-error">
              {formError}
            </div>
          )}
          <label className="field-label" htmlFor="employee-name">
            Name
            <input
              id="employee-name"
              className="text-input"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>

          <label className="field-label" htmlFor="employee-username">
            Username
            <input
              id="employee-username"
              className="text-input"
              value={form.username}
              disabled={isEditing}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              required
            />
          </label>

          <label className="field-label" htmlFor="employee-password">
            {isEditing ? 'Reset password (optional)' : 'Password'}
            <input
              id="employee-password"
              className="text-input"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              required={!isEditing}
            />
          </label>

          <label className="field-label" htmlFor="employee-role">
            Role
            <select
              id="employee-role"
              className="text-input"
              value={form.role}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, role: event.target.value as Role }))
              }
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
            </select>
          </label>

          <span className="field-label">Departments</span>
          {DEPARTMENTS.map((department) => (
            <label key={department} className="checkbox-row" htmlFor={`department-${department}`}>
              <input
                id={`department-${department}`}
                type="checkbox"
                checked={form.departments.includes(department)}
                onChange={() => toggleDepartment(department)}
              />
              {DEPARTMENT_LABELS[department]}
            </label>
          ))}

          <label className="checkbox-row" htmlFor="employee-salaried">
            <input
              id="employee-salaried"
              type="checkbox"
              checked={form.isSalaried}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, isSalaried: event.target.checked }))
              }
            />
            Salaried (flexible hours)
          </label>

          {isEditing && (
            <label className="checkbox-row" htmlFor="employee-active">
              <input
                id="employee-active"
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, isActive: event.target.checked }))
                }
              />
              Active
            </label>
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isEditing ? 'Save changes' : 'Add employee'}
            </button>
            {isEditing && (
              <button type="button" className="btn" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {isEditing && form.id !== null && (
        <EmployeePreferencesPanel employeeId={form.id} employeeName={form.name} />
      )}
    </div>
  );
}
