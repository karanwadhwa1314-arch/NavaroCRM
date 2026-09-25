'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PermissionMatrix } from '@/components/users/PermissionMatrix';
import { roleDefaultPermissions, type Permission } from '@/lib/permissions';
import type { UserRole } from '@/lib/constants';

interface PermissionsModalProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  role: UserRole;
  initialPermissions: Permission[];
  onSave: (permissions: Permission[]) => Promise<void>;
  onReset: () => Promise<void>;
  submitting: boolean;
}

export function PermissionsModal({ open, onClose, userName, role, initialPermissions, onSave, onReset, submitting }: PermissionsModalProps) {
  const [permissions, setPermissions] = useState<Permission[]>(initialPermissions);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Permissions · ${userName}`}
      size="lg"
      preventClose={submitting}
      footer={
        <>
          <Button variant="secondary" onClick={() => { setPermissions(roleDefaultPermissions(role)); void onReset(); }} disabled={submitting}>
            Reset to role defaults
          </Button>
          <Button onClick={() => onSave(permissions)} loading={submitting}>
            Save permissions
          </Button>
        </>
      }
    >
      <PermissionMatrix value={permissions} onChange={setPermissions} />
    </Modal>
  );
}
