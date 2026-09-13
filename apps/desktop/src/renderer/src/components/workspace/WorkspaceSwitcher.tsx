import { Link } from '@tanstack/react-router';
import { Settings2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useContextQuery, useSetContext } from '@/hooks/useContext';
import { useWorkspaces } from '@/hooks/useWorkspaces';

const initials = (name: string) => name.trim().slice(0, 2).toUpperCase() || '··';

/** Sets the Context's Workspace from any page; the Project is left behind, it belonged to the old one. */
export function WorkspaceSwitcher() {
  const context = useContextQuery();
  const workspaces = useWorkspaces();
  const setContext = useSetContext();
  const current = workspaces.data?.find(({ id }) => id === context.data?.workspaceId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Switch Workspace"
        title={current?.name}
        disabled={!current}
        data-slot="workspace-switcher"
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <Avatar>
          <AvatarFallback className="text-xs font-semibold">
            {current ? initials(current.name) : '…'}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuLabel>Workspace</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={current?.id ?? ''}
          onValueChange={(workspaceId) => setContext.mutate({ workspaceId, projectId: null })}
        >
          {workspaces.data?.map((workspace) => (
            <DropdownMenuRadioItem key={workspace.id} value={workspace.id}>
              {workspace.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings2 />
            Manage Workspaces…
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
