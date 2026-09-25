import { forwardRef, type InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';

type CheckboxProps = InputHTMLAttributes<HTMLInputElement>;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({ className, ...props }, ref) => (
  <span className={clsx('relative inline-flex h-4 w-4 shrink-0 items-center justify-center', className)}>
    <input
      ref={ref}
      type="checkbox"
      className="peer h-4 w-4 shrink-0 appearance-none rounded border border-navaro-line bg-white checked:bg-navaro-green checked:border-navaro-green focus:outline-none focus:ring-2 focus:ring-navaro-green/20"
      {...props}
    />
    <Check
      className="pointer-events-none absolute h-3 w-3 text-navaro-heath opacity-0 peer-checked:opacity-100"
      aria-hidden="true"
    />
  </span>
));
Checkbox.displayName = 'Checkbox';
