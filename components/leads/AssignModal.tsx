'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';

interface AssignableUser {
  id: string;
  firstName: string;
  lastName: string;
}

interface AssignModalProps {
  open: boolean;
  onClose: () => void;
  currentAssigneeId?: string;
  users: AssignableUser[];
  onSubmit: (userId: string | null) => Promise<void>;
  submitting: boolean;
}

export function AssignModal({ open, onClose, currentAssigneeId, users, onSubmit, submitting }: AssignModalProps) {
  const [assignee, setAssignee] = useState(currentAssigneeId ?? '');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reassign lead"
      size="sm"
      preventClose={submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(assignee || null)} loading={submitting}>
            Save
          </Button>
        </>
      }
    >
      <Field label="Assigned to">
        {(p) => (
          <Select {...p} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </Modal>
  );
}
