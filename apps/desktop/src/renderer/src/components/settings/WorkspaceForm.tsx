import { useState } from 'react';
import GoldBars from '~icons/streamline-ultimate-color/gold-bars';
import { workspaceInputSchema } from '@time-stop/domain';
import type { Workspace, WorkspaceInput } from '@time-stop/domain';
import { Aspect } from '@/components/ui/Aspect';
import { ColorPicker } from '@/components/ui/ColorPicker';
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
import { randomColor } from '@/lib/colors';
import { recordsWarning } from '@/lib/format';

interface WorkspaceFormProps {
  // Absent when creating; the default Workspace cannot be deleted.
  initial?: Workspace | undefined;
  isDefault?: boolean | undefined;
  // False where the Name is edited in place elsewhere, as the Preferences tab edits it in its heading.
  showName?: boolean;
  onClose: () => void;
}

/** Auto-apply editor of a Workspace; a non-empty Name creates it. */
export function WorkspaceForm({
  initial,
  isDefault,
  showName = true,
  onClose,
}: WorkspaceFormProps) {
  const create = useCreateWorkspace();
  const update = useUpdateWorkspace();
  const remove = useDeleteWorkspace();
  const { entity: workspace, apply } = useEditedEntity(initial);
  // Session-only: the color a Workspace created here starts with, held so it does not re-roll.
  const [picked] = useState(randomColor);

  // An update carries the whole Workspace, so each field saves its own value over the current one.
  const saveOver = (current: Workspace, patch: Partial<WorkspaceInput>) =>
    update.mutateAsync({
      id: current.id,
      name: current.name,
      currency: current.currency,
      color: current.color,
      ...patch,
    });

  // Until the Name creates the Workspace the color is a draft only; the create carries it along.
  const color = useAutoApply({
    saved: workspace?.color ?? picked,
    validate: (draft) => issuesOf(workspaceInputSchema.shape.color, draft),
    save: async (draft) => {
      if (!workspace) return;
      await apply((current) => saveOver(current!, { color: draft }));
    },
  });

  const name = useAutoApply({
    saved: workspace?.name ?? '',
    equals: trimmedEquals,
    validate: (draft) => issuesOf(workspaceInputSchema.shape.name, draft),
    save: (draft) =>
      apply((current) =>
        current
          ? saveOver(current, { name: draft.trim() })
          : create.mutateAsync({ name: draft.trim(), currency: null, color: color.draft }),
      ),
  });

  const currency = useAutoApply({
    saved: workspace?.currency ?? '',
    equals: trimmedEquals,
    validate: (draft) => issuesOf(workspaceInputSchema.shape.currency, draft),
    save: (draft) => apply((current) => saveOver(current!, { currency: draft.trim() || null })),
  });

  return (
    <div className="flex flex-col gap-3">
      {showName && (
        <FieldGroup className="gap-3">
          <TextField
            label="Name"
            autoFocus
            {...textInputProps(name)}
            trailing={
              <ColorPicker
                label="Workspace Color"
                value={color.draft}
                onChange={color.setDraft}
                onCommit={(next) => void color.commit(next)}
              />
            }
          />
        </FieldGroup>
      )}
      <div className="flex">
        <Aspect
          icon={<GoldBars className="size-5.5" />}
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
      {workspace && !isDefault && (
        <div className="flex justify-end">
          <DangerPopover
            withLabel
            danger={{
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
