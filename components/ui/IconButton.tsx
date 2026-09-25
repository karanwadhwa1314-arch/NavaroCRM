import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  size?: 'md' | 'sm';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = 'md', className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={clsx(
        'inline-flex items-center justify-center rounded-control text-navaro-green hover:bg-navaro-hover transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        size === 'md' ? 'h-10 w-10' : 'h-8 w-8',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
IconButton.displayName = 'IconButton';
