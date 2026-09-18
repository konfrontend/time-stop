import { useQuery } from '@tanstack/react-query';
import { keys } from './cacheSync';

export function useVersion() {
  return useQuery({ queryKey: keys.version, queryFn: () => window.desktop.release.getVersion() });
}

/** The main process checks once per launch; asking again returns that same answer. */
export function useUpdate() {
  return useQuery({
    queryKey: keys.update,
    queryFn: () => window.desktop.release.checkForUpdate(),
  });
}
