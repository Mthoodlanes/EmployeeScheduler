/**
 * Small monochrome inline SVG icons, theme-aware via `currentColor` (light
 * and dark alike, since neither hardcodes a fill). Replaces every emoji
 * glyph previously used for decorative purposes across the app (empty
 * states, the nav brand mark, the theme toggle, the overlap banner) — see
 * Milestone 8's "remove all emoji" requirement. Every icon shares the same
 * outline style (24x24 viewBox, rounded strokes, no prop-spreading per the
 * Airbnb lint config) so they read as one consistent set; callers size them
 * via CSS on the wrapping element rather than a `size` prop.
 */

/** Nav brand mark — a simple, abstract bowling-pin silhouette. */
export function IconBowlingPin(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2.5c-1 0-1.8.9-1.8 2 0 .6.2 1.1.5 1.6L9.3 10c-.8 2-1.3 4.1-1.3 6.2 0 2.9 1.8 5.3 4 5.3s4-2.4 4-5.3c0-2.1-.5-4.2-1.3-6.2l-1.4-3.9c.3-.5.5-1 .5-1.6 0-1.1-.8-2-1.8-2z" />
      <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSun(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
    </svg>
  );
}

export function IconMoon(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
    </svg>
  );
}

export function IconWarningTriangle(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5 21.5 20h-19L12 3.5z" />
      <path d="M12 9.5v4.5" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconUsers(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 20c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.7 14.9c2.3.4 4.3 2.3 4.3 5.1" />
    </svg>
  );
}

export function IconCalendar(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
    </svg>
  );
}

/** A calendar with a struck-through slash — "nothing scheduled/off" empty states (time off, unavailability). */
export function IconCalendarOff(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
      <path d="M6 20 18 6" />
    </svg>
  );
}

export function IconFolder(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v9.3A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18v-11.5z" />
    </svg>
  );
}

export function IconStar(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8L12 3.5z" />
    </svg>
  );
}

export function IconTools(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.7 6.3a3.5 3.5 0 0 0 4.8 4.8l-6.9 6.9a1.7 1.7 0 0 1-2.4 0l-1-1a1.7 1.7 0 0 1 0-2.4l6.9-6.9-1.4-1.4z" />
      <path d="M4.5 19.5l2-2M9 10 5.6 6.6a2 2 0 0 1 0-2.8L6.6 2.8" />
    </svg>
  );
}

export function IconInbox(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 12.5h5l1.5 2.5h4l1.5-2.5h5" />
      <path d="M5.5 5.5h13l2 7v6a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 18.5v-6l2-7z" />
    </svg>
  );
}

/** "Print Schedule" action on the Schedule Board (Milestone 10). */
export function IconPrinter(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 8.5V3.5h10v5" />
      <rect x="3.5" y="8.5" width="17" height="8" rx="1.5" />
      <path d="M7 15.5h10v5H7v-5z" />
      <circle cx="17" cy="11.5" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Mobile nav menu toggle (Milestone 22) — a plain hamburger glyph. */
export function IconMenu(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </svg>
  );
}

/* ---- Custom title-bar window controls (Milestone 9) ---- */

export function IconWindowMinimize(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M2 6h8" />
    </svg>
  );
}

export function IconWindowMaximize(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.25" y="2.25" width="7.5" height="7.5" rx="0.5" />
    </svg>
  );
}

export function IconWindowRestore(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.75" y="2.25" width="6" height="6" rx="0.5" />
      <path d="M2.25 4.75v5c0 .28.22.5.5.5h5" />
    </svg>
  );
}

export function IconWindowClose(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
    </svg>
  );
}
