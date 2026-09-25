'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MoreVertical, Eye, Pencil, Trash2 } from 'lucide-react';
import { Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { LeadStageBadge, PriorityBadge } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { useSession } from '@/components/providers/SessionProvider';
import { formatDate } from '@/lib/format';

export interface LeadRow {
  id: string;
  fullName: string;
  email: string;
  company: string;
  stage: import('@/lib/constants').LeadStage;
  priority: import('@/lib/constants').Priority;
  assignedTo?: { firstName: string; lastName: string } | null;
  convertedToClient?: { id: string; companyName: string } | string | null;
  createdAt: string;
}

interface LeadTableProps {
  items: LeadRow[];
  onEdit: (lead: LeadRow) => void;
  onDelete: (lead: LeadRow) => void;
  sort: string;
  order: string;
  onSort: (field: string) => void;
}

export function LeadTable({ items, onEdit, onDelete, sort, order, onSort }: LeadTableProps) {
  const { can } = useSession();
  const router = useRouter();

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Lead</TableHeaderCell>
              <TableHeaderCell onClick={() => onSort('company')}>
                Company {sort === 'company' && (order === 'asc' ? '↑' : '↓')}
              </TableHeaderCell>
              <TableHeaderCell>Stage</TableHeaderCell>
              <TableHeaderCell>Priority</TableHeaderCell>
              <TableHeaderCell>Assigned to</TableHeaderCell>
              <TableHeaderCell onClick={() => onSort('createdAt')}>
                Created {sort === 'createdAt' && (order === 'asc' ? '↑' : '↓')}
              </TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {items.map((lead) => {
              const convertedClient =
                lead.convertedToClient && typeof lead.convertedToClient === 'object' ? lead.convertedToClient : null;
              return (
                <TableRow key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)}>
                  <TableCell>
                    <p className="font-medium">{lead.fullName}</p>
                    <p className="text-label text-navaro-muted">{lead.email}</p>
                  </TableCell>
                  <TableCell>
                    {lead.company}
                    {convertedClient && (
                      <Link
                        href={`/clients/${convertedClient.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="ml-2 inline-block"
                      >
                        <Badge tone="turquoise">Converted</Badge>
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>
                    <LeadStageBadge stage={lead.stage} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={lead.priority} />
                  </TableCell>
                  <TableCell>
                    {lead.assignedTo ? (
                      <span className="flex items-center gap-2">
                        <Avatar firstName={lead.assignedTo.firstName} lastName={lead.assignedTo.lastName} size={24} />
                        {lead.assignedTo.firstName} {lead.assignedTo.lastName}
                      </span>
                    ) : (
                      <span className="text-navaro-muted">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(lead.createdAt)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Menu
                      trigger={
                        <IconButton aria-label="Row actions" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </IconButton>
                      }
                    >
                      <MenuItem onClick={() => router.push(`/leads/${lead.id}`)}>
                        <Eye className="h-4 w-4" /> View
                      </MenuItem>
                      {can('leads.edit') && (
                        <MenuItem onClick={() => onEdit(lead)}>
                          <Pencil className="h-4 w-4" /> Edit
                        </MenuItem>
                      )}
                      {can('leads.delete') && (
                        <MenuItem danger onClick={() => onDelete(lead)}>
                          <Trash2 className="h-4 w-4" /> Delete
                        </MenuItem>
                      )}
                    </Menu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {items.map((lead) => (
          <button
            key={lead.id}
            onClick={() => router.push(`/leads/${lead.id}`)}
            className="rounded-card border border-navaro-line bg-white p-4 text-left"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-navaro-green">{lead.fullName}</p>
                <p className="text-label text-navaro-muted">{lead.company}</p>
              </div>
              <LeadStageBadge stage={lead.stage} />
            </div>
            <div className="mt-2 flex items-center gap-2 text-label text-navaro-muted">
              <PriorityBadge priority={lead.priority} />
              {formatDate(lead.createdAt)}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
