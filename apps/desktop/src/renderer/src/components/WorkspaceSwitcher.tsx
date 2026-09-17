import { Link } from '@tanstack/react-router';
import Cog from '~icons/streamline-ultimate-color/cog';
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
import { contrastOn } from '@/lib/colors';

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
        <Avatar className="size-9">
          <AvatarFallback
            className="text-xs font-semibold"
            style={
              current
                ? { backgroundColor: current.color, color: contrastOn(current.color) }
                : undefined
            }
          >
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
              <span
                data-slot="workspace-dot"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: workspace.color }}
                aria-hidden
              />
              {workspace.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings/workspaces" search={{ workspace: current?.id }}>
            <Cog />
            Manage Workspaces…
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
