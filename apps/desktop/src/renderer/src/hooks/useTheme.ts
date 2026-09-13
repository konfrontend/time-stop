import { useEffect } from 'react';

const apply = (dark: boolean) => document.documentElement.classList.toggle('dark', dark);

/** Mirrors the OS appearance onto the root element, where the `dark` variant reads it. */
export function useSystemTheme(): void {
  useEffect(() => {
    void window.desktop.theme.isDark().then(apply);
    return window.desktop.theme.onChanged(apply);
  }, []);
}
