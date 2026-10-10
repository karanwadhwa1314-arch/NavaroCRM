'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Avatar } from '@/components/ui/Avatar';
import { api, ApiError } from '@/lib/api-client';
import { PROJECT_TEAM_ROLES, PROJECT_TEAM_ROLE_LABELS, type ProjectTeamRole } from '@/lib/constants';

export interface TeamMemberRecord {
  id: string;
  role: ProjectTeamRole;
  user: { id: string; firstName: string; lastName: string; email?: string } | null;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface TeamPanelProps {
  projectId: string;
  team: TeamMemberRecord[];
  projectManager: { id: string; firstName: string; lastName: string } | null;
  assignableUsers: UserOption[];
  canEdit: boolean;
}

export function TeamPanel({ projectId, team, projectManager, assignableUsers, canEdit }: TeamPanelProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [newUser, setNewUser] = useState('');
  const [newRole, setNewRole] = useState<ProjectTeamRole>('coordinator');
  const [removeMember, setRemoveMember] = useState<TeamMemberRecord | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | undefined>();

  const onTeam = new Set(team.map((m) => m.user?.id));
  const candidates = assignableUsers.filter((u) => !onTeam.has(u.id));

  function openAdd() {
    setNewUser('');
    setNewRole('coordinator');
    setAddError(undefined);
    setAddOpen(true);
  }

  async function handleAdd(ev: React.FormEvent) {
    ev.preventDefault();
    if (!newUser) {
      setAddError('Select a person');
      return;
    }
    setSubmitting(true);
    setAddError(undefined);
    try {
      await api.post(`/api/projects/${projectId}/team`, { user: newUser, role: newRole });
      toast.success('Team member added');
      setAddOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setAddError(err.errors?.[0]?.message ?? err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(member: TeamMemberRecord, role: ProjectTeamRole) {
    if (role === member.role) return;
    setBusy(member.id);
    try {
      await api.put(`/api/projects/${projectId}/team/${member.id}`, { role });
      toast.success('Role updated');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    if (!removeMember) return;
    setSubmitting(true);
    try {
      await api.delete(`/api/projects/${projectId}/team/${removeMember.id}`);
      toast.success('Team member removed');
      setRemoveMember(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
        setRemoveMember(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const name = (u: { firstName: string; lastName: string } | null) => (u ? `${u.firstName} ${u.lastName}` : 'Former user');

  return (
    <Card padding={false}>
      <CardHeader
        title="Team"
        action={
          canEdit && (
            <Button size="sm" variant="secondary" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add member
            </Button>
          )
        }
      />
      <div className="p-6">
        {team.length === 0 && !projectManager ? (
          <p className="text-body text-navaro-muted">No one is on this project yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {projectManager && !onTeam.has(projectManager.id) && (
              <li className="flex items-center gap-3">
                <Avatar firstName={projectManager.firstName} lastName={projectManager.lastName} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navaro-green">{name(projectManager)}</p>
                  <p className="text-label text-navaro-muted">Project manager</p>
                </div>
              </li>
            )}
            {team.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar firstName={m.user?.firstName} lastName={m.user?.lastName} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navaro-green">
                    {name(m.user)}
                    {projectManager && m.user?.id === projectManager.id && <span className="font-light text-navaro-muted"> · project manager</span>}
                  </p>
                  {!canEdit && <p className="text-label text-navaro-muted">{PROJECT_TEAM_ROLE_LABELS[m.role]}</p>}
                </div>
                {canEdit && (
                  <>
                    <Select
                      aria-label={`Role of ${name(m.user)}`}
                      value={m.role}
                      disabled={busy === m.id}
                      onChange={(e) => handleRoleChange(m, e.target.value as ProjectTeamRole)}
                      className="h-8 w-40 text-label"
                    >
                      {PROJECT_TEAM_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {PROJECT_TEAM_ROLE_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                    <IconButton aria-label={`Remove ${name(m.user)} from the team`} size="sm" onClick={() => setRemoveMember(m)}>
                      <X className="h-4 w-4" />
                    </IconButton>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add team member" preventClose={submitting}>
        <form onSubmit={handleAdd} noValidate className="flex flex-col gap-4">
          <Field label="Person" required error={addError}>
            {(p) => (
              <Select {...p} value={newUser} onChange={(e) => setNewUser(e.target.value)} error={Boolean(addError)}>
                <option value="">Select a person</option>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Role" required>
            {(p) => (
              <Select {...p} value={newRole} onChange={(e) => setNewRole(e.target.value as ProjectTeamRole)}>
                {PROJECT_TEAM_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {PROJECT_TEAM_ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Add member
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(removeMember)}
        onClose={() => setRemoveMember(null)}
        onConfirm={handleRemove}
        title={`Remove ${name(removeMember?.user ?? null)}?`}
        body="They will no longer be able to be assigned cards on this project."
        confirmLabel="Remove"
        loading={submitting}
      />
    </Card>
  );
}
