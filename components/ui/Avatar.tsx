import { initials } from '@/lib/format';

interface AvatarProps {
  firstName?: string;
  lastName?: string;
  size?: number;
}

export function Avatar({ firstName, lastName, size = 32 }: AvatarProps) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-navaro-turquoiseTint font-medium text-navaro-green"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(firstName, lastName)}
    </span>
  );
}
