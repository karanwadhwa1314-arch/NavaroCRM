'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useUrlNavigation } from '@/components/layout/UrlNavigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PRIORITIES, PRIORITY_LABELS, PROJECT_STATUSES, PROJECT_STATUS_LABELS } from '@/lib/constants';

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}
interface ClientOption {
  id: string;
  companyName: string;
}

const FILTER_KEYS = ['search', 'status', 'priority', 'client', 'projectManager', 'teamMember'];

export function ProjectFilters({ clients, users }: { clients: ClientOption[]; users: UserOption[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { navigate } = useUrlNavigation();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    navigate(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (search !== (searchParams.get('search') ?? '')) updateParam('search', search);
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const activeCount = FILTER_KEYS.filter((k) => searchParams.get(k)).length;
  const mine = searchParams.get('teamMember') === 'me';

  function clearAll() {
    setSearch('');
    navigate(pathname);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navaro-muted" aria-hidden="true" />
        <Input
          aria-label="Search projects"
          placeholder="Search name, code or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select aria-label="Filter by client" value={searchParams.get('client') ?? ''} onChange={(e) => updateParam('client', e.target.value)} className="w-full sm:w-44">
        <option value="">All clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.companyName}
          </option>
        ))}
      </Select>

      <Select aria-label="Filter by status" value={searchParams.get('status') ?? ''} onChange={(e) => updateParam('status', e.target.value)} className="w-full sm:w-36">
        <option value="">All statuses</option>
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {PROJECT_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>

      <Select aria-label="Filter by priority" value={searchParams.get('priority') ?? ''} onChange={(e) => updateParam('priority', e.target.value)} className="w-full sm:w-36">
        <option value="">All priorities</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filter by project manager"
        value={searchParams.get('projectManager') ?? ''}
        onChange={(e) => updateParam('projectManager', e.target.value)}
        className="w-full sm:w-40"
      >
        <option value="">Any manager</option>
        <option value="me">Me</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.firstName} {u.lastName}
          </option>
        ))}
      </Select>

      <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-navaro-green">
        <input
          type="checkbox"
          checked={mine}
          onChange={(e) => updateParam('teamMember', e.target.checked ? 'me' : '')}
          className="h-4 w-4 rounded border-navaro-line accent-[#054742]"
        />
        My projects
      </label>

      {activeCount > 0 && (
        <button type="button" onClick={clearAll} className="inline-flex items-center gap-1 text-sm text-navaro-green hover:underline">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear filters ({activeCount})
        </button>
      )}
    </div>
  );
}
