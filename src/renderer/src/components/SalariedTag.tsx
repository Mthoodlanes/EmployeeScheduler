/** Shown on a shift card whenever the assigned employee is salaried — their hours are intentionally flexible. */
export function SalariedTag(): React.JSX.Element {
  return (
    <span className="tag tag-salaried" data-testid="salaried-tag">
      Flexible
    </span>
  );
}
