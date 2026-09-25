'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { ClientFilters } from '@/components/clients/ClientFilters';
import { ClientTable, type ClientRow } from '@/components/clients/ClientTable';
import { ClientForm, type ClientFormValues } from '@/components/clients/ClientForm';
import { useSession } from '@/components/providers/SessionProvider';
import { api, ApiError } from '@/lib/api-client';
import { isAdmin } from '@/lib/permissions';
import type { Pagination as PaginationData } from '@/lib/api/response';

interface AssignableUser {
  id: string;
  firstName: string;
  lastName: string;
}

interface ClientsClientProps {
  items: ClientRow[];
  pagination: PaginationData;
  assignableUsers: AssignableUser[];
  hasFilters: boolean;
}

export function ClientsClient({ items, pagination, assignableUsers, hasFilters }: ClientsClientProps) {
  const { user, can } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteClient, setDeleteClient] = useState<ClientRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const admin = isAdmin({ role: user.role, permissions: user.permissions });

  function updatePage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.replace(`${pathname}?${params.toString()}`);
  }

  function handleSort(field: string) {
    const params = new URLSearchParams(searchParams.toString());
    const currentSort = params.get('sort');
    const currentOrder = params.get('order') ?? 'desc';
    params.set('sort', field);
    params.set('order', currentSort === field && currentOrder === 'asc' ? 'desc' : 'asc');
    router.replace(`${pathname}?${params.toString()}`);
  }

  async function handleCreate(values: ClientFormValues) {
    setSubmitting(true);
    setErrors({});
    try {
      await api.post('/api/clients', values);
      toast.success('Client created');
      setCreateOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errors) {
          const fe: Record<string, string> = {};
          for (const e of err.errors) fe[e.field] = e.message;
          setErrors(fe);
        } else {
          toast.error(err.message);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteClient) return;
    setSubmitting(true);
    try {
      await api.delete(`/api/clients/${deleteClient.id}`);
      toast.success('Client deleted');
      setDeleteClient(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ClientFilters users={assignableUsers} />
        {can('clients.create') && (
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4" /> Add client
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={hasFilters ? 'No clients match these filters' : 'No clients yet'}
          body={hasFilters ? 'Try a different search or clear your filters.' : 'Add your first client to get started.'}
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={() => router.replace(pathname)}>
                Clear filters
              </Button>
            ) : can('clients.create') ? (
              <Button onClick={() => setCreateOpen(true)}>Add client</Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ClientTable
            items={items}
            onEdit={(client) => router.push(`/clients/${client.id}/edit`)}
            onDelete={(client) => setDeleteClient(client)}
            sort={searchParams.get('sort') ?? 'createdAt'}
            order={searchParams.get('order') ?? 'desc'}
            onSort={handleSort}
          />
          <div className="rounded-card border border-navaro-line bg-white">
            <Pagination pagination={pagination} onPageChange={updatePage} />
          </div>
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add client" size="lg" preventClose={submitting}>
        <ClientForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitting={submitting}
          isAdmin={admin}
          assignableUsers={assignableUsers}
          fieldErrors={errors}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteClient)}
        onClose={() => setDeleteClient(null)}
        onConfirm={handleDelete}
        title={`Delete client ${deleteClient?.companyName ?? ''}?`}
        body={admin ? "This can't be undone." : 'The client will be archived.'}
        confirmLabel="Delete"
        loading={submitting}
      />
    </div>
  );
}
