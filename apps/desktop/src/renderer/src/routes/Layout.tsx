import { Link, Outlet } from '@tanstack/react-router';
import { Pin } from 'lucide-react';
import { UpdateNotice } from '@/components/UpdateNotice';
import { Button, buttonVariants } from '@/components/ui/button';
import { useAlwaysOnTop, useWindowMode } from '@/hooks/useShell';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/tracker', label: 'Tracker' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/settings', label: 'Settings' },
] as const;

export function Layout() {
  const { alwaysOnTop, toggle } = useAlwaysOnTop();
  useWindowMode();

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <nav className="flex items-center gap-1 border-b p-2" aria-label="Main">
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'flex-1')}
            activeProps={{ className: 'bg-accent text-accent-foreground' }}
          >
            {tab.label}
          </Link>
        ))}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Always on top"
          aria-pressed={alwaysOnTop}
          className={cn('size-8', alwaysOnTop && 'bg-accent text-accent-foreground')}
          onClick={toggle}
        >
          <Pin className={cn('size-4', alwaysOnTop || 'text-muted-foreground')} />
        </Button>
      </nav>
      <UpdateNotice />
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
