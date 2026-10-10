'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useUrlNavigation } from '@/components/layout/UrlNavigation';
import toast from 'react-hot-toast';
import { Plus, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { ProjectFilters } from '@/components/projects/ProjectFilters';
import { ProjectTable, type ProjectRow } from '@/components/projects/ProjectTable';
import { ProjectForm, type ProjectFormValues } from '@/components/projects/ProjectForm';
import { useSession } from '@/components/providers/SessionProvider';
import { api, ApiError } from '@/lib/api-client';
import { isAdmin } from '@/lib/permissions';
import type { Pagination as PaginationData } from '@/lib/api/response';

interface AssignableUser {
  id: string;
  firstName: string;
  lastName: string;
}
interface ClientOption {
  id: string;
  companyName: string;
}

interface ProjectsClientProps {
  items: ProjectRow[];
  pagination: PaginationData;
  clients: ClientOption[];
  assignableUsers: AssignableUser[];
  hasFilters: boolean;
}

export function ProjectsClient({ items, pagination, clients, assignableUsers, hasFilters }: ProjectsClientProps) {
  const { user, can } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { navigate } = useUrlNavigation();

  const [createOpen, setCreateOpen] = useState(() => searchParams.get('new') === '1' && can('projects.create'));
  const [deleteProject, setDeleteProject] = useState<ProjectRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const admin = isAdmin({ role: user.role, permissions: user.permissions });
  const sort = searchParams.get('sort') ?? undefined;
  const order = searchParams.get('order') ?? 'desc';

  function updatePage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    navigate(`${pathname}?${params.toString()}`);
  }

  function closeCreate() {
    setCreateOpen(false);
    if (searchParams.get('new')) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('new');
      navigate(`${pathname}?${params.toString()}`);
    }
  }

  function handleSort(field: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', field);
    params.set('order', sort === field && order === 'asc' ? 'desc' : 'asc');
    params.set('page', '1');
    navigate(`${pathname}?${params.toString()}`);
  }

  async function handleCreate(values: ProjectFormValues) {
    setSubmitting(true);
    setErrors({});
    try {
      const created = await api.post<{ id: string; code: string }>('/api/projects', {
        client: values.client,
        motive: values.motive,
        description: values.description,
        startDate: values.startDate,
        priority: values.priority,
        projectManager: admin ? values.projectManager : undefined,
        notes: values.notes,
      });
      toast.success(`Project created (${created.code})`);
      setCreateOpen(false);
      router.push(`/projects/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errors) {
          const fe: Record<string, string> = {};
          for (const e of err.errors) fe[e.field] = e.message;
          setErrors(fe);
        } else if (err.status === 409) {
          setErrors({ motive: err.message });
        } else {
          toast.error(err.message);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteProject) return;
    setSubmitting(true);
    try {
      await api.delete(`/api/projects/${deleteProject.id}`);
      toast.success('Project deleted');
      setDeleteProject(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <ProjectFilters clients={clients} users={assignableUsers} />
        {can('projects.create') && (
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4" /> New project
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={hasFilters ? 'No projects match these filters' : 'No projects yet'}
          body={
            hasFilters
              ? 'Try a different search or clear your filters.'
              : clients.length === 0
                ? 'Projects belong to a client. Add a client first, then create the project.'
                : 'Create the first project to start tracking cards, team and deadlines.'
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={() => navigate(pathname)}>
                Clear filters
              </Button>
            ) : can('projects.create') && clients.length > 0 ? (
              <Button onClick={() => setCreateOpen(true)}>New project</Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ProjectTable items={items} onDelete={(p) => setDeleteProject(p)} sort={sort} order={order} onSort={handleSort} />
          <div className="rounded-card border border-navaro-line bg-white">
            <Pagination pagination={pagination} onPageChange={updatePage} />
          </div>
        </>
      )}

      <Modal open={createOpen} onClose={closeCreate} title="New project" size="lg" preventClose={submitting}>
        <ProjectForm
          mode="create"
          clients={clients}
          users={assignableUsers}
          isAdmin={admin}
          initial={searchParams.get('client') ? { client: searchParams.get('client') ?? '' } : undefined}
          onSubmit={handleCreate}
          onCancel={closeCreate}
          submitting={submitting}
          fieldErrors={errors}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteProject)}
        onClose={() => setDeleteProject(null)}
        onConfirm={handleDelete}
        title={`Delete project ${deleteProject?.name ?? ''}?`}
        body={admin && user.role === 'superadmin' ? 'The project and all of its cards will be deleted. This can’t be undone.' : 'The project will be archived and hidden from this list.'}
        confirmLabel="Delete"
        loading={submitting}
      />
    </div>
  );
}
