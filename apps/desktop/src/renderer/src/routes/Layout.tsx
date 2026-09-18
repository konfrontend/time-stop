import { Link, Outlet } from '@tanstack/react-router';
import Cog from '~icons/streamline-ultimate-color/cog';
import LayersStacked from '~icons/streamline-ultimate-color/layers-stacked';
import { UpdateNotice } from '@/components/UpdateNotice';
import { buttonVariants } from '@/components/ui/button';
import { IconButton } from '@/components/ui/IconButton';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';
import { useCacheSync } from '@/hooks/cacheSync';
import { useAlwaysOnTop } from '@/hooks/useShell';
import { useSystemTheme } from '@/hooks/useTheme';

const tabs = [
  { to: '/tracker', label: 'Tracker' },
  { to: '/dashboard', label: 'Dashboard' },
] as const;

export function Layout() {
  useCacheSync();
  useSystemTheme();
  const { alwaysOnTop, toggle } = useAlwaysOnTop();

  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <nav
        className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-1 p-2"
        aria-label="Main"
      >
        <div className="flex justify-start">
          <WorkspaceSwitcher />
        </div>
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              activeProps={{ className: 'bg-accent text-accent-foreground' }}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center justify-end gap-1">
          <IconButton label="Always on top" aria-pressed={alwaysOnTop} onClick={toggle}>
            <LayersStacked />
          </IconButton>
          <IconButton
            asChild
            label="Settings"
            className="data-[status=active]:bg-accent dark:data-[status=active]:bg-accent"
          >
            <Link to="/settings">
              <Cog />
            </Link>
          </IconButton>
        </div>
      </nav>
      <UpdateNotice />
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
