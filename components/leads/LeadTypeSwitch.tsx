'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Building2, UserRound } from 'lucide-react';
import { clsx } from 'clsx';
import { useUrlNavigation } from '@/components/layout/UrlNavigation';
import { LEAD_TYPES, LEAD_TYPE_LABELS, type LeadType } from '@/lib/constants';

const ICONS = { individual: UserRound, company: Building2 } as const;

interface Props {
  active: LeadType;
  counts: Record<LeadType, number>;
}

/** The big Individuals / Companies switch at the top of the Leads page. The choice lives in the URL (?type=company). */
export function LeadTypeSwitch({ active, counts }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { navigate } = useUrlNavigation();

  function choose(type: LeadType) {
    if (type === active) return;
    const params = new URLSearchParams(searchParams.toString());
    if (type === 'individual') params.delete('type');
    else params.set('type', type);
    params.set('page', '1');
    navigate(`${pathname}?${params.toString()}`);
  }

  return (
    <div role="tablist" aria-label="Lead type" className="grid w-full grid-cols-2 gap-1 rounded-card border-2 border-navaro-green bg-white p-1 sm:inline-grid sm:w-auto">
      {LEAD_TYPES.map((type) => {
        const Icon = ICONS[type];
        const selected = type === active;
        return (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => choose(type)}
            className={clsx(
              'flex h-12 items-center justify-center gap-2.5 rounded-control px-4 text-h3 transition-colors sm:px-8',
              selected ? 'bg-navaro-green text-navaro-heath' : 'text-navaro-green hover:bg-navaro-hover'
            )}
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            {LEAD_TYPE_LABELS[type]}
            <span
              className={clsx(
                'rounded-full px-2 py-0.5 text-label font-medium',
                selected ? 'bg-navaro-turquoise text-navaro-green' : 'bg-navaro-hover text-navaro-green'
              )}
            >
              {counts[type].toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
