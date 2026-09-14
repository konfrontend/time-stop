import { useId } from 'react';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

interface TextFieldProps extends Omit<React.ComponentProps<'input'>, 'id'> {
  label: string;
  error?: string | undefined;
  // Rendered beside the input, inside the Field.
  trailing?: React.ReactNode;
}

/** A labelled Input with its error line, for the plain-state forms of Settings. */
export function TextField({ label, error, trailing, className, ...props }: TextFieldProps) {
  const id = useId();
  return (
    <Field data-invalid={error !== undefined || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {trailing ? (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            aria-invalid={error !== undefined || undefined}
            className={className}
            {...props}
          />
          {trailing}
        </div>
      ) : (
        <Input
          id={id}
          aria-invalid={error !== undefined || undefined}
          className={className}
          {...props}
        />
      )}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}
