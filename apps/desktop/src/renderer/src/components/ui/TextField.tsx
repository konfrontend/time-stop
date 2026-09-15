import { useId } from 'react';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

interface TextFieldProps extends Omit<React.ComponentProps<'input'>, 'id'> {
  label: string;
  // A form field's errors as tanstack form reports them.
  errors?: React.ComponentProps<typeof FieldError>['errors'];
  // Rendered beside the input, inside the Field.
  trailing?: React.ReactNode;
}

/** A labelled Input with its error line. */
export function TextField({ label, errors = [], trailing, className, ...props }: TextFieldProps) {
  const id = useId();
  const invalid = errors.length > 0 || undefined;
  const input = <Input id={id} aria-invalid={invalid} className={className} {...props} />;
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {trailing ? (
        <div className="flex items-center gap-2">
          {input}
          {trailing}
        </div>
      ) : (
        input
      )}
      <FieldError errors={errors} />
    </Field>
  );
}
