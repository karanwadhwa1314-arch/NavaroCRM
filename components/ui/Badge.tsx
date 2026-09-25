import type { ReactNode } from 'react';
import { clsx } from 'clsx';

export type BadgeTone = 'neutral' | 'green' | 'turquoise' | 'yellow' | 'lavender' | 'danger' | 'outline';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-navaro-hover text-navaro-green',
  green: 'bg-navaro-green text-navaro-heath',
  turquoise: 'bg-navaro-turquoiseTint text-navaro-green',
  yellow: 'bg-navaro-yellowTint text-navaro-green',
  lavender: 'bg-navaro-lavenderTint text-navaro-green',
  danger: 'bg-danger-tint text-danger',
  outline: 'bg-transparent text-navaro-green border border-navaro-line',
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-label font-medium whitespace-nowrap',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
