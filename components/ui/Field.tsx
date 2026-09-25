import { type ReactNode, useId } from 'react';
import { clsx } from 'clsx';

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
  className?: string;
}

export function Field({ label, required, hint, error, children, className }: FieldProps) {
  const id = useId();
  const descId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-label font-medium text-navaro-green">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children({ id, 'aria-describedby': descId, 'aria-invalid': Boolean(error) })}
      {error ? (
        <p id={descId} className="text-label text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={descId} className="text-label text-navaro-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
