import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUpdate } from '@/hooks/useRelease';

export function UpdateNotice() {
  const update = useUpdate();
  const [dismissed, setDismissed] = useState(false);
  if (!update.data || dismissed) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b bg-muted px-3 py-1 text-sm"
      data-slot="update-notice"
    >
      <p className="flex flex-1 gap-3">
        Time Stop {update.data.version} is available
        {/* target=_blank reaches the window's open handler, which hands the URL to the OS browser. */}
        <a
          href={update.data.url}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          Download
        </a>
      </p>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Dismiss"
        className="size-6"
        onClick={() => setDismissed(true)}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
