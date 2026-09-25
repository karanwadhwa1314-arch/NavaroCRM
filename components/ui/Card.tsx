import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div className={clsx('rounded-card border border-navaro-line bg-white', padding && 'p-6', className)}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, action, className }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-center justify-between border-b border-navaro-line px-6 py-5', className)}>
      <h2 className="text-h2 text-navaro-green">{title}</h2>
      {action}
    </div>
  );
}
