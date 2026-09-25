import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-navaro-line bg-white px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-control border border-navaro-line">
        <Icon className="h-6 w-6 text-navaro-green" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h3 className="text-h3 text-navaro-green">{title}</h3>
      <p className="max-w-sm text-body text-navaro-muted">{body}</p>
      {action}
    </div>
  );
}
