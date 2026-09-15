import { useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { Gem } from 'lucide-react';
import { z } from 'zod';
import { workspaceInputSchema } from '@time-stop/domain';
import type { Workspace } from '@time-stop/domain';
import { Aspect } from '@/components/ui/Aspect';
import { FieldGroup } from '@/components/ui/field';
import { FormFooter } from '@/components/ui/FormFooter';
import type { SaveAlert } from '@/components/ui/FormFooter';
import { TextField } from '@/components/ui/TextField';
import { useCreateWorkspace, useDeleteWorkspace, useUpdateWorkspace } from '@/hooks/useWorkspaces';
import { recordsWarning } from '@/lib/format';
import { messageOf } from '@/lib/messageOf';

// Same rules as the API on the text the field holds; the API turns an empty Currency into null.
const formSchema = workspaceInputSchema.extend({ currency: z.string().max(20) });

interface WorkspaceFormProps {
  // Absent when creating; the default Workspace cannot be deleted.
  initial?: Workspace | undefined;
  isDefault?: boolean | undefined;
  onClose: () => void;
}

export function WorkspaceForm({ initial, isDefault, onClose }: WorkspaceFormProps) {
  const [alert, setAlert] = useState<SaveAlert | null>(null);
  const create = useCreateWorkspace();
  const update = useUpdateWorkspace();
  const remove = useDeleteWorkspace();

  const form = useForm({
    defaultValues: { name: initial?.name ?? '', currency: initial?.currency ?? '' },
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      const input = workspaceInputSchema.parse(value);
      try {
        if (initial) await update.mutateAsync({ id: initial.id, ...input });
        else await create.mutateAsync(input);
        onClose();
      } catch (error) {
        setAlert({ failures: [messageOf(error)] });
      }
    },
  });
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  const currency = useStore(form.store, (state) => state.values.currency.trim().toUpperCase());

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
      <div className="flex">
        <form.Field name="currency">
          {(field) => (
            <Aspect
              icon={<Gem />}
              label="Billable"
              summary={currency || null}
              invalid={field.state.meta.errors.length > 0}
            >
              <p className="text-xs text-muted-foreground">
                Projects with a Rate are Billable once the Workspace has a Currency.
              </p>
              <TextField
                label="Currency"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                errors={field.state.meta.errors}
                placeholder="EUR, USD, USDT…"
                maxLength={20}
                className="w-32"
                autoFocus
              />
            </Aspect>
          )}
        </form.Field>
      </div>
      <FormFooter
        submitting={submitting}
        onCancel={onClose}
        alert={alert}
        onAlertClose={() => setAlert(null)}
        danger={
          initial && {
            disabledReason: isDefault ? 'Default Workspace' : undefined,
            describe: async () => {
              const count = await window.timeStop.record.count({ workspaceId: initial.id });
              return count === 0
                ? 'This Workspace has no Records. Its Clients and Projects go with it.'
                : recordsWarning(
                    count,
                    'This Workspace',
                    'Its Clients, Projects and Records go with it.',
                  );
            },
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
