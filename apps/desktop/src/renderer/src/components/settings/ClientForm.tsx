import { useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { updateClientInputSchema } from '@time-stop/domain';
import type { Client } from '@time-stop/domain';
import { FieldGroup } from '@/components/ui/field';
import { FormFooter } from '@/components/ui/FormFooter';
import type { SaveAlert } from '@/components/ui/FormFooter';
import { TextField } from '@/components/ui/TextField';
import { useCreateClient, useDeleteClient, useUpdateClient } from '@/hooks/useClients';
import { messageOf } from '@/lib/messageOf';

const formSchema = updateClientInputSchema.pick({ name: true });

interface ClientFormProps {
  workspaceId: string;
  initial?: Client | undefined;
  onClose: () => void;
}

export function ClientForm({ workspaceId, initial, onClose }: ClientFormProps) {
  const [alert, setAlert] = useState<SaveAlert | null>(null);
  const create = useCreateClient();
  const update = useUpdateClient();
  const remove = useDeleteClient();

  const form = useForm({
    defaultValues: { name: initial?.name ?? '' },
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      const { name } = formSchema.parse(value);
      try {
        if (initial) await update.mutateAsync({ id: initial.id, name });
        else await create.mutateAsync({ workspaceId, name });
        onClose();
      } catch (error) {
        setAlert({ failures: [messageOf(error)] });
      }
    },
  });
  const submitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup className="gap-3">
        <form.Field name="name">
          {(field) => (
            <TextField
              label="Name"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              errors={field.state.meta.errors}
              autoFocus
            />
          )}
        </form.Field>
      </FieldGroup>
      <FormFooter
        submitting={submitting}
        onCancel={onClose}
        alert={alert}
        onAlertClose={() => setAlert(null)}
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
