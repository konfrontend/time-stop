import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const tabs = [
  { value: 'general', label: 'General' },
  { value: 'workspaces', label: 'Workspaces' },
] as const;

/** Two tabs, the open one in the URL; each tab is a child route scrolling on its own. */
export function Settings() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const current = tabs.find((tab) => pathname.startsWith(`/settings/${tab.value}`))?.value;

  return (
    <Tabs
      value={current ?? 'general'}
      onValueChange={(value) => void navigate({ to: `/settings/${value}` })}
      className="flex min-h-0 flex-1 flex-col gap-0"
      data-slot="settings"
    >
      <div className="px-4 pt-2">
        <TabsList className="w-full">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </div>
    </Tabs>
  );
}
