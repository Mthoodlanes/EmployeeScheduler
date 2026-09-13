import { api } from '../api/client';
import { IconBowlingPin } from './icons';
import { WindowControls } from './WindowControls';

/**
 * Custom title bar (Milestone 9) — replaces the OS title bar removed by the
 * frameless main window (`frame: false` in `src/main/index.ts`). Rendered
 * once at the top of the whole app (see `App.tsx`), above the router, so it
 * is present on every screen including login/first-run — those pages don't
 * mount `AppLayout`'s nav, but the window still needs to be draggable and
 * closable/minimizable from them.
 *
 * The whole strip is a `-webkit-app-region: drag` region (see `.title-bar`
 * in styles.css) so the window can be dragged by its background. The window
 * controls are carved out as `-webkit-app-region: no-drag` so they stay
 * clickable.
 *
 * Unlike macOS, Windows does NOT automatically wire up double-click-to-
 * maximize for a `-webkit-app-region: drag` element on a frameless window —
 * that's only free for the native title bar/frame. Confirmed by driving a
 * real double-click through Playwright against the built app and observing
 * the OS window bounds not change. So it's wired by hand here.
 */
export function TitleBar(): React.JSX.Element {
  const handleDoubleClick = (): void => {
    api.windowControls.toggleMaximize();
  };

  return (
    <div className="title-bar" onDoubleClick={handleDoubleClick}>
      <span className="title-bar-brand">
        <span className="title-bar-brand-mark" aria-hidden="true">
          <IconBowlingPin />
        </span>
        Mt Hood Lanes Scheduler
      </span>
      <WindowControls />
    </div>
  );
}
