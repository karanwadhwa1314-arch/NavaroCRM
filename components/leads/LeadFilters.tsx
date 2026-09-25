'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useUrlNavigation } from '@/components/layout/UrlNavigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LEAD_STAGES, LEAD_STAGE_LABELS, LEAD_SOURCES, LEAD_SOURCE_LABELS, PRIORITIES, PRIORITY_LABELS } from '@/lib/constants';

interface AssignableUser {
  id: string;
  firstName: string;
  lastName: string;
}

const FILTER_KEYS = ['search', 'stage', 'source', 'priority', 'assignedTo'];

export function LeadFilters({ users }: { users: AssignableUser[] }) {
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

  function clearAll() {
    setSearch('');
    navigate(pathname);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navaro-muted" />
        <Input
          placeholder="Search leads"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select
        value={searchParams.get('stage') ?? ''}
        onChange={(e) => updateParam('stage', e.target.value)}
        className="w-full sm:w-40"
      >
        <option value="">All stages</option>
        {LEAD_STAGES.map((s) => (
          <option key={s} value={s}>
            {LEAD_STAGE_LABELS[s]}
          </option>
        ))}
      </Select>

      <Select
        value={searchParams.get('source') ?? ''}
        onChange={(e) => updateParam('source', e.target.value)}
        className="w-full sm:w-40"
      >
        <option value="">All sources</option>
        {LEAD_SOURCES.map((s) => (
          <option key={s} value={s}>
            {LEAD_SOURCE_LABELS[s]}
          </option>
        ))}
      </Select>

      <Select
        value={searchParams.get('priority') ?? ''}
        onChange={(e) => updateParam('priority', e.target.value)}
        className="w-full sm:w-36"
      >
        <option value="">All priorities</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </option>
        ))}
      </Select>

      <Select
        value={searchParams.get('assignedTo') ?? ''}
        onChange={(e) => updateParam('assignedTo', e.target.value)}
        className="w-full sm:w-44"
      >
        <option value="">Anyone</option>
        <option value="me">Me</option>
        <option value="unassigned">Unassigned</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.firstName} {u.lastName}
          </option>
        ))}
      </Select>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="inline-flex items-center gap-1 text-sm text-navaro-green hover:underline"
        >
          <X className="h-3.5 w-3.5" />
          Clear filters ({activeCount})
        </button>
      )}
    </div>
  );
}
