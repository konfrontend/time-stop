import { useEffect, useState } from 'react';
export function useAlwaysOnTop(): { alwaysOnTop: boolean; toggle: () => void } {
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);

  useEffect(() => {
    void window.desktop.shell.isAlwaysOnTop().then(setAlwaysOnTop);
  }, []);

  return {
    alwaysOnTop,
    toggle: () => {
      const next = !alwaysOnTop;
      setAlwaysOnTop(next);
      void window.desktop.shell.setAlwaysOnTop(next);
    },
  };
}
