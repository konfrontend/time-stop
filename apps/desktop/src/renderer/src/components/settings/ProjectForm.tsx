import { useId, useState } from 'react';
import Calendar1 from '~icons/streamline-ultimate-color/calendar-1';
import GoldBars from '~icons/streamline-ultimate-color/gold-bars';
import GaugeDashboard from '~icons/streamline-ultimate-color/gauge-dashboard';
import { limitsLabel } from '@app/domain';
import type { Client, Project, Workspace } from '@app/domain';
import { Aspect } from '@/components/ui/Aspect';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { ConfirmPopover } from '@/components/ui/ConfirmPopover';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { DangerPopover } from '@/components/ui/DangerPopover';
import { Popover, PopoverAnchor } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextField } from '@/components/ui/TextField';
import {
  groupInputProps,
  issuesOf,
  trimmedEquals,
  textInputProps,
  useAutoApply,
  useEditedEntity,
} from '@/hooks/useAutoApply';
import type { Issue } from '@/hooks/useAutoApply';
import {
  useArchiveProject,
  useCreateProject,
  useDeleteProject,
  useUnarchiveProject,
  useUpdateProject,
} from '@/hooks/useProjects';
import { recordsWarning } from '@/lib/format';
import { messageOf } from '@/lib/messageOf';
import { randomColor } from '@/lib/colors';
import { projectFormSchema, projectFormValues, toProjectFields } from '@/lib/projectForm';
import type { ProjectFormValues } from '@/lib/projectForm';
import { NONE, fromSelectValue, toSelectValue } from '@/lib/selectValue';

interface ProjectFormProps {
  workspace: Workspace;
  workspaces: Workspace[];
  clients: Client[];
  // Absent when creating.
  initial?: Project | undefined;
  onClose: () => void;
}

const shortDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

type Limits = Pick<ProjectFormValues, 'limitMin' | 'limitMax' | 'limitPeriod'>;
type Dates = Pick<ProjectFormValues, 'startDate' | 'endDate'>;

function limitsSummary({ limitMin, limitMax, limitPeriod }: Limits): string | null {
  return limitsLabel(limitMin.trim() || null, limitMax.trim() || null, limitPeriod || null);
}

function datesSummary({ startDate, endDate }: Dates): string | null {
  if (!startDate && !endDate) return null;
  return `${startDate ? shortDate(startDate) : '…'} – ${endDate ? shortDate(endDate) : '…'}`;
}

const pick = <K extends keyof ProjectFormValues>(values: ProjectFormValues, keys: readonly K[]) =>
  Object.fromEntries(keys.map((key) => [key, values[key]])) as Pick<ProjectFormValues, K>;

// Cross-field rules report on one field of a group, so the whole Project is validated.
const issuesIn = (values: ProjectFormValues, keys: readonly (keyof ProjectFormValues)[]): Issue[] =>
  issuesOf(projectFormSchema, values).filter((issue) =>
    keys.includes(issue.path?.[0] as keyof ProjectFormValues),
  );

const sameFields = (a: ProjectFormValues, b: ProjectFormValues) =>
  JSON.stringify(toProjectFields(a)) === JSON.stringify(toProjectFields(b));

const LIMITS = ['limitMin', 'limitMax', 'limitPeriod'] as const;
const DATES = ['startDate', 'endDate'] as const;

/**
 * Auto-apply editor of a Project; a non-empty Name creates it. Name, Workspace and Client up
 * front; Rate, Limits and Dates folded behind Aspects.
 */
