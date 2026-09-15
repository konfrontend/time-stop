import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/** `system` follows the OS; `light` and `dark` override it. */
export type ThemeMode = Awaited<ReturnType<Window['desktop']['theme']['getMode']>>;

const apply = (dark: boolean) => document.documentElement.classList.toggle('dark', dark);

/** Mirrors the resolved appearance onto the root element, where the `dark` variant reads it. */
export function useSystemTheme(): void {
  useEffect(() => {
    void window.desktop.theme.isDark().then(apply);
    return window.desktop.theme.onChanged(apply);
  }, []);
}

export const themeModeKey = ['themeMode'] as const;

export function useThemeMode() {
  return useQuery({ queryKey: themeModeKey, queryFn: () => window.desktop.theme.getMode() });
}

export function useSetThemeMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: ThemeMode) => window.desktop.theme.setMode(mode),
    onSuccess: (mode) => queryClient.setQueryData(themeModeKey, mode),
  });
}
