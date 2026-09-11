import { useQuery } from '@tanstack/react-query';

export const versionKey = ['version'] as const;
export const updateKey = ['update'] as const;

export function useVersion() {
  return useQuery({ queryKey: versionKey, queryFn: () => window.desktop.release.getVersion() });
}

/** The main process checks once per launch; asking again returns that same answer. */
export function useUpdate() {
  return useQuery({ queryKey: updateKey, queryFn: () => window.desktop.release.checkForUpdate() });
}
