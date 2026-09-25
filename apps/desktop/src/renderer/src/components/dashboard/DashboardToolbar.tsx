import OfficeDrawer from '~icons/streamline-ultimate-color/office-drawer';
import PrintText from '~icons/streamline-ultimate-color/print-text';
import { formatIsoDate, parseIsoDate, shiftPeriod } from '@app/domain';
import type { Period, Project } from '@app/domain';
import { ProjectCombobox } from '@/components/ProjectCombobox';
import { IconButton } from '@/components/ui/IconButton';
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
    <div
      className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 px-2 pt-1.5"
      data-slot="dashboard-toolbar"
    >
      <div className="flex min-w-0 max-w-52">
        <ProjectCombobox
          icon={<OfficeDrawer />}
          workspaceId={selection.workspace}
          projects={projects}
          value={selection.project}
          emptyLabel="All Projects"
          creatable={false}
          showArchived
          align="start"
          className="max-w-full"
          onChange={onProject}
        />
      </div>
      <RangeNav
        period={selection.period}
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
      <div className="flex justify-end">
        <IconButton label="Export" data-slot="export" disabled={busy} onClick={onExport}>
          <PrintText />
        </IconButton>
      </div>
    </div>
  );
}
