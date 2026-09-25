import { clsx } from 'clsx';

export function Spinner({ size = 16, className }: { size?: 16 | 20; className?: string }) {
  return (
    <svg
      className={clsx('animate-spin text-navaro-green', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="#D8F1E7" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
