import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { keys } from './cacheSync';

/** Whether the Tracker keeps its Recent Records list open; open until the Owner closes it. */
export function useRecentRecordsOpen() {
  return useQuery({
    queryKey: keys.recentRecordsOpen,
    queryFn: () => window.desktop.preferences.isRecentRecordsOpen(),
  });
}

export function useSetRecentRecordsOpen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (open: boolean) => window.desktop.preferences.setRecentRecordsOpen(open),
    onSuccess: (open) => queryClient.setQueryData(keys.recentRecordsOpen, open),
  });
}
