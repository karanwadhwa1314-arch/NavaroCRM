'use client';

import { useRouter } from 'next/navigation';
import { MoreVertical, Eye, Trash2 } from 'lucide-react';
import { Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { ProjectStatusBadge, PriorityBadge } from '@/components/ui/StatusBadge';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { HealthMeter } from '@/components/projects/HealthMeter';
import { useSession } from '@/components/providers/SessionProvider';
import { formatDate } from '@/lib/format';
import type { Priority, ProjectHealthLevel, ProjectStatus } from '@/lib/constants';

export interface ProjectRow {
  id: string;
  name: string;
  code: string;
  client: { id: string; companyName: string } | null;
  status: ProjectStatus;
  priority: Priority;
  startDate: string;
  projectManager: { firstName: string; lastName: string } | null;
  deadlineHealth: number;
  healthLevel: ProjectHealthLevel;
  cardCounts: { todo: number; in_progress: number; done: number; total: number };
}

interface ProjectTableProps {
  items: ProjectRow[];
  onDelete: (project: ProjectRow) => void;
  sort?: string;
  order: string;
  onSort: (field: string) => void;
}

function Progress({ counts }: { counts: ProjectRow['cardCounts'] }) {
  if (counts.total === 0) return <span className="text-navaro-muted">No cards</span>;
  return (
    <span>
      {counts.done} of {counts.total} done
    </span>
  );
}

export function ProjectTable({ items, onDelete, sort, order, onSort }: ProjectTableProps) {
  const { can } = useSession();
  const router = useRouter();
  const arrow = (field: string) => (sort === field ? (order === 'asc' ? ' ↑' : ' ↓') : '');

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell onClick={() => onSort('name')}>Project{arrow('name')}</TableHeaderCell>
              <TableHeaderCell onClick={() => onSort('status')}>Status{arrow('status')}</TableHeaderCell>
              <TableHeaderCell>Health</TableHeaderCell>
              <TableHeaderCell>Cards</TableHeaderCell>
              <TableHeaderCell>Project manager</TableHeaderCell>
              <TableHeaderCell onClick={() => onSort('priority')}>Priority{arrow('priority')}</TableHeaderCell>
              <TableHeaderCell onClick={() => onSort('startDate')}>Start date{arrow('startDate')}</TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {items.map((project) => (
              <TableRow key={project.id} onClick={() => router.push(`/projects/${project.id}`)}>
                <TableCell>
                  <p className="font-medium">{project.name}</p>
                  <p className="text-label text-navaro-muted">
                    {project.code} · {project.client?.companyName ?? 'Client removed'}
                  </p>
                </TableCell>
                <TableCell>
                  <ProjectStatusBadge status={project.status} />
                </TableCell>
                <TableCell>
                  <HealthMeter percentage={project.deadlineHealth} level={project.healthLevel} />
                </TableCell>
                <TableCell>
                  <Progress counts={project.cardCounts} />
                </TableCell>
                <TableCell>{project.projectManager ? `${project.projectManager.firstName} ${project.projectManager.lastName}` : 'Unassigned'}</TableCell>
                <TableCell>
                  <PriorityBadge priority={project.priority} />
                </TableCell>
                <TableCell>{formatDate(project.startDate)}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Menu
                    trigger={
                      <IconButton aria-label={`Actions for ${project.name}`} size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </IconButton>
                    }
                  >
                    <MenuItem onClick={() => router.push(`/projects/${project.id}`)}>
                      <Eye className="h-4 w-4" /> View
                    </MenuItem>
                    {can('projects.delete') && (
                      <MenuItem danger onClick={() => onDelete(project)}>
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
        {items.map((project) => (
          <button
            key={project.id}
            onClick={() => router.push(`/projects/${project.id}`)}
            className="rounded-card border border-navaro-line bg-white p-4 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-navaro-green">{project.name}</p>
                <p className="text-label text-navaro-muted">
                  {project.code} · {project.client?.companyName ?? 'Client removed'}
                </p>
              </div>
              <ProjectStatusBadge status={project.status} />
            </div>
            <div className="mt-3">
              <HealthMeter percentage={project.deadlineHealth} level={project.healthLevel} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-navaro-muted">
              <PriorityBadge priority={project.priority} />
              <Progress counts={project.cardCounts} />
              <span>Started {formatDate(project.startDate)}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
