import OfficeDrawer from '~icons/streamline-ultimate-color/office-drawer';
import PrintText from '~icons/streamline-ultimate-color/print-text';
import { formatIsoDate, parseIsoDate, shiftPeriod } from '@time-stop/domain';
import type { Period, Project } from '@time-stop/domain';
import { ProjectCombobox } from '@/components/ProjectCombobox';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { DashboardSelection } from '@/lib/dashboardSearch';
import { RangeNav } from './RangeNav';

interface DashboardToolbarProps {
  selection: DashboardSelection;
  projects: Project[];
  // True while a mutation or an Export is in flight.
  busy: boolean;
  onProject: (projectId: string | null) => void;
  onPeriod: (period: Period) => void;
  onAnchor: (anchor: string) => void;
  onExport: () => void;
}

/** What the view is scoped to — one Project and a Range — and the Export of that scope. */
export function DashboardToolbar({
  selection,
  projects,
  busy,
  onProject,
  onPeriod,
  onAnchor,
  onExport,
}: DashboardToolbarProps) {
  return (
    <div className="flex items-center gap-1 px-2 pt-1.5" data-slot="dashboard-toolbar">
      <ProjectCombobox
        icon={<OfficeDrawer />}
        workspaceId={selection.workspace}
        projects={projects}
        value={selection.project}
        emptyLabel="All Projects"
        creatable={false}
        showArchived
        align="start"
        className="max-w-52"
        onChange={onProject}
      />
      <div className="ml-auto flex items-center gap-1">
        <RangeNav
          period={selection.period}
          anchor={selection.anchor}
          from={selection.from}
          to={selection.to}
          onStep={(steps) =>
            onAnchor(
              formatIsoDate(shiftPeriod(selection.period, parseIsoDate(selection.anchor), steps)),
            )
          }
          onPeriod={onPeriod}
          onAnchor={onAnchor}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost-icon"
              size="icon-sm"
              aria-label="Export"
              data-slot="export"
              disabled={busy}
              onClick={onExport}
            >
              <PrintText />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
