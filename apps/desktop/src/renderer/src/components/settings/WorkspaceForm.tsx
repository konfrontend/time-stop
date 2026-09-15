import DiamondShine from '~icons/streamline-ultimate-color/diamond-shine';
import { workspaceInputSchema } from '@time-stop/domain';
import type { Workspace } from '@time-stop/domain';
import { Aspect } from '@/components/ui/Aspect';
import { FieldGroup } from '@/components/ui/field';
import { DangerPopover } from '@/components/ui/DangerPopover';
import { TextField } from '@/components/ui/TextField';
import {
  issuesOf,
  trimmedEquals,
  textInputProps,
  useAutoApply,
  useEditedEntity,
} from '@/hooks/useAutoApply';
import { useCreateWorkspace, useDeleteWorkspace, useUpdateWorkspace } from '@/hooks/useWorkspaces';
import { recordsWarning } from '@/lib/format';

interface WorkspaceFormProps {
  // Absent when creating; the default Workspace cannot be deleted.
  initial?: Workspace | undefined;
  isDefault?: boolean | undefined;
  onClose: () => void;
}

/** Auto-apply editor of a Workspace; a non-empty Name creates it. */
export function WorkspaceForm({ initial, isDefault, onClose }: WorkspaceFormProps) {
  const create = useCreateWorkspace();
  const update = useUpdateWorkspace();
  const remove = useDeleteWorkspace();
  const { entity: workspace, apply } = useEditedEntity(initial);

  const name = useAutoApply({
    saved: workspace?.name ?? '',
    equals: trimmedEquals,
    validate: (draft) => issuesOf(workspaceInputSchema.shape.name, draft),
    save: (draft) =>
      apply((current) =>
        current
          ? update.mutateAsync({ id: current.id, name: draft.trim(), currency: current.currency })
          : create.mutateAsync({ name: draft.trim(), currency: null }),
      ),
  });

  const currency = useAutoApply({
    saved: workspace?.currency ?? '',
    equals: trimmedEquals,
    validate: (draft) => issuesOf(workspaceInputSchema.shape.currency, draft),
    save: (draft) =>
      apply((current) =>
        update.mutateAsync({
          id: current!.id,
          name: current!.name,
          currency: draft.trim() || null,
        }),
      ),
  });

  return (
    <div className="flex flex-col gap-3">
      <FieldGroup className="gap-3">
        <TextField label="Name" autoFocus {...textInputProps(name)} />
      </FieldGroup>
      <div className="flex">
        <Aspect
          icon={<DiamondShine />}
          label="Billable"
          summary={currency.draft.trim().toUpperCase() || null}
          invalid={currency.issues.length > 0}
          disabled={!workspace}
          onClose={() => void currency.commit()}
        >
          <p className="text-xs text-muted-foreground">
            Projects with a Rate are Billable once the Workspace has a Currency.
          </p>
          <TextField
            label="Currency"
            placeholder="EUR, USD, USDT…"
            className="w-32"
            autoFocus
            {...textInputProps(currency)}
          />
        </Aspect>
      </div>
      {workspace && (
        <div className="flex justify-end">
          <DangerPopover
            danger={{
              disabledReason: isDefault ? 'Default Workspace' : undefined,
              describe: async () => {
                const count = await window.timeStop.record.count({ workspaceId: workspace.id });
                return count === 0
                  ? 'This Workspace has no Records. Its Clients and Projects go with it.'
                  : recordsWarning(
                      count,
                      'This Workspace',
                      'Its Clients, Projects and Records go with it.',
                    );
              },
              onDelete: async () => {
                await remove.mutateAsync({ id: workspace.id });
                onClose();
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
