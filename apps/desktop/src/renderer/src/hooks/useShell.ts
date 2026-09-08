import { useEffect, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { windowModeFor } from '@/lib/windowMode';

/** Keeps the window sized for the open tab. */
export function useWindowMode(): void {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    void window.shell.setWindowMode(windowModeFor(pathname));
  }, [pathname]);
}

export function useAlwaysOnTop(): { alwaysOnTop: boolean; toggle: () => void } {
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);

  useEffect(() => {
    void window.shell.isAlwaysOnTop().then(setAlwaysOnTop);
  }, []);

  return {
    alwaysOnTop,
    toggle: () => {
      const next = !alwaysOnTop;
      setAlwaysOnTop(next);
      void window.shell.setAlwaysOnTop(next);
    },
  };
}
