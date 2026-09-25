'use client';

import { useRouter } from 'next/navigation';
import { MoreVertical, Eye, Pencil, Trash2 } from 'lucide-react';
import { Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { ClientStatusBadge, ClientTierBadge } from '@/components/ui/StatusBadge';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { useSession } from '@/components/providers/SessionProvider';
import { formatDate } from '@/lib/format';
import type { ClientStatus, ClientTier } from '@/lib/constants';

export interface ClientRow {
  id: string;
  companyName: string;
  industry?: string;
  primaryContact?: { firstName: string; lastName: string; email: string } | null;
  status: ClientStatus;
  tier: ClientTier;
  accountManager?: { firstName: string; lastName: string } | null;
  createdAt: string;
}

interface ClientTableProps {
  items: ClientRow[];
  onEdit: (client: ClientRow) => void;
  onDelete: (client: ClientRow) => void;
  sort: string;
  order: string;
  onSort: (field: string) => void;
}

export function ClientTable({ items, onEdit, onDelete, sort, order, onSort }: ClientTableProps) {
  const { can } = useSession();
  const router = useRouter();

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell onClick={() => onSort('companyName')}>
                Company {sort === 'companyName' && (order === 'asc' ? '↑' : '↓')}
              </TableHeaderCell>
              <TableHeaderCell>Primary contact</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Tier</TableHeaderCell>
              <TableHeaderCell>Account manager</TableHeaderCell>
              <TableHeaderCell onClick={() => onSort('createdAt')}>
                Created {sort === 'createdAt' && (order === 'asc' ? '↑' : '↓')}
              </TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {items.map((client) => (
              <TableRow key={client.id} onClick={() => router.push(`/clients/${client.id}`)}>
                <TableCell>
                  <p className="font-medium">{client.companyName}</p>
                  {client.industry && <p className="text-label text-navaro-muted">{client.industry}</p>}
                </TableCell>
                <TableCell>
                  {client.primaryContact ? (
                    <>
                      <p>
                        {client.primaryContact.firstName} {client.primaryContact.lastName}
                      </p>
                      <p className="text-label text-navaro-muted">{client.primaryContact.email}</p>
                    </>
                  ) : (
                    <span className="text-navaro-muted">No contact</span>
                  )}
                </TableCell>
                <TableCell>
                  <ClientStatusBadge status={client.status} />
                </TableCell>
                <TableCell>
                  <ClientTierBadge tier={client.tier} />
                </TableCell>
                <TableCell>
                  {client.accountManager ? `${client.accountManager.firstName} ${client.accountManager.lastName}` : '—'}
                </TableCell>
                <TableCell>{formatDate(client.createdAt)}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Menu
                    trigger={
                      <IconButton aria-label="Row actions" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </IconButton>
                    }
                  >
                    <MenuItem onClick={() => router.push(`/clients/${client.id}`)}>
                      <Eye className="h-4 w-4" /> View
                    </MenuItem>
                    {can('clients.edit') && (
                      <MenuItem onClick={() => onEdit(client)}>
                        <Pencil className="h-4 w-4" /> Edit
                      </MenuItem>
                    )}
                    {can('clients.delete') && (
                      <MenuItem danger onClick={() => onDelete(client)}>
                        <Trash2 className="h-4 w-4" /> Delete
                      </MenuItem>
                    )}
                  </Menu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {items.map((client) => (
          <button
            key={client.id}
            onClick={() => router.push(`/clients/${client.id}`)}
            className="rounded-card border border-navaro-line bg-white p-4 text-left"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-navaro-green">{client.companyName}</p>
                {client.industry && <p className="text-label text-navaro-muted">{client.industry}</p>}
              </div>
              <ClientStatusBadge status={client.status} />
            </div>
            <div className="mt-2 flex items-center gap-2 text-label text-navaro-muted">
              <ClientTierBadge tier={client.tier} />
              {formatDate(client.createdAt)}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
