import type { ReactNode } from 'react';
import { clsx } from 'clsx';

/**
 * Solid brand fills, not pastels. Text pairs are the contrast-checked ones from the brand
 * implementation notes: green on turquoise/yellow, ink on lavender, heath/white on green/danger.
 * The *Tint tones remain for quiet, secondary emphasis only.
 */
export type BadgeTone =
  | 'neutral'
  | 'outline'
  | 'green'
  | 'turquoiseSolid'
  | 'yellowSolid'
  | 'lavenderSolid'
  | 'dangerSolid'
  | 'turquoise'
  | 'yellow'
  | 'lavender'
  | 'danger';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-navaro-hover text-navaro-green',
  outline: 'bg-transparent text-navaro-green border border-navaro-green/40',
  green: 'bg-navaro-green text-navaro-heath',
  turquoiseSolid: 'bg-navaro-turquoise text-navaro-green',
  yellowSolid: 'bg-navaro-yellow text-navaro-green',
  lavenderSolid: 'bg-navaro-lavender text-navaro-ink',
  dangerSolid: 'bg-danger text-white',
  turquoise: 'bg-navaro-turquoiseTint text-navaro-green',
  yellow: 'bg-navaro-yellowTint text-navaro-green',
  lavender: 'bg-navaro-lavenderTint text-navaro-green',
  danger: 'bg-danger-tint text-danger',
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
