import { clsx } from 'clsx';

interface RadioCardProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  description: string;
  disabled?: boolean;
}

export function RadioCard({ name, value, checked, onChange, title, description, disabled }: RadioCardProps) {
  return (
    <label
      className={clsx(
        'flex cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors',
        checked ? 'border-navaro-green bg-navaro-hover' : 'border-navaro-line hover:bg-navaro-hover',
        disabled && 'cursor-not-allowed opacity-40'
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="mt-1 h-4 w-4 accent-navaro-green"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-navaro-green">{title}</span>
        <span className="text-label text-navaro-muted">{description}</span>
      </span>
    </label>
  );
}
