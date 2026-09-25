import { RadioCard } from '@/components/ui/RadioCard';
import { USER_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type UserRole } from '@/lib/constants';

interface RolePickerProps {
  value: UserRole;
  onChange: (role: UserRole) => void;
  /** Roles the current actor is allowed to assign. */
  allowedRoles: UserRole[];
}

export function RolePicker({ value, onChange, allowedRoles }: RolePickerProps) {
  return (
    <div className="flex flex-col gap-2">
      {USER_ROLES.filter((r) => allowedRoles.includes(r)).map((role) => (
        <RadioCard
          key={role}
          name="role"
          value={role}
          checked={value === role}
          onChange={(v) => onChange(v as UserRole)}
          title={ROLE_LABELS[role]}
          description={ROLE_DESCRIPTIONS[role]}
        />
      ))}
    </div>
  );
}
