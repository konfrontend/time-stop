import { Link, Outlet } from '@tanstack/react-router';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/tracker', label: 'Tracker' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/settings', label: 'Settings' },
] as const;

export function Layout() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <nav className="flex gap-1 border-b p-2" aria-label="Main">
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
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
