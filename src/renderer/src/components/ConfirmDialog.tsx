import { Modal } from './Modal';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Generic confirm/cancel interstitial modal, styled like the app's other modal dialogs. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Modal testId="confirm-dialog">
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onConfirm}
          data-testid="confirm-dialog-confirm"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          className="btn"
          onClick={onCancel}
          data-testid="confirm-dialog-cancel"
        >
          {cancelLabel}
        </button>
      </div>
    </Modal>
  );
}
