import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={clsx('overflow-x-auto rounded-card border border-navaro-line bg-white', className)}>
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-navaro-heath">{children}</thead>;
}

export function TableHeaderCell({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <th
      onClick={onClick}
      className={clsx(
        'px-4 py-3 text-label font-medium text-navaro-muted',
        onClick && 'cursor-pointer select-none hover:text-navaro-green',
        className
      )}
    >
      {children}
    </th>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-navaro-line">{children}</tbody>;
}

export function TableRow({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter') onClick();
            }
          : undefined
      }
      className={clsx('h-[52px] hover:bg-navaro-hover', onClick && 'cursor-pointer', className)}
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={clsx('px-4 py-3 text-sm font-light text-navaro-green', className)}>{children}</td>;
}
