import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ error, className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={clsx(
        'h-10 w-full appearance-none rounded-control border bg-white px-3 pr-9 text-sm font-light text-navaro-green',
        'focus:outline-none focus:ring-2 focus:ring-navaro-green/20 focus:border-navaro-green',
        'disabled:bg-navaro-skeleton disabled:cursor-not-allowed',
        error ? 'border-danger' : 'border-navaro-line hover:border-navaro-green/30',
        className
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navaro-muted"
      aria-hidden="true"
    />
  </div>
));
Select.displayName = 'Select';
