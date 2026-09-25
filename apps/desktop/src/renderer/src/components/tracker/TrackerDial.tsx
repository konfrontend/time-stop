import { useRef } from 'react';
import DiagramDashCircle from '~icons/streamline-ultimate-color/diagram-dash-circle';
import OfficeDrawer from '~icons/streamline-ultimate-color/office-drawer';
import type { Project, Record, Workspace } from '@app/domain';
import { ProjectPicker } from '@/components/ProjectPicker';
import { NameField } from '@/components/tracker/NameField';
import { DIAL_PX, TimerDial } from '@/components/tracker/TimerDial';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { hoursMinutes, projectAbbreviation, UNTITLED_RECORD } from '@/lib/format';

/** The `icon` Button's own size; the ring places its controls by it. */
const RING_BUTTON_PX = 36;
/** Air between a ring button and the value it prints outside the dial. */
const VALUE_GAP_PX = 6;

const ringButton = 'absolute -translate-1/2 rounded-full';

interface TrackerDialProps {
  workspace: Workspace | null;
  projects: Project[] | undefined;
  project: Project | null;
  projectId: string | null;
  timer: Record | null;
  elapsed: string;
  elapsedMs: number;
  standby: 'start' | 'continue';
  // What the Name shows: the Timer's Name, or the standby draft.
  name: string;
  onDraftChange: (draft: string) => void;
  onSubmit: (name: string) => void;
  onClear: () => void;
  onPickProject: (projectId: string | null) => void;
  // The remembered activity's total today, printed outside Clear.
  activityTodayMs: number;
  pending: boolean;
  onToggle: () => void;
}

/**
 * The dial with the controls it carries: the Name over the face, the Project on the upper left of
 * the ring and Clear on its lower right. A ring control is a round button on the ring that prints
 * its value outside the dial.
 */
export function TrackerDial({
  workspace,
  projects,
  project,
  projectId,
  timer,
  elapsed,
  elapsedMs,
  standby,
  name,
  onDraftChange,
  onSubmit,
  onClear,
  onPickProject,
  activityTodayMs,
  pending,
  onToggle,
}: TrackerDialProps) {
  const nameInput = useRef<HTMLInputElement>(null);
  const clearable = !timer && (standby === 'continue' || name !== '');

  return (
    <div className="relative shrink-0 self-center" style={{ width: DIAL_PX, height: DIAL_PX }}>
      <TimerDial
        elapsed={elapsed}
        elapsedMs={elapsedMs}
        running={timer !== null}
        standby={standby}
        name={name.trim()}
        pending={pending}
        onToggle={onToggle}
      />
      {/* Over the face, not in it: the dial is one button and cannot hold an input. */}
      <div className="absolute bottom-[calc(50%+34px)] left-1/2 w-48 -translate-x-1/2">
        <NameField
          key={timer?.id ?? 'standby'}
          ref={nameInput}
          timer={timer}
          projectId={projectId}
          draft={name}
          onDraftChange={onDraftChange}
          onSubmit={onSubmit}
          placeholder={standby === 'continue' && !timer ? UNTITLED_RECORD : 'Working on…'}
        />
      </div>
      {workspace && projects && (
        <ProjectControl
          workspace={workspace}
          projects={projects}
          project={project}
          projectId={projectId}
          onPick={onPickProject}
        />
      )}
      {clearable && (
        <ClearControl
          todayMs={standby === 'continue' ? activityTodayMs : null}
          onClear={() => {
            onClear();
            nameInput.current?.focus();
          }}
        />
      )}
    </div>
  );
}

/** Where on the ring a control sits; its printed value hangs from the same height outside. */
function ringPoint(degrees: number) {
  const r = DIAL_PX / 2;
  const angle = degrees * (Math.PI / 180);
  return { left: r + r * Math.cos(angle), top: r + r * Math.sin(angle) };
}

function ProjectControl({
  workspace,
  projects,
  project,
  projectId,
  onPick,
}: {
  workspace: Workspace;
  projects: Project[];
  project: Project | null;
  projectId: string | null;
  onPick: (projectId: string | null) => void;
}) {
  const point = ringPoint(-135);
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-slot="dial-project-value"
            style={{
              right: DIAL_PX - point.left + RING_BUTTON_PX / 2 + VALUE_GAP_PX,
              top: point.top,
            }}
            className="absolute flex -translate-y-1/2 items-center gap-1.5 text-xs font-medium whitespace-nowrap"
          >
            {project ? (
              <>
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: project.color }}
                  aria-hidden
                />
                {projectAbbreviation(project.name)}
              </>
            ) : (
              <span className="font-normal text-muted-foreground italic">none</span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left">{project ? project.name : 'No Project'}</TooltipContent>
      </Tooltip>
      <ProjectPicker
        workspaceId={workspace.id}
        projects={projects}
        value={projectId}
        align="start"
        onChange={onPick}
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Project: ${project ? project.name : 'none'}`}
          data-slot="dial-project"
          style={point}
          className={ringButton}
        >
          <OfficeDrawer className="size-5" />
        </Button>
      </ProjectPicker>
    </>
  );
}

/** Lets the remembered Record go and hands the keyboard to the Name; the Project stays. */
function ClearControl({ todayMs, onClear }: { todayMs: number | null; onClear: () => void }) {
  const point = ringPoint(45);
  return (
    <>
      <IconButton
        variant="outline"
        size="icon"
        label="Clear"
        tooltip="Clear, start something new"
        side="bottom"
        data-slot="dial-clear"
        style={point}
        className={ringButton}
        onClick={onClear}
      >
        <DiagramDashCircle className="size-5.5" />
      </IconButton>
      {todayMs !== null && (
        <span
          data-slot="dial-clear-value"
          style={{ left: point.left + RING_BUTTON_PX / 2 + VALUE_GAP_PX, top: point.top }}
          className="absolute -translate-y-1/2 text-xs whitespace-nowrap text-muted-foreground tabular-nums"
        >
          {todayMs > 0 ? `${hoursMinutes(todayMs)} today` : 'not today'}
        </span>
      )}
    </>
  );
}
