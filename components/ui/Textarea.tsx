import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ error, className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={clsx(
      'w-full rounded-control border bg-white px-3 py-2 text-sm font-light text-navaro-green placeholder:text-navaro-muted',
      'focus:outline-none focus:ring-2 focus:ring-navaro-green/20 focus:border-navaro-green',
      'disabled:bg-navaro-skeleton disabled:cursor-not-allowed',
      error ? 'border-danger' : 'border-navaro-line hover:border-navaro-green/30',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