export function ProjectForm({
  workspace,
  workspaces,
  clients,
  initial,
  onClose,
}: ProjectFormProps) {
  const id = useId();
  const create = useCreateProject();
  const update = useUpdateProject();
  const archive = useArchiveProject();
  const unarchive = useUnarchiveProject();
  const remove = useDeleteProject();
  const { entity: project, apply } = useEditedEntity(initial);
  // Session-only: the color a Project created here starts with, held so it does not re-roll.
  const [picked] = useState(randomColor);
  const saved = projectFormValues(project, picked);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [moveFailure, setMoveFailure] = useState<string | null>(null);
  const target = workspaces.find((w) => w.id === moveTo);

  const save = (patch: Partial<ProjectFormValues>) =>
    apply((current) =>
      current
        ? update.mutateAsync({
            id: current.id,
            workspaceId: current.workspaceId,
            ...toProjectFields({ ...projectFormValues(current), ...patch }),
          })
        : create.mutateAsync({
            workspaceId: workspace.id,
            ...toProjectFields({ ...projectFormValues(undefined, picked), ...patch }),
          }),
    );

  const field = <K extends keyof ProjectFormValues>(key: K) => ({
    saved: saved[key],
    validate: (draft: ProjectFormValues[K]) => issuesIn({ ...saved, [key]: draft }, [key]),
    save: (draft: ProjectFormValues[K]) => save({ [key]: draft }),
    equals: (a: ProjectFormValues[K], b: ProjectFormValues[K]) =>
      sameFields({ ...saved, [key]: a }, { ...saved, [key]: b }),
  });

  const name = useAutoApply({ ...field('name'), equals: trimmedEquals });
  const color = useAutoApply(field('color'));
  const clientId = useAutoApply(field('clientId'));
  const rate = useAutoApply(field('rate'));
  const group = <K extends keyof ProjectFormValues>(keys: readonly K[]) => ({
    saved: pick(saved, keys),
    validate: (draft: Pick<ProjectFormValues, K>) => issuesIn({ ...saved, ...draft }, keys),
    save: (draft: Pick<ProjectFormValues, K>) => save(draft),
    equals: (a: Pick<ProjectFormValues, K>, b: Pick<ProjectFormValues, K>) =>
      sameFields({ ...saved, ...a }, { ...saved, ...b }),
  });
  const limits = useAutoApply(group(LIMITS));
  const dates = useAutoApply(group(DATES));

  // Typing a bound without a Period picks the week, so the Limits are usable as entered.
  const boundProps = (key: 'limitMin' | 'limitMax') => {
    const props = groupInputProps(limits, key);
    return {
      ...props,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        limits.setDraft({
          ...limits.draft,
          [key]: value,
          limitPeriod:
            value.trim() && !limits.draft.limitPeriod ? 'week' : limits.draft.limitPeriod,
        });
      },
      // Reverting the last typed bound also drops the week it picked.
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        const { saved, draft } = limits;
        const reverted = { ...draft, [key]: saved[key] };
        if (!reverted.limitMin.trim() && !reverted.limitMax.trim()) {
          reverted.limitPeriod = saved.limitPeriod;
        }
        limits.revert(key);
        limits.setDraft(reverted);
      },
    };
  };

  const periodProps = groupInputProps(limits, 'limitPeriod');

  const cancelMove = () => {
    setMoveTo(null);
    setMoveFailure(null);
  };

  const missing = !project;
  const rootIssues = (issues: Issue[]) => issues.filter((issue) => !issue.path?.length);

  return (
    <div className="flex flex-col gap-3">
      <FieldGroup className="gap-3">
        <TextField
          label="Name"
          autoFocus
          {...textInputProps(name)}
          trailing={
            <ColorPicker
              value={color.draft}
              onChange={color.setDraft}
              onCommit={(next) => void color.commit(next)}
              disabled={missing}
            />
          }
        />
        <Field>
          <FieldLabel htmlFor={`${id}-workspace`}>Workspace</FieldLabel>
          <Popover open={moveTo !== null} onOpenChange={(open) => !open && cancelMove()}>
            <Select
              value={project?.workspaceId ?? workspace.id}
              onValueChange={(value) =>
                project && value !== project.workspaceId && setMoveTo(value)
              }
              disabled={missing}
            >
              <PopoverAnchor asChild>
                <SelectTrigger id={`${id}-workspace`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
              </PopoverAnchor>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {moveTo !== null && (
              <ConfirmPopover
                align="start"
                data-slot="move-confirm"
                note={`Its Records move to ${target?.name}; the Client stays behind.`}
                onFocusOutside={(event) => event.preventDefault()}
                confirm={{
                  label: 'Move',
                  onConfirm: () => {
                    // A move drops the Client: it stays in the old Workspace.
                    void apply((current) =>
                      update.mutateAsync({
                        id: current!.id,
                        ...toProjectFields(projectFormValues(current)),
                        workspaceId: moveTo,
                        clientId: null,
                      }),
                    ).then(onClose, (error: unknown) => setMoveFailure(messageOf(error)));
                  },
                }}
                failures={moveFailure ? [moveFailure] : []}
                onCancel={cancelMove}
              />
            )}
          </Popover>
        </Field>
        <Field data-invalid={clientId.issues.length > 0 || undefined}>
          <FieldLabel htmlFor={`${id}-client`}>Client</FieldLabel>
          <Select
            value={toSelectValue(clientId.draft)}
            onValueChange={(value) => void clientId.commit(fromSelectValue(value))}
            disabled={missing}
          >
            <SelectTrigger id={`${id}-client`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No Client</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={clientId.issues} />
        </Field>
      </FieldGroup>
      <div className="flex flex-wrap gap-1">
        <Aspect
          icon={<GoldBars className="size-5.5" />}
          label="Rate"
          summary={rate.draft.trim() ? `${rate.draft.trim()}/h` : null}
          invalid={rate.issues.length > 0}
          disabled={missing}
          onClose={() => void rate.commit()}
        >
          <TextField
            label="Rate per hour"
            inputMode="decimal"
            placeholder="Unpaid"
            className="w-32"
            autoFocus
            {...textInputProps(rate)}
          />
        </Aspect>
        <Aspect
          icon={<GaugeDashboard />}
          label="Limits"
          summary={limitsSummary(limits.draft)}
          invalid={limits.issues.length > 0}
          disabled={missing}
          onClose={() => void limits.commit()}
        >
          <div className="grid grid-cols-2 gap-2">
            <TextField
              label="Min hours"
              inputMode="decimal"
              autoFocus
              {...boundProps('limitMin')}
            />
            <TextField label="Max hours" inputMode="decimal" {...boundProps('limitMax')} />
          </div>
          <Field data-invalid={periodProps.errors.length > 0 || undefined}>
            <FieldLabel htmlFor={`${id}-period`}>Per</FieldLabel>
            <Select
              value={toSelectValue(limits.draft.limitPeriod)}
              onValueChange={(value) =>
                limits.setDraft({
                  ...limits.draft,
                  limitPeriod: fromSelectValue(value) as Limits['limitPeriod'],
                })
              }
            >
              <SelectTrigger
                id={`${id}-period`}
                className="w-full"
                data-dirty={periodProps['data-dirty']}
                onKeyDown={periodProps.onKeyDown}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
            <FieldError errors={periodProps.errors} />
          </Field>
          <FieldError errors={rootIssues(limits.issues)} />
        </Aspect>
        <Aspect
          icon={<Calendar1 />}
          label="Dates"
          summary={datesSummary(dates.draft)}
          invalid={dates.issues.length > 0}
          disabled={missing}
          onClose={() => void dates.commit()}
        >
          <div className="grid grid-cols-2 gap-2">
            <TextField
              label="Start"
              type="date"
              autoFocus
              {...groupInputProps(dates, 'startDate')}
            />
            <TextField label="End" type="date" {...groupInputProps(dates, 'endDate')} />
          </div>
          <FieldError errors={rootIssues(dates.issues)} />
        </Aspect>
      </div>
      {project && (
        <div className="flex justify-end">
          <DangerPopover
            danger={{
              archive: project.archived
                ? {
                    label: 'Unarchive',
                    note: 'Back in the pickers.',
                    run: async () => {
                      await unarchive.mutateAsync({ id: project.id });
                      onClose();
                    },
                  }
                : {
                    label: 'Archive',
                    note: 'Hidden from pickers; its Records stay.',
                    run: async () => {
                      await archive.mutateAsync({ id: project.id });
                      onClose();
                    },
                  },
              describe: async () =>
                recordsWarning(
                  await window.api.record.count({ projectId: project.id }),
                  'This Project',
                  'They keep their Workspace and lose the Project.',
                ),
              onDelete: async () => {
                await remove.mutateAsync({ id: project.id });
                onClose();
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
