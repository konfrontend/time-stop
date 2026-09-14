import { useState } from 'react';
import { Gem } from 'lucide-react';
import { z } from 'zod';
import { workspaceInputSchema } from '@time-stop/domain';
import type { Workspace } from '@time-stop/domain';
import { FieldGroup } from '@/components/ui/field';
import { useCreateWorkspace, useDeleteWorkspace, useUpdateWorkspace } from '@/hooks/useWorkspaces';
import { fieldErrors } from '@/lib/fieldErrors';
import { recordsWarning } from '@/lib/format';
import { messageOf } from '@/lib/messageOf';
import { Aspect } from './Aspect';
import { FormFooter } from './FormFooter';
import { TextField } from './TextField';

// Same rules as the API on the text the field holds; the API turns an empty Currency into null.
const formSchema = workspaceInputSchema.extend({ currency: z.string().max(20) });

interface WorkspaceFormProps {
  // Absent when creating; the default Workspace cannot be deleted.
  initial?: Workspace | undefined;
  isDefault?: boolean | undefined;
  onClose: () => void;
}

export function WorkspaceForm({ initial, isDefault, onClose }: WorkspaceFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const create = useCreateWorkspace();
  const update = useUpdateWorkspace();
  const remove = useDeleteWorkspace();
  const submitting = create.isPending || update.isPending;

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const parsed = formSchema.safeParse({ name, currency });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    const input = workspaceInputSchema.parse(parsed.data);
    try {
      if (initial) await update.mutateAsync({ id: initial.id, ...input });
      else await create.mutateAsync(input);
      onClose();
    } catch (error) {
      setFailure(messageOf(error));
    }
  }

  const label = currency.trim().toUpperCase();
  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
      <FieldGroup className="gap-3">
        <TextField
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors['name']}
          autoFocus
        />
      </FieldGroup>
      <div className="flex">
        <Aspect
          icon={<Gem />}
          label="Billable"
          summary={label ? `Billable · ${label}` : null}
          invalid={errors['currency'] !== undefined}
        >
          <p className="text-xs text-muted-foreground">
            Projects with a Rate are Billable once the Workspace has a Currency.
          </p>
          <TextField
            label="Currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            error={errors['currency']}
            placeholder="EUR, USD, USDT…"
            maxLength={20}
            className="w-32"
            autoFocus
          />
        </Aspect>
      </div>
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      <FormFooter
        submitting={submitting}
        onCancel={onClose}
        danger={
          initial && {
            disabledReason: isDefault ? 'Default Workspace' : undefined,
            describe: async () =>
              `${recordsWarning(await window.timeStop.record.count({ workspaceId: initial.id }), 'This Workspace')} Its Clients, Projects and Records go with it.`,
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
