interface AnchorTimeFieldProps<TAnchor extends string> {
  idPrefix: string;
  label: string;
  /** The non-'fixed' anchor value this field offers (e.g. 'open' or 'close'). */
  liveAnchor: TAnchor;
  liveAnchorLabel: string;
  anchor: 'fixed' | TAnchor;
  time: string;
  onAnchorChange: (anchor: 'fixed' | TAnchor) => void;
  onTimeChange: (time: string) => void;
  disabled?: boolean;
}

/**
 * A start/end time field that can be either a fixed literal clock time or
 * anchored to the store's resolved open/close time for whatever date the
 * shift ends up on. Shared by the shift template editor and the schedule
 * grid's "custom time" assignment mode so both offer the exact same control.
 */
export function AnchorTimeField<TAnchor extends string>({
  idPrefix,
  label,
  liveAnchor,
  liveAnchorLabel,
  anchor,
  time,
  onAnchorChange,
  onTimeChange,
  disabled = false,
}: AnchorTimeFieldProps<TAnchor>): React.JSX.Element {
  return (
    <div className="anchor-time-field">
      <label className="field-label" htmlFor={`${idPrefix}-anchor`}>
        {label}
        <select
          id={`${idPrefix}-anchor`}
          data-testid={`${idPrefix}-anchor`}
          className="text-input"
          value={anchor}
          disabled={disabled}
          onChange={(event) => onAnchorChange(event.target.value as 'fixed' | TAnchor)}
        >
          <option value="fixed">Fixed time</option>
          <option value={liveAnchor}>{liveAnchorLabel}</option>
        </select>
      </label>
      <label className="field-label" htmlFor={idPrefix}>
        Time
        <input
          id={idPrefix}
          type="time"
          className="text-input"
          value={time}
          disabled={disabled || anchor !== 'fixed'}
          onChange={(event) => onTimeChange(event.target.value)}
          required={anchor === 'fixed'}
        />
      </label>
    </div>
  );
}
