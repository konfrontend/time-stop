import { useState } from 'react';
import { updateClientInputSchema } from '@time-stop/domain';
import type { Client } from '@time-stop/domain';
import { FieldGroup } from '@/components/ui/field';
import { useCreateClient, useDeleteClient, useUpdateClient } from '@/hooks/useClients';
import { fieldErrors } from '@/lib/fieldErrors';
import { messageOf } from '@/lib/messageOf';
import { FormFooter } from './FormFooter';
import { TextField } from './TextField';

const formSchema = updateClientInputSchema.pick({ name: true });

interface ClientFormProps {
  workspaceId: string;
  initial?: Client | undefined;
  onClose: () => void;
}

export function ClientForm({ workspaceId, initial, onClose }: ClientFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [error, setError] = useState<string | undefined>(undefined);
  const [failure, setFailure] = useState<string | null>(null);
  const create = useCreateClient();
  const update = useUpdateClient();
  const remove = useDeleteClient();

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const parsed = formSchema.safeParse({ name });
    if (!parsed.success) return setError(fieldErrors(parsed.error)['name']);
    setError(undefined);
    try {
      if (initial) await update.mutateAsync({ id: initial.id, name: parsed.data.name });
      else await create.mutateAsync({ workspaceId, name: parsed.data.name });
      onClose();
    } catch (caught) {
      setFailure(messageOf(caught));
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
      <FieldGroup className="gap-3">
        <TextField
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={error}
          autoFocus
        />
      </FieldGroup>
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      <FormFooter
        submitting={create.isPending || update.isPending}
        onCancel={onClose}
        danger={
          initial && {
            describe: async () => 'Its Projects stay and lose the Client.',
            onDelete: async () => {
              await remove.mutateAsync({ id: initial.id });
              onClose();
            },
          }
        }
      />
    </form>
  );
}
