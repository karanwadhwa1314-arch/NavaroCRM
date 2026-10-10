import { AlertTriangle, CheckCircle2, CircleAlert, ShieldCheck, type LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { PROJECT_HEALTH_LABELS, type ProjectHealthLevel } from '@/lib/constants';

/**
 * Health is shown as a bar *and* a word *and* an icon, so it never depends on colour alone.
 * Colours follow the brand's data roles: primary metric (green) for perfect, growth (turquoise) for good,
 * opportunity (yellow) for average; critical uses the semantic red.
 */
const LEVELS: Record<ProjectHealthLevel, { bar: string; text: string; icon: LucideIcon }> = {
  perfect: { bar: 'bg-navaro-green', text: 'text-navaro-green', icon: ShieldCheck },
  good: { bar: 'bg-navaro-turquoise', text: 'text-navaro-green', icon: CheckCircle2 },
  average: { bar: 'bg-navaro-yellow', text: 'text-navaro-green', icon: CircleAlert },
  critical: { bar: 'bg-danger', text: 'text-danger', icon: AlertTriangle },
};

interface HealthMeterProps {
  percentage: number;
  level: ProjectHealthLevel;
  size?: 'compact' | 'full';
}

export function HealthMeter({ percentage, level, size = 'compact' }: HealthMeterProps) {
  const cfg = LEVELS[level];
  const Icon = cfg.icon;
  const label = `Health ${percentage}% (${PROJECT_HEALTH_LABELS[level].toLowerCase()})`;

  if (size === 'full') {
    return (
      <div role="img" aria-label={label}>
        <div className="mb-3 flex items-end justify-between gap-3">
          <p className={clsx('flex items-center gap-2 text-h3', cfg.text)}>
            <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            {PROJECT_HEALTH_LABELS[level]}
          </p>
          <p className={clsx('text-display', cfg.text)}>{percentage}%</p>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-navaro-hover">
          <div className={clsx('h-full rounded-full transition-all duration-300', cfg.bar)} style={{ width: `${percentage}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div role="img" aria-label={label} className="flex min-w-[8.5rem] flex-col gap-1.5">
      <div className={clsx('flex items-center gap-1.5 text-sm font-medium', cfg.text)}>
        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        <span>{percentage}%</span>
        <span className="text-label font-light text-navaro-muted">{PROJECT_HEALTH_LABELS[level]}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-navaro-hover">
        <div className={clsx('h-full rounded-full', cfg.bar)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
