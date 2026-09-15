import { Link, Outlet } from '@tanstack/react-router';
import { UpdateNotice } from '@/components/UpdateNotice';
import { buttonVariants } from '@/components/ui/button';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';
import { useSystemTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/tracker', label: 'Tracker' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/settings', label: 'Settings' },
] as const;

export function Layout() {
  useSystemTheme();

  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <nav className="flex shrink-0 items-center gap-1 p-2" aria-label="Main">
        <WorkspaceSwitcher />
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
      </nav>
      <UpdateNotice />
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
