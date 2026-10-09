'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { MoreVertical, Trash2, Mail, Phone, Globe, ArrowLeft } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LeadStageBadge, PriorityBadge } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { StageStepper } from '@/components/leads/StageStepper';
import { StageModal } from '@/components/leads/StageModal';
import { AssignModal } from '@/components/leads/AssignModal';
import { ActivityTimeline, type Activity } from '@/components/leads/ActivityTimeline';
import { AddActivityForm } from '@/components/leads/AddActivityForm';
import { LeadForm, type LeadFormValues } from '@/components/leads/LeadForm';
import { useSession } from '@/components/providers/SessionProvider';
import { api, ApiError } from '@/lib/api-client';
import { isAdmin } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { LEAD_SOURCE_LABELS, TIMELINE_LABELS, type LeadStage, type ActivityType } from '@/lib/constants';

interface AssignableUser {
  id: string;
  firstName: string;
  lastName: string;
}

interface LeadDetail {
  id: string;
  leadType?: 'individual' | 'company';
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  company: string;
  companySize?: string;
  industry?: string;
  website?: string;
  source: string;
  sourceDetails?: string;
  stage: LeadStage;
  priority: import('@/lib/constants').Priority;
  assignedTo?: { _id: string; firstName: string; lastName: string; email: string } | null;
  expectedTimeline?: keyof typeof TIMELINE_LABELS;
  requirements?: string;
  notes?: string;
  tags: string[];
  lostReason?: string;
  estimatedBudget?: { min?: number; max?: number; currency: string };
  activities: Activity[];
  convertedToClient?: { _id: string; companyName: string } | null;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function LeadDetailClient({ lead, assignableUsers }: { lead: LeadDetail; assignableUsers: AssignableUser[] }) {
  const { user, can } = useSession();
  const router = useRouter();
  const admin = isAdmin({ role: user.role, permissions: user.permissions });
  const isConverted = Boolean(lead.convertedToClient);

  const [stageOpen, setStageOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateError, setDuplicateError] = useState<{ message: string; existingClientId?: string } | undefined>();
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  async function handleStageSubmit(stage: LeadStage, lostReason?: string) {
    setSubmitting(true);
    setDuplicateError(undefined);
    try {
      if (stage === 'won') {
        const res = await api.post<{ client: { id: string } }>(`/api/leads/${lead.id}/convert`);
        toast.success('Lead converted to client', { icon: '🎉' });
        router.push(`/clients/${res.client.id}`);
        return;
      }
      await api.put(`/api/leads/${lead.id}/stage`, { stage, lostReason });
      toast.success('Stage updated');
      setStageOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDuplicateError({ message: err.message, existingClientId: (err.data as { existingClientId?: string })?.existingClientId });
      } else if (err instanceof ApiError) {
        toast.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssign(userId: string | null) {
    setSubmitting(true);
    try {
      await api.put(`/api/leads/${lead.id}`, { assignedTo: userId });
      toast.success('Lead reassigned');
      setAssignOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(values: LeadFormValues) {
    setSubmitting(true);
    setEditErrors({});
    try {
      await api.put(`/api/leads/${lead.id}`, values);
      toast.success('Lead updated');
      setEditOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const fe: Record<string, string> = {};
        for (const e of err.errors) fe[e.field] = e.message;
        setEditErrors(fe);
      } else if (err instanceof ApiError) {
        toast.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setSubmitting(true);
    try {
      await api.delete(`/api/leads/${lead.id}`);
      toast.success('Lead deleted');
      router.push('/leads');
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddActivity(type: ActivityType, description: string) {
    try {
      await api.post(`/api/leads/${lead.id}/activities`, { type, description });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/leads" className="inline-flex items-center gap-1 text-label text-navaro-muted hover:text-navaro-green">
          <ArrowLeft className="h-3.5 w-3.5" /> Leads
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-h1 text-navaro-green">{lead.fullName}</h1>
            <p className="mt-1 text-body text-navaro-muted">
              {lead.leadType === 'company' ? 'Company lead' : lead.company}
              {lead.jobTitle ? ` · ${lead.jobTitle}` : ''}
            </p>
          </div>
          {!isConverted && (
            <div className="flex items-center gap-2">
              {can('leads.edit') && (
                <Button variant="primary" onClick={() => setStageOpen(true)}>
                  Change stage
                </Button>
              )}
              {can('leads.edit') && (
                <Button variant="secondary" onClick={() => setEditOpen(true)}>
                  Edit
                </Button>
              )}
              {can('leads.delete') && (
                <Menu trigger={<IconButton aria-label="More actions"><MoreVertical className="h-4 w-4" /></IconButton>}>
                  <MenuItem danger onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </MenuItem>
                </Menu>
              )}
            </div>
          )}
        </div>
      </div>

      {isConverted && lead.convertedToClient && (
        <div className="rounded-control bg-navaro-turquoise px-4 py-3 text-sm font-medium text-navaro-green">
          Converted to client {lead.convertedToClient.companyName} on {formatDate(lead.convertedAt)} ·{' '}
          <Link href={`/clients/${lead.convertedToClient._id}`} className="underline">
            View client
          </Link>
        </div>
      )}

      <Card>
        <StageStepper stage={lead.stage} lostReason={lead.lostReason} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card padding={false}>
            <CardHeader title="Contact" />
            <div className="flex flex-col gap-2 p-6 text-sm">
              <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-navaro-green hover:underline">
                <Mail className="h-4 w-4 text-navaro-muted" /> {lead.email}
              </a>
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-navaro-green hover:underline">
                  <Phone className="h-4 w-4 text-navaro-muted" /> {lead.phone}
                </a>
              )}
              {lead.website && (
                <a href={lead.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-navaro-green hover:underline">
                  <Globe className="h-4 w-4 text-navaro-muted" /> {lead.website}
                </a>
              )}
            </div>
          </Card>

          {lead.requirements && (
            <Card>
              <h2 className="mb-2 text-h3 text-navaro-green">Requirements</h2>
              <p className="whitespace-pre-wrap text-body text-navaro-green">{lead.requirements}</p>
            </Card>
          )}

          <Card padding={false}>
            <CardHeader title="Activity" />
            <div className="p-6">
              {can('leads.edit') && <AddActivityForm onSubmit={handleAddActivity} />}
              <ActivityTimeline activities={lead.activities} />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 text-h3 text-navaro-green">Details</h2>
            <dl className="flex flex-col gap-3 text-sm">
              <Row label="Stage"><LeadStageBadge stage={lead.stage} /></Row>
              <Row label="Priority"><PriorityBadge priority={lead.priority} /></Row>
              <Row label="Source">
                {LEAD_SOURCE_LABELS[lead.source as keyof typeof LEAD_SOURCE_LABELS] ?? lead.source}
                {lead.sourceDetails ? ` — ${lead.sourceDetails}` : ''}
              </Row>
              <Row label="Assigned to">
                <span className="flex items-center gap-2">
                  {lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : 'Unassigned'}
                  {admin && !isConverted && (
                    <button onClick={() => setAssignOpen(true)} className="text-label text-navaro-green underline">
                      Reassign
                    </button>
                  )}
                </span>
              </Row>
              {lead.expectedTimeline && (
                <Row label="Expected timeline">{TIMELINE_LABELS[lead.expectedTimeline]}</Row>
              )}
              <Row label="Created">{formatDate(lead.createdAt)}</Row>
              <Row label="Last updated">{formatDate(lead.updatedAt)}</Row>
            </dl>
          </Card>

          {(lead.estimatedBudget?.min || lead.estimatedBudget?.max) && (
            <Card>
              <h2 className="mb-2 text-h3 text-navaro-green">Budget</h2>
              <p className="text-body text-navaro-green">
                {lead.estimatedBudget.min ?? '—'}–{lead.estimatedBudget.max ?? '—'} {lead.estimatedBudget.currency}
              </p>
            </Card>
          )}

          {lead.tags.length > 0 && (
            <Card>
              <h2 className="mb-2 text-h3 text-navaro-green">Tags</h2>
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.map((tag) => (
                  <Badge key={tag} tone="neutral">
                    {tag}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <StageModal
        open={stageOpen}
        onClose={() => setStageOpen(false)}
        currentStage={lead.stage}
        company={lead.company}
        contactName={lead.fullName}
        canCreateClient={can('clients.create')}
        onSubmit={handleStageSubmit}
        submitting={submitting}
        duplicateError={duplicateError}
      />

      <AssignModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        currentAssigneeId={lead.assignedTo?._id}
        users={assignableUsers}
        onSubmit={handleAssign}
        submitting={submitting}
      />

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit lead" size="lg" preventClose={submitting}>
        <LeadForm
          initial={lead as unknown as LeadFormValues}
          typeLocked
          onSubmit={handleEdit}
          onCancel={() => setEditOpen(false)}
          submitting={submitting}
          submitLabel="Save changes"
          isAdmin={admin}
          assignableUsers={assignableUsers}
          fieldErrors={editErrors}
        />
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={`Delete lead ${lead.fullName}?`}
        body={admin ? "This can't be undone." : 'The lead will be archived.'}
        confirmLabel="Delete"
        loading={submitting}
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
