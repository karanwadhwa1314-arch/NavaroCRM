import { forwardRef, type InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ error, className, ...props }, ref) => (
  <input
    ref={ref}
    className={clsx(
      'h-10 w-full rounded-control border bg-white px-3 text-sm font-light text-navaro-green placeholder:text-navaro-muted',
      'focus:outline-none focus:ring-2 focus:ring-navaro-green/20 focus:border-navaro-green',
      'disabled:bg-navaro-skeleton disabled:cursor-not-allowed',
      error ? 'border-danger' : 'border-navaro-line hover:border-navaro-green/30',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';
