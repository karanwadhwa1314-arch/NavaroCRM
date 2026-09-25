'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Search, Users2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { UserTable, type UserRow } from '@/components/users/UserTable';
import { UserForm, type UserFormValues } from '@/components/users/UserForm';
import { PermissionsModal } from '@/components/users/PermissionsModal';
import { useSession } from '@/components/providers/SessionProvider';
import { api, ApiError } from '@/lib/api-client';
import { USER_ROLES, ROLE_LABELS } from '@/lib/constants';
import type { UserRole } from '@/lib/constants';
import type { Permission } from '@/lib/permissions';
import type { Pagination as PaginationData } from '@/lib/api/response';

interface UsersClientProps {
  items: UserRow[];
  pagination: PaginationData;
  stats: { total: number; active: number; superadmins: number; admins: number };
}

export function UsersClient({ items, pagination, stats }: UsersClientProps) {
  const { user: actor, can } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<UserRow | null>(null);
  const [statusUser, setStatusUser] = useState<UserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isSuperadmin = actor.role === 'superadmin';
  const allowedCreateRoles: UserRole[] = isSuperadmin ? [...USER_ROLES] : ['member'];

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    router.replace(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (search !== (searchParams.get('search') ?? '')) updateParam('search', search);
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function updatePage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.replace(`${pathname}?${params.toString()}`);
  }

  async function handleCreate(values: UserFormValues) {
    setSubmitting(true);
    setErrors({});
    try {
      await api.post('/api/users', values);
      toast.success('User created');
      setCreateOpen(false);
      router.refresh();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(values: UserFormValues, roleChanged: boolean) {
    if (!editUser) return;
    setSubmitting(true);
    setErrors({});
    try {
      await api.put(`/api/users/${editUser.id}`, {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        department: values.department,
        password: values.password,
      });
      if (roleChanged) {
        await api.put(`/api/users/${editUser.id}/role`, { role: values.role });
      }
      toast.success('User updated');
      setEditUser(null);
      router.refresh();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSavePermissions(permissions: Permission[]) {
    if (!permissionsUser) return;
    setSubmitting(true);
    try {
      await api.put(`/api/users/${permissionsUser.id}/permissions`, { permissions });
      toast.success('Permissions updated');
      setPermissionsUser(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPermissions() {
    if (!permissionsUser) return;
    try {
      await api.put(`/api/users/${permissionsUser.id}/reset-permissions`);
      toast.success('Permissions reset to role defaults');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    }
  }

  async function handleToggleStatus() {
    if (!statusUser) return;
    setSubmitting(true);
    try {
      await api.put(`/api/users/${statusUser.id}/status`, { isActive: !statusUser.isActive });
      toast.success(statusUser.isActive ? 'User deactivated' : 'User activated');
      setStatusUser(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteUser) return;
    setSubmitting(true);
    setDeleteErrorMessage(null);
    try {
      await api.delete(`/api/users/${deleteUser.id}`);
      toast.success('User deleted');
      setDeleteUser(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setDeleteErrorMessage(err.message);
        else toast.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleApiError(err: unknown) {
    if (err instanceof ApiError) {
      if (err.errors) {
        const fe: Record<string, string> = {};
        for (const e of err.errors) fe[e.field] = e.message;
        setErrors(fe);
      } else {
        toast.error(err.message);
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-4 text-sm">
        <Chip label="Total" value={stats.total} />
        <Chip label="Active" value={stats.active} />
        <Chip label="Super admins" value={stats.superadmins} />
        <Chip label="Admins" value={stats.admins} />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navaro-muted" />
            <Input placeholder="Search users" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={searchParams.get('role') ?? ''} onChange={(e) => updateParam('role', e.target.value)} className="w-full sm:w-40">
            <option value="">All roles</option>
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
          <Select value={searchParams.get('isActive') ?? ''} onChange={(e) => updateParam('isActive', e.target.value)} className="w-full sm:w-36">
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </div>
        {can('users.create') && (
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4" /> Add user
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Users2} title="No users found" body="Try a different search or add a new user." />
      ) : (
        <>
          <UserTable
            items={items}
            onEdit={setEditUser}
            onPermissions={setPermissionsUser}
            onToggleStatus={setStatusUser}
            onDelete={setDeleteUser}
          />
          <div className="rounded-card border border-navaro-line bg-white">
            <Pagination pagination={pagination} onPageChange={updatePage} />
          </div>
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add user" size="xl" preventClose={submitting}>
        <UserForm
          mode="create"
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitting={submitting}
          actorIsSuperadmin={isSuperadmin}
          allowedRoles={allowedCreateRoles}
          fieldErrors={errors}
        />
      </Modal>

      <Modal open={Boolean(editUser)} onClose={() => setEditUser(null)} title="Edit user" size="xl" preventClose={submitting}>
        {editUser && (
          <UserForm
            mode="edit"
            initial={editUser}
            onSubmit={handleEdit}
            onCancel={() => setEditUser(null)}
            submitting={submitting}
            actorIsSuperadmin={isSuperadmin}
            allowedRoles={[...USER_ROLES]}
            fieldErrors={errors}
          />
        )}
      </Modal>

      {permissionsUser && (
        <PermissionsModal
          open={Boolean(permissionsUser)}
          onClose={() => setPermissionsUser(null)}
          userName={`${permissionsUser.firstName} ${permissionsUser.lastName}`}
          role={permissionsUser.role}
          initialPermissions={permissionsUser.permissions}
          onSave={handleSavePermissions}
          onReset={handleResetPermissions}
          submitting={submitting}
        />
      )}

      <ConfirmDialog
        open={Boolean(statusUser)}
        onClose={() => setStatusUser(null)}
        onConfirm={handleToggleStatus}
        title={`${statusUser?.isActive ? 'Deactivate' : 'Activate'} ${statusUser?.firstName ?? ''}?`}
        body={statusUser?.isActive ? 'They will no longer be able to sign in.' : 'They will be able to sign in again.'}
        confirmLabel={statusUser?.isActive ? 'Deactivate' : 'Activate'}
        variant={statusUser?.isActive ? 'danger' : 'primary'}
        loading={submitting}
      />

      <ConfirmDialog
        open={Boolean(deleteUser)}
        onClose={() => {
          setDeleteUser(null);
          setDeleteErrorMessage(null);
        }}
        onConfirm={handleDelete}
        title={`Delete ${deleteUser?.firstName ?? ''} ${deleteUser?.lastName ?? ''}?`}
        body={deleteErrorMessage ?? "This can't be undone."}
        confirmLabel="Delete"
        loading={submitting}
      />
    </div>
  );
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-full border border-navaro-line bg-white px-4 py-1.5">
      <span className="font-medium text-navaro-green">{value}</span> <span className="text-navaro-muted">{label}</span>
    </div>
  );
}
