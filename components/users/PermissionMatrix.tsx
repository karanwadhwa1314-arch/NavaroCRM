import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { PERMISSION_GROUPS, PERMISSION_LABELS, type Permission } from '@/lib/permissions';

interface PermissionMatrixProps {
  value: Permission[];
  onChange: (perms: Permission[]) => void;
}

export function PermissionMatrix({ value, onChange }: PermissionMatrixProps) {
  function toggle(perm: Permission) {
    onChange(value.includes(perm) ? value.filter((p) => p !== perm) : [...value, perm]);
  }

  function toggleGroup(perms: Permission[], allSelected: boolean) {
    if (allSelected) {
      onChange(value.filter((p) => !perms.includes(p)));
    } else {
      onChange(Array.from(new Set([...value, ...perms])));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {PERMISSION_GROUPS.map(({ group, perms }) => {
        const selectedCount = perms.filter((p) => value.includes(p)).length;
        const allSelected = selectedCount === perms.length;
        return (
          <div key={group} className="rounded-control border border-navaro-line p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-navaro-green">
                {group} <span className="text-navaro-muted">({selectedCount}/{perms.length})</span>
              </span>
              <button type="button" onClick={() => toggleGroup(perms, allSelected)} className="text-label text-navaro-green underline">
                {allSelected ? 'Clear' : 'Select all'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {perms.map((perm) => (
                <label key={perm} className="flex items-center gap-2">
                  <Checkbox checked={value.includes(perm)} onChange={() => toggle(perm)} />
                  <span className="text-sm text-navaro-green">{PERMISSION_LABELS[perm]}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
      <div>
        <Button variant="ghost" size="sm" onClick={() => onChange([])} type="button">
          Clear all
        </Button>
      </div>
    </div>
  );
}
