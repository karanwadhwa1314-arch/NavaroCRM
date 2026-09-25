'use client';

import { MoreVertical, Pencil, ShieldCheck, UserCheck, UserX, Trash2 } from 'lucide-react';
import { Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { useSession } from '@/components/providers/SessionProvider';
import { formatDate } from '@/lib/format';
import { ROLE_LABELS, type UserRole } from '@/lib/constants';
import { PERMISSIONS, type Permission } from '@/lib/permissions';

export interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  lastLogin?: string;
}

interface UserTableProps {
  items: UserRow[];
  onEdit: (u: UserRow) => void;
  onPermissions: (u: UserRow) => void;
  onToggleStatus: (u: UserRow) => void;
  onDelete: (u: UserRow) => void;
}

const ROLE_BADGE_TONE: Record<UserRole, 'green' | 'turquoiseSolid' | 'neutral'> = {
  superadmin: 'green',
  admin: 'turquoiseSolid',
  member: 'neutral',
};

export function UserTable({ items, onEdit, onPermissions, onToggleStatus, onDelete }: UserTableProps) {
  const { user: actor, can } = useSession();

  return (
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>User</TableHeaderCell>
          <TableHeaderCell>Role</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Permissions</TableHeaderCell>
          <TableHeaderCell>Last login</TableHeaderCell>
          <TableHeaderCell className="text-right">Actions</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {items.map((u) => {
          const isSelf = u.id === actor.id;
          const targetIsSuperadmin = u.role === 'superadmin';
          const actorCanModify = actor.role === 'superadmin' || !targetIsSuperadmin;

          return (
            <TableRow key={u.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar firstName={u.firstName} lastName={u.lastName} />
                  <div>
                    <p className="font-medium">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-label text-navaro-muted">{u.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge tone={ROLE_BADGE_TONE[u.role]}>{ROLE_LABELS[u.role]}</Badge>
              </TableCell>
              <TableCell>
                <Badge tone={u.isActive ? 'turquoiseSolid' : 'outline'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
              </TableCell>
              <TableCell>{u.role === 'superadmin' ? 'All' : `${u.permissions.length} of ${PERMISSIONS.length}`}</TableCell>
              <TableCell>{u.lastLogin ? formatDate(u.lastLogin) : 'Never'}</TableCell>
              <TableCell className="text-right">
                {actorCanModify && (can('users.edit') || can('users.delete')) && (
                  <Menu
                    trigger={
                      <IconButton aria-label="Row actions" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </IconButton>
                    }
                  >
                    {can('users.edit') && (
                      <MenuItem onClick={() => onEdit(u)}>
                        <Pencil className="h-4 w-4" /> Edit
                      </MenuItem>
                    )}
                    {actor.role === 'superadmin' && !targetIsSuperadmin && (
                      <MenuItem onClick={() => onPermissions(u)}>
                        <ShieldCheck className="h-4 w-4" /> Permissions
                      </MenuItem>
                    )}
                    {can('users.edit') && !isSelf && (
                      <MenuItem onClick={() => onToggleStatus(u)}>
                        {u.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </MenuItem>
                    )}
                    {can('users.delete') && !isSelf && !targetIsSuperadmin && (
                      <MenuItem danger onClick={() => onDelete(u)}>
                        <Trash2 className="h-4 w-4" /> Delete
                      </MenuItem>
                    )}
                  </Menu>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
