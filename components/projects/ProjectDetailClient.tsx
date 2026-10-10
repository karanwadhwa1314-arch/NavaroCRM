'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, MoreVertical, Pencil, RotateCcw, Trash2, Flag, ArrowRightLeft, Users, Plus } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { ProjectStatusBadge } from '@/components/ui/StatusBadge';
import { HealthMeter } from '@/components/projects/HealthMeter';
import { CardBoard } from '@/components/projects/CardBoard';
import { TeamPanel, type TeamMemberRecord } from '@/components/projects/TeamPanel';
import { ProjectForm, type ProjectFormValues } from '@/components/projects/ProjectForm';
import type { CardRecord, Member } from '@/components/projects/CardFormModal';
import { useSession } from '@/components/providers/SessionProvider';
import { api, ApiError } from '@/lib/api-client';
import { formatDate, formatRelativeTime } from '@/lib/format';
import { isAdmin } from '@/lib/permissions';
import { deriveNameClientPart } from '@/lib/project-naming';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type Priority,
  type ProjectHealthLevel,
  type ProjectStatus,
} from '@/lib/constants';

export interface ProjectDetail {
  id: string;
  name: string;
  code: string;
  description?: string;
  client: { id: string; companyName: string } | null;
  status: ProjectStatus;
  priority: Priority;
  startDate: string;
  actualEndDate?: string;
  projectManager: { id: string; firstName: string; lastName: string; email?: string } | null;
  team: TeamMemberRecord[];
  activities: { id: string; type: string; description: string; user: { firstName: string; lastName: string } | null; createdAt: string }[];
  tags: string[];
  notes?: string;
  deadlineHealth: number;
  healthLevel: ProjectHealthLevel;
  cardCounts: { todo: number; in_progress: number; done: number; total: number };
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface ProjectDetailClientProps {
  project: ProjectDetail;
  cards: CardRecord[];
  assignableUsers: UserOption[];
}

const ACTIVITY_ICONS: Record<string, typeof Flag> = { created: Plus, status_change: ArrowRightLeft, team_change: Users, updated: Pencil };

export function ProjectDetailClient({ project, cards, assignableUsers }: ProjectDetailClientProps) {
  const { user, can } = useSession();
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const ended = project.status === 'completed';
  const admin = isAdmin({ role: user.role, permissions: user.permissions });
  const canEdit = can('projects.edit');
  const healthCritical = project.deadlineHealth <= 20;

  /** Everyone a card may be assigned to: the team plus the project manager. */
  const members: Member[] = useMemo(() => {
    const map = new Map<string, Member>();
    for (const m of project.team) if (m.user) map.set(m.user.id, { id: m.user.id, firstName: m.user.firstName, lastName: m.user.lastName });
    if (project.projectManager) {
      map.set(project.projectManager.id, { id: project.projectManager.id, firstName: project.projectManager.firstName, lastName: project.projectManager.lastName });
    }
    return Array.from(map.values()).sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  }, [project.team, project.projectManager]);

  async function patch(body: Record<string, unknown>, success: string): Promise<boolean> {
    setBusy(true);
    try {
      await api.put(`/api/projects/${project.id}`, body);
      toast.success(success);
      router.refresh();
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        const fe: Record<string, string> = {};
        for (const e of err.errors ?? []) fe[e.field] = e.message;
        if (Object.keys(fe).length > 0 && editOpen) setErrors(fe);
        else toast.error(err.message);
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleEdit(values: ProjectFormValues) {
    setErrors({});
    const body: Record<string, unknown> = {
      motive: values.motive,
      description: values.description,
      startDate: values.startDate,
      priority: values.priority,
      notes: values.notes,
    };
    // Only send the manager when it changed: a non-admin owner may not reassign, and an unchanged value is a no-op.
    if (admin && values.projectManager !== (project.projectManager?.id ?? '')) body.projectManager = values.projectManager || null;
    if (await patch(body, 'Project updated')) setEditOpen(false);
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await api.delete(`/api/projects/${project.id}`);
      toast.success('Project deleted');
      router.push('/projects');
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      setBusy(false);
    }
  }

  const clientPart = project.client ? `${deriveNameClientPart(project.client.companyName)}-` : '';
  const motive = clientPart && project.name.startsWith(clientPart) ? project.name.slice(clientPart.length) : project.name;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/projects" className="inline-flex items-center gap-1 text-label text-navaro-muted hover:text-navaro-green">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Projects
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-h1 text-navaro-green">{project.name}</h1>
            <p className="mt-2 text-body text-navaro-muted">
              {project.code} ·{' '}
              {project.client ? (
                <Link href={`/clients/${project.client.id}`} className="underline underline-offset-2 hover:text-navaro-green">
                  {project.client.companyName}
                </Link>
              ) : (
                'Client removed'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ended ? <ProjectStatusBadge status={project.status} /> : null}
            {canEdit && !ended && (
              <Button variant="secondary" onClick={() => { setErrors({}); setEditOpen(true); }}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            )}
            {canEdit && (ended ? (
              <Button variant="secondary" onClick={() => patch({ status: 'in_progress' }, 'Project restarted')} loading={busy}>
                <RotateCcw className="h-4 w-4" /> Restart project
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setEndOpen(true)} disabled={busy}>
                End project
              </Button>
            ))}
            {can('projects.delete') && (
              <Menu trigger={<IconButton aria-label="More actions"><MoreVertical className="h-4 w-4" /></IconButton>}>
                <MenuItem danger onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4" /> Delete
                </MenuItem>
              </Menu>
            )}
          </div>
        </div>
      </div>

      {ended && (
        <div role="status" className="rounded-control bg-navaro-yellow px-4 py-3 text-sm font-medium text-navaro-green">
          This project ended{project.actualEndDate ? ` on ${formatDate(project.actualEndDate)}` : ''} and is read-only. Restart it to make changes.
        </div>
      )}

      <Card>
        <HealthMeter percentage={project.deadlineHealth} level={project.healthLevel} size="full" />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-navaro-line pt-4 text-sm">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {canEdit && !ended ? (
              <label className="flex items-center gap-2">
                <span className="text-label text-navaro-muted">Status</span>
                <Select
                  value={project.status}
                  disabled={busy}
                  onChange={(e) => patch({ status: e.target.value }, 'Status updated')}
                  className="w-40"
                  aria-label="Project status"
                >
                  {PROJECT_STATUSES.filter((s) => s !== 'completed').map((s) => (
                    <option key={s} value={s}>
                      {PROJECT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </label>
            ) : !ended ? (
              <span className="flex items-center gap-2">
                <span className="text-label text-navaro-muted">Status</span>
                <ProjectStatusBadge status={project.status} />
              </span>
            ) : null}
            <span className="text-navaro-muted">
              {project.cardCounts.total === 0
                ? 'No cards yet'
                : `${project.cardCounts.done} of ${project.cardCounts.total} cards done`}
            </span>
          </div>
          <span className="text-navaro-muted">
            Started {formatDate(project.startDate)}
            {ended && project.actualEndDate ? ` · Ended ${formatDate(project.actualEndDate)}` : ''}
          </span>
        </div>
        {healthCritical && !ended && (
          <p className="mt-3 text-label font-medium text-danger">Health is critically low. Resolve missed deadlines before adding new cards.</p>
        )}
      </Card>

      <CardBoard projectId={project.id} projectEnded={ended} members={members} cards={cards} healthCritical={healthCritical} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TeamPanel
            projectId={project.id}
            team={project.team}
            projectManager={project.projectManager}
            assignableUsers={assignableUsers}
            canEdit={canEdit && !ended}
          />
        </div>

        <Card padding={false}>
          <CardHeader title="Details" />
          <dl className="flex flex-col gap-3 p-6 text-sm">
            <Row label="Project manager">
              {project.projectManager ? `${project.projectManager.firstName} ${project.projectManager.lastName}` : 'Unassigned'}
            </Row>
            <Row label="Priority">
              {canEdit && !ended ? (
                <Select
                  aria-label="Project priority"
                  value={project.priority}
                  disabled={busy}
                  onChange={(e) => patch({ priority: e.target.value }, 'Priority updated')}
                  className="h-8 w-32 text-label"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </Select>
              ) : (
                PRIORITY_LABELS[project.priority]
              )}
            </Row>
            <Row label="Start date">{formatDate(project.startDate)}</Row>
            {ended && <Row label="End date">{formatDate(project.actualEndDate)}</Row>}
          </dl>
          {(project.description || project.notes || project.tags.length > 0) && (
            <div className="flex flex-col gap-4 border-t border-navaro-line p-6">
              {project.description && (
                <div>
                  <h3 className="mb-1 text-label font-medium text-navaro-muted">Description</h3>
                  <p className="whitespace-pre-wrap text-sm text-navaro-green">{project.description}</p>
                </div>
              )}
              {project.notes && (
                <div>
                  <h3 className="mb-1 text-label font-medium text-navaro-muted">Notes</h3>
                  <p className="whitespace-pre-wrap text-sm text-navaro-green">{project.notes}</p>
                </div>
              )}
              {project.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <Card padding={false}>
        <CardHeader title="Activity" />
        <div className="p-6">
          {project.activities.length === 0 ? (
            <p className="text-body text-navaro-muted">No activity yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {project.activities.map((a) => {
                const Icon = ACTIVITY_ICONS[a.type] ?? Flag;
                return (
                  <li key={a.id} className="flex gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navaro-green">
                      <Icon className="h-3.5 w-3.5 text-navaro-heath" strokeWidth={1.75} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-navaro-green">{a.description}</p>
                      <p className="text-label text-navaro-muted">
                        {a.user ? `${a.user.firstName} ${a.user.lastName} · ` : ''}
                        <span title={formatDate(a.createdAt, 'd MMM yyyy, HH:mm')}>{formatRelativeTime(a.createdAt)}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit project" size="lg" preventClose={busy}>
        <ProjectForm
          mode="edit"
          clients={project.client ? [project.client].map((c) => ({ id: c.id, companyName: c.companyName })) : []}
          users={assignableUsers}
          isAdmin={admin}
          code={project.code}
          initial={{
            client: project.client?.id ?? '',
            motive,
            description: project.description ?? '',
            startDate: new Date(project.startDate).toISOString().slice(0, 10),
            priority: project.priority,
            projectManager: project.projectManager?.id ?? '',
            notes: project.notes ?? '',
          }}
          onSubmit={handleEdit}
          onCancel={() => setEditOpen(false)}
          submitting={busy}
          fieldErrors={errors}
        />
      </Modal>

      <ConfirmDialog
        open={endOpen}
        onClose={() => setEndOpen(false)}
        onConfirm={async () => {
          if (await patch({ status: 'completed' }, 'Project ended')) setEndOpen(false);
        }}
        title="End this project?"
        body="It becomes read-only: cards, team and details can’t change until you restart it."
        confirmLabel="End project"
        loading={busy}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={`Delete project ${project.name}?`}
        body={user.role === 'superadmin' ? 'The project and all of its cards will be deleted. This can’t be undone.' : 'The project will be archived and hidden from the list.'}
        confirmLabel="Delete"
        loading={busy}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-navaro-muted">{label}</dt>
      <dd className="text-right text-navaro-green">{children}</dd>
    </div>
  );
}
