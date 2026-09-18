import { useId, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { serverInputSchema } from '@time-stop/domain';
import type { ServerSettings, SyncStatus } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { useServer, useSetServer, useSyncStatus } from '@/hooks/useSync';

// The URL rules of the API over the text the field holds; an empty Token keeps the stored one.
const serverFormSchema = serverInputSchema.extend({ token: z.string() });

const pushedText = (at: string | null): string =>
  at === null ? 'Nothing pushed yet' : `Last push ${new Date(at).toLocaleString()}`;

const pendingText = (pending: number): string =>
  pending === 1 ? '1 Change waiting' : `${pending} Changes waiting`;

export function ServerSection() {
  const server = useServer();
  const status = useSyncStatus();

  return (
    <Card data-slot="server-section">
      <SectionTitle>Server</SectionTitle>
      <p className="text-sm text-muted-foreground">
        Time Stop keeps working offline; a Server only mirrors what this app records. Mint a Token
        on the Server and paste it here.
      </p>
      {server.data && <ServerForm server={server.data} />}
      {status.data && <SyncReport status={status.data} />}
    </Card>
  );
}

function SyncReport({ status }: { status: SyncStatus }) {
  return (
    <div className="flex flex-col gap-1 text-sm" data-slot="sync-report">
      <p className="text-muted-foreground">
        {status.configured ? pushedText(status.lastPushedAt) : 'No Server configured'}
      </p>
      <p className="text-muted-foreground">{pendingText(status.pending)}</p>
      {status.lastError && (
        <p className={status.halted ? 'text-destructive' : 'text-muted-foreground'}>
          {status.halted
            ? `Pushing stopped: ${status.lastError.message}. Replace the Token to resume.`
            : `Retrying: ${status.lastError.message}`}
        </p>
      )}
    </div>
  );
}

function ServerForm({ server }: { server: ServerSettings }) {
  const id = useId();
  const save = useSetServer();
  const [saved, setSaved] = useState(false);
  const form = useForm({
    defaultValues: { url: server.url ?? '', token: '' },
    validators: { onSubmit: serverFormSchema },
    onSubmit: async ({ value, formApi }) => {
      await save.mutateAsync({ url: value.url, token: value.token.trim() || null });
      setSaved(true);
      formApi.reset({ url: value.url, token: '' });
    },
  });

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        void form.handleSubmit();
      }}
    >
      <FieldGroup className="gap-2">
        <form.Field name="url">
          {(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
              <FieldLabel htmlFor={`${id}-url`}>Server URL</FieldLabel>
              <Input
                id={`${id}-url`}
                placeholder="https://timestop.example.com"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={field.state.meta.errors.length > 0 || undefined}
              />
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
        <form.Field name="token">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={`${id}-token`}>Token</FieldLabel>
              <Input
                id={`${id}-token`}
                type="password"
                autoComplete="off"
                placeholder={server.tokenSet ? 'Stored — paste a new one to replace' : 'tst_…'}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </Field>
          )}
        </form.Field>
      </FieldGroup>
      <div className="flex items-center gap-2">
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" size="sm" disabled={isSubmitting}>
              Save
            </Button>
          )}
        </form.Subscribe>
        {saved && <span className="text-sm text-muted-foreground">Saved</span>}
        {save.isError && <span className="text-sm text-destructive">{save.error.message}</span>}
      </div>
    </form>
  );
}
