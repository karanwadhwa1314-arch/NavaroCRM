'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useUrlNavigation } from '@/components/layout/UrlNavigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { CLIENT_STATUSES, CLIENT_STATUS_LABELS, CLIENT_TIERS, CLIENT_TIER_LABELS } from '@/lib/constants';

interface AssignableUser {
  id: string;
  firstName: string;
  lastName: string;
}

const FILTER_KEYS = ['search', 'status', 'tier', 'accountManager', 'industry'];

export function ClientFilters({ users }: { users: AssignableUser[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { navigate } = useUrlNavigation();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [industry, setIndustry] = useState(searchParams.get('industry') ?? '');
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

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (industry !== (searchParams.get('industry') ?? '')) updateParam('industry', industry);
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industry]);

  const activeCount = FILTER_KEYS.filter((k) => searchParams.get(k)).length;

  function clearAll() {
    setSearch('');
    setIndustry('');
    navigate(pathname);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navaro-muted" />
        <Input placeholder="Search clients" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Select value={searchParams.get('status') ?? ''} onChange={(e) => updateParam('status', e.target.value)} className="w-full sm:w-36">
        <option value="">All statuses</option>
        {CLIENT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {CLIENT_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>

      <Select value={searchParams.get('tier') ?? ''} onChange={(e) => updateParam('tier', e.target.value)} className="w-full sm:w-36">
        <option value="">All tiers</option>
        {CLIENT_TIERS.map((t) => (
          <option key={t} value={t}>
            {CLIENT_TIER_LABELS[t]}
          </option>
        ))}
      </Select>

      <Select
        value={searchParams.get('accountManager') ?? ''}
        onChange={(e) => updateParam('accountManager', e.target.value)}
        className="w-full sm:w-44"
      >
        <option value="">Any account manager</option>
        <option value="me">Me</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.firstName} {u.lastName}
          </option>
        ))}
      </Select>

      <Input placeholder="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full sm:w-36" />

      {activeCount > 0 && (
        <button type="button" onClick={clearAll} className="inline-flex items-center gap-1 text-sm text-navaro-green hover:underline">
          <X className="h-3.5 w-3.5" />
          Clear filters ({activeCount})
        </button>
      )}
    </div>
  );
}
