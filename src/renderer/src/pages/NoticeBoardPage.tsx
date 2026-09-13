import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Notice } from '@shared/types/domain';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { IconMegaphone } from '../components/icons';
import {
  useCreateNotice,
  useMarkNoticesRead,
  useNotices,
  useRemoveNotice,
  useUpdateNotice,
} from '../hooks/useNotices';
import { useSessionStore } from '../store/useSessionStore';

interface NoticeFormState {
  id: number | null;
  title: string;
  body: string;
  expiresAt: string;
}

const EMPTY_FORM: NoticeFormState = { id: null, title: '', body: '', expiresAt: '' };

function toFormState(notice: Notice): NoticeFormState {
  return {
    id: notice.id,
    title: notice.title,
    body: notice.body,
    expiresAt: notice.expiresAt ? notice.expiresAt.slice(0, 10) : '',
  };
}

function isExpired(notice: Notice): boolean {
  return notice.expiresAt !== null && new Date(notice.expiresAt).getTime() <= Date.now();
}

export function NoticeBoardPage(): React.JSX.Element {
  const currentEmployee = useSessionStore((state) => state.currentEmployee);
  const canPost = currentEmployee?.role === 'manager' || currentEmployee?.role === 'coordinator';

  const { data: notices, isLoading, error } = useNotices();
  const createNotice = useCreateNotice();
  const updateNotice = useUpdateNotice();
  const removeNotice = useRemoveNotice();
  const markRead = useMarkNoticesRead();

  const [form, setForm] = useState<NoticeFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = form.id !== null;

  // Opening the board is what "reading" it means — mark it read once per
  // visit regardless of role, so the nav badge/login toast clear promptly.
  useEffect(() => {
    markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire-and-forget once on mount only
  }, []);

  const resetForm = (): void => {
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(null);
    const payload = {
      title: form.title,
      body: form.body,
      expiresAt: form.expiresAt || null,
    };
    try {
      if (isEditing && form.id !== null) {
        await updateNotice.mutateAsync({ id: form.id, ...payload });
      } else {
        await createNotice.mutateAsync(payload);
      }
      // Posting/editing a notice is itself a form of "reading" it — without
      // this, the poster would immediately see their own unread badge light
      // back up (their `lastReadNoticesAt` predates the notice they just
      // wrote).
      markRead.mutate();
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save notice');
    }
  };

  const handleRemove = async (id: number): Promise<void> => {
    await removeNotice.mutateAsync(id);
    if (form.id === id) {
      resetForm();
    }
  };

  const isSaving = createNotice.isPending || updateNotice.isPending;
  const sortedNotices = notices ?? [];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Notice Board</h1>
      </div>

      <div className="card section">
        {isLoading && <LoadingState label="Loading notices…" />}
        {error && (
          <div role="alert" className="form-error">
            {error instanceof Error ? error.message : 'Failed to load notices'}
          </div>
        )}
        {!isLoading && sortedNotices.length === 0 && (
          <EmptyState
            icon={<IconMegaphone />}
            title="No notices yet"
            body={
              canPost
                ? 'Post an announcement below — a new special, an event, anything the team should know about.'
                : 'Check back later for announcements from management.'
            }
          />
        )}
        {sortedNotices.length > 0 && (
          <ul className="notice-list" data-testid="notice-list">
            {sortedNotices.map((notice) => {
              const expired = isExpired(notice);
              return (
                <li
                  key={notice.id}
                  className={expired ? 'notice-card notice-card-expired' : 'notice-card'}
                  data-testid={`notice-${notice.id}`}
                >
                  <div className="notice-card-header">
                    <h2 className="notice-card-title">{notice.title}</h2>
                    {expired && <span className="tag tag-status-denied">Expired</span>}
                  </div>
                  <p className="notice-card-body">{notice.body}</p>
                  <p className="notice-card-meta">
                    Posted by {notice.postedByName} on{' '}
                    {new Date(notice.createdAt).toLocaleDateString()}
                    {notice.expiresAt &&
                      ` — ${expired ? 'expired' : 'shows through'} ${new Date(notice.expiresAt).toLocaleDateString()}`}
                  </p>
                  {canPost && (
                    <div className="notice-card-actions">
                      <button
                        type="button"
                        className="btn btn-link"
                        data-testid={`notice-edit-${notice.id}`}
                        onClick={() => setForm(toFormState(notice))}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-link"
                        data-testid={`notice-remove-${notice.id}`}
                        onClick={() => {
                          handleRemove(notice.id);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canPost && (
        <div className="card">
          <h2>{isEditing ? 'Edit notice' : 'Post a notice'}</h2>
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

            <label className="field-label" htmlFor="notice-title">
              Title
              <input
                id="notice-title"
                className="text-input"
                value={form.title}
                placeholder="New special: Tuesday Taco Night"
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                required
              />
            </label>

            <label className="field-label" htmlFor="notice-body">
              Details
              <textarea
                id="notice-body"
                className="text-input"
                rows={4}
                value={form.body}
                onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
                required
              />
            </label>

            <label className="field-label" htmlFor="notice-expires">
              Show until (optional)
              <input
                id="notice-expires"
                type="date"
                className="text-input"
                value={form.expiresAt}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, expiresAt: event.target.value }))
                }
              />
            </label>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
                data-testid="notice-submit"
              >
                {isEditing ? 'Save changes' : 'Post notice'}
              </button>
              {isEditing && (
                <button type="button" className="btn" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
