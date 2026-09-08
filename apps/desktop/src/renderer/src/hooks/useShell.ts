import { useEffect, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';

/** Keeps the window sized for the open tab: the Tracker is compact, the other tabs expand it. */
export function useWindowMode(): void {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    const tracker = pathname === '/' || pathname.startsWith('/tracker');
    void window.shell.setWindowMode(tracker ? 'compact' : 'expanded');
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
