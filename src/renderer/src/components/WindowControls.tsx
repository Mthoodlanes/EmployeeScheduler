import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { IconWindowClose, IconWindowMaximize, IconWindowMinimize, IconWindowRestore } from './icons';

/**
 * Custom title-bar window controls (Milestone 9) — replaces the OS-drawn
 * minimize/maximize/close buttons removed by the frameless main window.
 * Lives inside `.app-nav`, which doubles as the draggable title-bar strip;
 * this component (and its buttons) must stay `-webkit-app-region: no-drag`
 * so it remains clickable — see `.window-controls` in styles.css.
 */
export function WindowControls(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    api.windowControls.isMaximized().then((value) => {
      if (isMounted) {
        setIsMaximized(value);
      }
    });

    const unsubscribe = api.windowControls.onMaximizedChange((value) => {
      setIsMaximized(value);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleMinimize = (): void => {
    api.windowControls.minimize();
  };

  const handleToggleMaximize = async (): Promise<void> => {
    const result = await api.windowControls.toggleMaximize();
    setIsMaximized(result.isMaximized);
  };

  const handleClose = (): void => {
    api.windowControls.close();
  };

  return (
    <span
      className="window-controls"
      onDoubleClick={(event) => {
        // Keep a double-click landing on the button group from bubbling up
        // to the title bar's own double-click-to-maximize handler.
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        className="window-controls-btn"
        onClick={handleMinimize}
        aria-label="Minimize window"
      >
        <IconWindowMinimize />
      </button>
      <button
        type="button"
        className="window-controls-btn"
        onClick={() => {
          handleToggleMaximize();
        }}
        aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
      >
        {isMaximized ? <IconWindowRestore /> : <IconWindowMaximize />}
      </button>
      <button
        type="button"
        className="window-controls-btn window-controls-btn--close"
        onClick={handleClose}
        aria-label="Close window"
      >
        <IconWindowClose />
      </button>
    </span>
  );
}
