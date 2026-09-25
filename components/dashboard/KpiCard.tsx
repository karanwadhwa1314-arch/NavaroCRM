import { clsx } from 'clsx';

interface KpiCardProps {
  label: string;
  value: number | string;
  accent: 'green' | 'turquoise' | 'yellow' | 'lavender';
}

const accentClasses: Record<KpiCardProps['accent'], string> = {
  green: 'bg-navaro-green',
  turquoise: 'bg-navaro-turquoise',
  yellow: 'bg-navaro-yellow',
  lavender: 'bg-navaro-lavender',
};

export function KpiCard({ label, value, accent }: KpiCardProps) {
  return (
    <div className="overflow-hidden rounded-card border border-navaro-line bg-white">
      <div className={clsx('h-1', accentClasses[accent])} />
      <div className="p-5">
        <p className="text-display text-navaro-green">{value}</p>
        <p className="mt-1 text-label text-navaro-muted">{label}</p>
      </div>
    </div>
  );
}
