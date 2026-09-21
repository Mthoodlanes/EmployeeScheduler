import { useState } from 'react';
import type { FormEvent } from 'react';
import { DEPARTMENTS, DEPARTMENT_LABELS } from '@shared/types/domain';
import type { Department, EndAnchor, ShiftTemplate, StartAnchor } from '@shared/types/domain';
import { AnchorTimeField } from '../components/AnchorTimeField';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { IconFolder } from '../components/icons';
import { formatEndEdge, formatStartEdge } from '../utils/formatShiftTime';
import { useTimeFormat } from '../settings/TimeFormatProvider';
import {
  useCreateShiftTemplate,
  useDeactivateShiftTemplate,
  useShiftTemplates,
  useUpdateShiftTemplate,
} from '../hooks/useShiftTemplates';

const DEFAULT_COLOR = '#D97706';

/** Sentinel form value for a shared template (`department === null` on the domain type). */
const SHARED_DEPARTMENT = 'shared' as const;
type DepartmentFormValue = Department | typeof SHARED_DEPARTMENT;

function departmentLabel(department: Department | null): string {
  return department === null ? 'All Departments' : DEPARTMENT_LABELS[department];
}

interface TemplateFormState {
  id: number | null;
  department: DepartmentFormValue;
  name: string;
  startAnchor: StartAnchor;
  startTime: string;
  endAnchor: EndAnchor;
  endTime: string;
  color: string;
  isActive: boolean;
}

const EMPTY_FORM: TemplateFormState = {
  id: null,
  department: 'front_desk',
  name: '',
  startAnchor: 'fixed',
  startTime: '08:00',
  endAnchor: 'fixed',
  endTime: '16:00',
  color: DEFAULT_COLOR,
  isActive: true,
};

function toFormState(template: ShiftTemplate): TemplateFormState {
  return {
    id: template.id,
    department: template.department ?? SHARED_DEPARTMENT,
    name: template.name,
    startAnchor: template.startAnchor,
    startTime: template.startTime ?? EMPTY_FORM.startTime,
    endAnchor: template.endAnchor,
    endTime: template.endTime ?? EMPTY_FORM.endTime,
    color: template.color,
    isActive: template.isActive,
  };
}

