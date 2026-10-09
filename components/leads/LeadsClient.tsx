'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useUrlNavigation } from '@/components/layout/UrlNavigation';
import toast from 'react-hot-toast';
import { Plus, Inbox, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { ImportLeadsModal } from '@/components/leads/ImportLeadsModal';
import { LeadFilters } from '@/components/leads/LeadFilters';
import { LeadTable, type LeadRow } from '@/components/leads/LeadTable';
import { LeadForm, type LeadFormValues } from '@/components/leads/LeadForm';
import { useSession } from '@/components/providers/SessionProvider';
import { api, ApiError } from '@/lib/api-client';
import { isAdmin } from '@/lib/permissions';
import type { LeadType } from '@/lib/constants';
import type { Pagination as PaginationData } from '@/lib/api/response';

interface AssignableUser {
  id: string;
  firstName: string;
  lastName: string;
}

interface LeadsClientProps {
  items: LeadRow[];
  pagination: PaginationData;
  assignableUsers: AssignableUser[];
  hasFilters: boolean;
  /** The kind of lead being listed (the Individuals / Companies switch). */
  type: LeadType;
}

export function LeadsClient({ items, pagination, assignableUsers, hasFilters, type }: LeadsClientProps) {
  const { user, can } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { navigate } = useUrlNavigation();

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editLead, setEditLead] = useState<LeadRow | null>(null);
  const [deleteLead, setDeleteLead] = useState<LeadRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const admin = isAdmin({ role: user.role, permissions: user.permissions });
  const noun = type === 'company' ? 'company' : 'lead';

  // "Clear filters" clears the filters, not the Individuals / Companies choice.
  const clearFilters = () => navigate(type === 'company' ? `${pathname}?type=company` : pathname);

  function updatePage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    navigate(`${pathname}?${params.toString()}`);
  }

  function handleSort(field: string) {
    const params = new URLSearchParams(searchParams.toString());
    const currentSort = params.get('sort');
    const currentOrder = params.get('order') ?? 'desc';
    params.set('sort', field);
    params.set('order', currentSort === field && currentOrder === 'asc' ? 'desc' : 'asc');
    navigate(`${pathname}?${params.toString()}`);
  }

  async function handleCreate(values: LeadFormValues) {
    setSubmitting(true);
    setErrors({});
    try {
      await api.post('/api/leads', values);
      toast.success('Lead created');
      setCreateOpen(false);
      router.refresh();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(values: LeadFormValues) {
    if (!editLead) return;
    setSubmitting(true);
    setErrors({});
    try {
      await api.put(`/api/leads/${editLead.id}`, values);
      toast.success('Lead updated');
      setEditLead(null);
      router.refresh();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteLead) return;
    setSubmitting(true);
    try {
      await api.delete(`/api/leads/${deleteLead.id}`);
      toast.success('Lead deleted');
      setDeleteLead(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleApiError(err: unknown) {
    if (err instanceof ApiError) {
      if (err.errors) {
        const fieldErrors: Record<string, string> = {};
        for (const e of err.errors) fieldErrors[e.field] = e.message;
        setErrors(fieldErrors);
      } else {
        toast.error(err.message);
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <LeadFilters users={assignableUsers} />
        {can('leads.create') && (
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> {type === 'company' ? 'Add company' : 'Add lead'}
            </Button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={hasFilters ? `No ${noun === 'company' ? 'companies' : 'leads'} match these filters` : type === 'company' ? 'No company leads yet' : 'No leads yet'}
          body={
            hasFilters
              ? 'Try a different search or clear your filters.'
              : type === 'company'
                ? 'Add a company, or import a CSV that has company names without a contact person.'
                : 'Add your first lead to get started.'
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : can('leads.create') ? (
              <Button onClick={() => setCreateOpen(true)}>{type === 'company' ? 'Add company' : 'Add lead'}</Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <LeadTable
            items={items}
            type={type}
            onEdit={(lead) => setEditLead(lead)}
            onDelete={(lead) => setDeleteLead(lead)}
            sort={searchParams.get('sort') ?? 'createdAt'}
            order={searchParams.get('order') ?? 'desc'}
            onSort={handleSort}
          />
          <div className="rounded-card border border-navaro-line bg-white">
            <Pagination pagination={pagination} onPageChange={updatePage} />
          </div>
        </>
      )}

      <ImportLeadsModal open={importOpen} onClose={() => setImportOpen(false)} onImported={() => router.refresh()} />

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add lead" size="lg" preventClose={submitting}>
        <LeadForm
          defaultType={type}
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitting={submitting}
          submitLabel="Create lead"
          isAdmin={admin}
          assignableUsers={assignableUsers}
          fieldErrors={errors}
        />
      </Modal>

      <Modal
        open={Boolean(editLead)}
        onClose={() => setEditLead(null)}
        title="Edit lead"
        size="lg"
        preventClose={submitting}
      >
        {editLead && (
          <LeadForm
            initial={editLead as unknown as LeadFormValues}
            typeLocked
            onSubmit={handleEdit}
            onCancel={() => setEditLead(null)}
            submitting={submitting}
            submitLabel="Save changes"
            isAdmin={admin}
            assignableUsers={assignableUsers}
            fieldErrors={errors}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteLead)}
        onClose={() => setDeleteLead(null)}
        onConfirm={handleDelete}
        title={`Delete lead ${deleteLead?.fullName ?? ''}?`}
        body={admin ? "This can't be undone." : 'The lead will be archived.'}
        confirmLabel="Delete"
        loading={submitting}
      />
    </div>
  );
}
