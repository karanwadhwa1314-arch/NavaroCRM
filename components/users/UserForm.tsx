'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { RolePicker } from '@/components/users/RolePicker';
import { PermissionMatrix } from '@/components/users/PermissionMatrix';
import { roleDefaultPermissions, type Permission } from '@/lib/permissions';
import type { UserRole } from '@/lib/constants';

export interface UserFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phone?: string;
  department?: string;
  role: UserRole;
  permissions?: Permission[];
}

interface UserFormProps {
  mode: 'create' | 'edit';
  initial?: Partial<UserFormValues>;
  onSubmit: (values: UserFormValues, roleChanged: boolean) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  actorIsSuperadmin: boolean;
  allowedRoles: UserRole[];
  fieldErrors?: Record<string, string>;
}

export function UserForm({ mode, initial, onSubmit, onCancel, submitting, actorIsSuperadmin, allowedRoles, fieldErrors = {} }: UserFormProps) {
  const originalRole = initial?.role ?? 'member';
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [department, setDepartment] = useState(initial?.department ?? '');
  const [role, setRole] = useState<UserRole>(originalRole);
  const [permissions, setPermissions] = useState<Permission[]>(initial?.permissions ?? roleDefaultPermissions(originalRole));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleRoleChange(next: UserRole) {
    setRole(next);
    setPermissions(roleDefaultPermissions(next));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'Required';
    if (!lastName.trim()) e.lastName = 'Required';
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) e.email = 'Enter a valid email';
    if (mode === 'create' && (!password || password.length < 8)) e.password = 'At least 8 characters';
    if (mode === 'edit' && password && password.length < 8) e.password = 'At least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    await onSubmit(
      {
        firstName,
        lastName,
        email,
        password: password || undefined,
        phone: phone || undefined,
        department: department || undefined,
        role,
        permissions: role === 'superadmin' ? [] : permissions,
      },
      role !== originalRole
    );
  }

  const allErrors = { ...errors, ...fieldErrors };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" required error={allErrors.firstName}>
          {(p) => <Input {...p} value={firstName} onChange={(e) => setFirstName(e.target.value)} />}
        </Field>
        <Field label="Last name" required error={allErrors.lastName}>
          {(p) => <Input {...p} value={lastName} onChange={(e) => setLastName(e.target.value)} />}
        </Field>
        <Field label="Email" required error={allErrors.email}>
          {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label={mode === 'create' ? 'Password' : 'New password'} required={mode === 'create'} error={allErrors.password}>
          {(p) => (
            <div className="relative">
              <Input
                {...p}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                placeholder={mode === 'edit' ? 'Leave blank to keep current password' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-navaro-muted hover:text-navaro-green"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}
        </Field>
        <Field label="Phone">
          {(p) => <Input {...p} value={phone} onChange={(e) => setPhone(e.target.value)} />}
        </Field>
        <Field label="Department">
          {(p) => <Input {...p} value={department} onChange={(e) => setDepartment(e.target.value)} />}
        </Field>
      </div>

      {actorIsSuperadmin && (
        <div className="border-t border-navaro-line pt-4">
          <h3 className="mb-3 text-h3 text-navaro-green">Role</h3>
          <RolePicker value={role} onChange={handleRoleChange} allowedRoles={allowedRoles} />
          {mode === 'edit' && role !== originalRole && (
            <p className="mt-2 text-label text-navaro-muted">Changing the role resets permissions to that role&rsquo;s defaults.</p>
          )}
        </div>
      )}

      {actorIsSuperadmin && mode === 'create' && role !== 'superadmin' && (
        <div className="border-t border-navaro-line pt-4">
          <h3 className="mb-3 text-h3 text-navaro-green">Permissions</h3>
          <PermissionMatrix value={permissions} onChange={setPermissions} />
        </div>
      )}
      {role === 'superadmin' && (
        <p className="text-label text-navaro-muted">Super admins have every permission.</p>
      )}

      <div className="flex justify-end gap-3 border-t border-navaro-line pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={submitting}>
          {mode === 'create' ? 'Create user' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
