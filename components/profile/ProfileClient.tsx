'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api-client';
import type { SessionUser } from '@/lib/auth/session';

export function ProfileClient({ user }: { user: SessionUser }) {
  const router = useRouter();

  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [department, setDepartment] = useState(user.department ?? '');
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleSaveProfile() {
    setSavingProfile(true);
    setProfileErrors({});
    try {
      await api.patch('/api/auth/me', { firstName, lastName, email, phone, department });
      toast.success('Profile updated');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errors) {
          const fe: Record<string, string> = {};
          for (const e of err.errors) fe[e.field] = e.message;
          setProfileErrors(fe);
        } else {
          toast.error(err.message);
        }
      }
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    const errors: Record<string, string> = {};
    if (!currentPassword) errors.currentPassword = 'Required';
    if (!newPassword || newPassword.length < 8) errors.newPassword = 'At least 8 characters';
    if (newPassword !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingPassword(true);
    try {
      await api.put('/api/auth/password', { currentPassword, newPassword });
      toast.success('Password changed. Other sessions have been signed out.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="mb-4 text-h3 text-navaro-green">Profile information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" required error={profileErrors.firstName}>
            {(p) => <Input {...p} value={firstName} onChange={(e) => setFirstName(e.target.value)} />}
          </Field>
          <Field label="Last name" required error={profileErrors.lastName}>
            {(p) => <Input {...p} value={lastName} onChange={(e) => setLastName(e.target.value)} />}
          </Field>
          <Field label="Email" required error={profileErrors.email}>
            {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Phone" error={profileErrors.phone}>
            {(p) => <Input {...p} value={phone} onChange={(e) => setPhone(e.target.value)} />}
          </Field>
          <Field label="Department" error={profileErrors.department}>
            {(p) => <Input {...p} value={department} onChange={(e) => setDepartment(e.target.value)} />}
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSaveProfile} loading={savingProfile}>
            Save changes
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-h3 text-navaro-green">Change password</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Current password" required error={passwordErrors.currentPassword}>
            {(p) => <Input {...p} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />}
          </Field>
          <Field label="New password" required error={passwordErrors.newPassword}>
            {(p) => <Input {...p} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />}
          </Field>
          <Field label="Confirm new password" required error={passwordErrors.confirmPassword}>
            {(p) => <Input {...p} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />}
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleChangePassword} loading={savingPassword}>
            Change password
          </Button>
        </div>
      </Card>
    </div>
  );
}