export function ShiftTemplatesAdminPage(): React.JSX.Element {
  const { timeFormat } = useTimeFormat();
  const { data: templates, isLoading, error } = useShiftTemplates();
  const createTemplate = useCreateShiftTemplate();
  const updateTemplate = useUpdateShiftTemplate();
  const deactivateTemplate = useDeactivateShiftTemplate();

  const [filterDepartment, setFilterDepartment] = useState<DepartmentFormValue | 'all'>('all');
  const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = form.id !== null;

  const resetForm = (): void => {
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const visibleTemplates = (templates ?? []).filter((template) => {
    if (filterDepartment === 'all') return true;
    if (filterDepartment === SHARED_DEPARTMENT) return template.department === null;
    return template.department === filterDepartment;
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(null);
    try {
      if (isEditing && form.id !== null) {
        await updateTemplate.mutateAsync({
          id: form.id,
          name: form.name,
          startAnchor: form.startAnchor,
          startTime: form.startAnchor === 'fixed' ? form.startTime : null,
          endAnchor: form.endAnchor,
          endTime: form.endAnchor === 'fixed' ? form.endTime : null,
          color: form.color,
          isActive: form.isActive,
        });
      } else {
        await createTemplate.mutateAsync({
          department: form.department === SHARED_DEPARTMENT ? null : form.department,
          name: form.name,
          startAnchor: form.startAnchor,
          startTime: form.startAnchor === 'fixed' ? form.startTime : null,
          endAnchor: form.endAnchor,
          endTime: form.endAnchor === 'fixed' ? form.endTime : null,
          color: form.color,
        });
      }
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save shift template');
    }
  };

  const handleDeactivate = async (id: number): Promise<void> => {
    await deactivateTemplate.mutateAsync(id);
    if (form.id === id) {
      resetForm();
    }
  };

  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Shift Templates</h1>
      </div>

      <div className="card section">
        {/* A bare `.form-row` (not wrapped in `.form-rows`) — this card also
            holds the templates table below, so it must NOT trigger the
            `.card:has(.form-rows)` width cap that a dedicated form card gets. */}
        <label className="form-row" htmlFor="template-filter-department">
          <span className="form-row-label">Filter by department</span>
          <select
            id="template-filter-department"
            className="text-input"
            value={filterDepartment}
            onChange={(event) =>
              setFilterDepartment(event.target.value as DepartmentFormValue | 'all')
            }
          >
            <option value="all">All departments</option>
            {DEPARTMENTS.map((department) => (
              <option key={department} value={department}>
                {DEPARTMENT_LABELS[department]}
              </option>
            ))}
            <option value={SHARED_DEPARTMENT}>Shared / All Departments</option>
          </select>
        </label>

        {isLoading && <LoadingState label="Loading shift templates…" />}
        {error && (
          <div role="alert" className="form-error">
            {error instanceof Error ? error.message : 'Failed to load shift templates'}
          </div>
        )}
        {visibleTemplates.length === 0 && !isLoading && (
          <EmptyState
            icon={<IconFolder />}
            title="No shift templates yet"
            body="Add one below to reuse it from the schedule board without typing a custom time each time."
          />
        )}
        {visibleTemplates.length > 0 && (
          <table className="data-table" data-testid="shift-templates-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Department</th>
                <th>Time</th>
                <th>Color</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visibleTemplates.map((template) => (
                <tr key={template.id}>
                  <td>{template.name}</td>
                  <td>{departmentLabel(template.department)}</td>
                  <td>
                    {formatStartEdge(template.startAnchor, template.startTime, timeFormat)}–
                    {formatEndEdge(template.endAnchor, template.endTime, timeFormat)}
                  </td>
                  <td>
                    <span
                      className="color-swatch"
                      style={{ background: template.color }}
                      aria-label={`Template color ${template.color}`}
                      role="img"
                    />
                  </td>
                  <td>
                    {template.isActive ? (
                      <span className="tag tag-success">Active</span>
                    ) : (
                      <span className="tag tag-inactive">Inactive</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-link"
                      onClick={() => setForm(toFormState(template))}
                    >
                      Edit
                    </button>
                    {template.isActive && (
                      <button
                        type="button"
                        className="btn btn-link"
                        onClick={() => {
                          handleDeactivate(template.id);
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

      <div className="card">
        <h2>{isEditing ? `Edit ${form.name}` : 'Add shift template'}</h2>
        <form
          onSubmit={(event) => {
            handleSubmit(event);
          }}
        >
          {formError && (
            <div role="alert" className="form-error">
              {formError}
            </div>
          )}

          <div className="form-rows">
            <label className="form-row" htmlFor="template-name">
              <span className="form-row-label">Name</span>
              <input
                id="template-name"
                className="text-input"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>

            <label className="form-row" htmlFor="template-department">
              <span className="form-row-label">Department</span>
              <select
                id="template-department"
                className="text-input"
                value={form.department}
                disabled={isEditing}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    department: event.target.value as DepartmentFormValue,
                  }))
                }
              >
                {DEPARTMENTS.map((department) => (
                  <option key={department} value={department}>
                    {DEPARTMENT_LABELS[department]}
                  </option>
                ))}
                <option value={SHARED_DEPARTMENT}>All Departments (Shared)</option>
              </select>
            </label>

            <AnchorTimeField
              idPrefix="template-start"
              label="Start"
              liveAnchor="open"
              liveAnchorLabel="Opens with store"
              anchor={form.startAnchor}
              time={form.startTime}
              onAnchorChange={(anchor) => setForm((prev) => ({ ...prev, startAnchor: anchor }))}
              onTimeChange={(time) => setForm((prev) => ({ ...prev, startTime: time }))}
            />

            <AnchorTimeField
              idPrefix="template-end"
              label="End"
              liveAnchor="close"
              liveAnchorLabel="Closes with store"
              anchor={form.endAnchor}
              time={form.endTime}
              onAnchorChange={(anchor) => setForm((prev) => ({ ...prev, endAnchor: anchor }))}
              onTimeChange={(time) => setForm((prev) => ({ ...prev, endTime: time }))}
            />

            <label className="form-row" htmlFor="template-color">
              <span className="form-row-label">Color</span>
              <input
                id="template-color"
                type="color"
                className="color-input"
                value={form.color}
                onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
              />
            </label>

            {isEditing && (
              <label className="checkbox-row" htmlFor="template-active">
                <input
                  id="template-active"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, isActive: event.target.checked }))
                  }
                />
                Active
              </label>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isEditing ? 'Save changes' : 'Add template'}
            </button>
            {isEditing && (
              <button type="button" className="btn" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
