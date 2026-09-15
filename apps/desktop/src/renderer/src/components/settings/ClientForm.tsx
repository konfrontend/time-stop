import { updateClientInputSchema } from '@time-stop/domain';
import type { Client } from '@time-stop/domain';
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
import { useCreateClient, useDeleteClient, useUpdateClient } from '@/hooks/useClients';

interface ClientFormProps {
  workspaceId: string;
  // Absent when creating.
  initial?: Client | undefined;
  onClose: () => void;
}

/** Auto-apply editor of a Client; a non-empty Name creates it. */
export function ClientForm({ workspaceId, initial, onClose }: ClientFormProps) {
  const create = useCreateClient();
  const update = useUpdateClient();
  const remove = useDeleteClient();
  const { entity: client, apply } = useEditedEntity(initial);

  const name = useAutoApply({
    saved: client?.name ?? '',
    equals: trimmedEquals,
    validate: (draft) => issuesOf(updateClientInputSchema.shape.name, draft),
    save: (draft) =>
      apply((current) =>
        current
          ? update.mutateAsync({ id: current.id, name: draft.trim() })
          : create.mutateAsync({ workspaceId, name: draft.trim() }),
      ),
  });

  return (
    <div className="flex flex-col gap-3">
      <FieldGroup className="gap-3">
        <TextField label="Name" autoFocus {...textInputProps(name)} />
      </FieldGroup>
      {client && (
        <div className="flex justify-end">
          <DangerPopover
            danger={{
              describe: async () => 'Its Projects stay and lose the Client.',
              onDelete: async () => {
                await remove.mutateAsync({ id: client.id });
                onClose();
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
