'use client';

import { useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { IconButton } from '@/components/ui/IconButton';

interface CalendarPickerProps {
  value: Date | null;
  onChange: (day: Date) => void;
  /** Days before this are not selectable (defaults to today). */
  minDate?: Date;
  /** Days that already have a broadcast (yyyy-MM-dd) get a marker. */
  markedDays?: Set<string>;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarPicker({ value, onChange, minDate, markedDays }: CalendarPickerProps) {
  const min = startOfDay(minDate ?? new Date());
  const [month, setMonth] = useState(startOfMonth(value ?? min));

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const canGoBack = !isBefore(endOfMonth(subMonths(month, 1)), min);

  return (
    <div className="rounded-card border border-navaro-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <IconButton aria-label="Previous month" size="sm" disabled={!canGoBack} onClick={() => setMonth(subMonths(month, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <p className="text-h3 text-navaro-green" aria-live="polite">
          {format(month, 'MMMM yyyy')}
        </p>
        <IconButton aria-label="Next month" size="sm" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-label text-navaro-muted" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Choose a date">
        {days.map((day) => {
          const disabled = isBefore(day, min);
          const selected = value ? isSameDay(day, value) : false;
          const marked = markedDays?.has(format(day, 'yyyy-MM-dd'));
          return (
            <button
              key={day.toISOString()}
              type="button"
              role="gridcell"
              disabled={disabled}
              aria-selected={selected}
              aria-label={format(day, 'EEEE d MMMM yyyy') + (marked ? ', has a broadcast' : '')}
              onClick={() => onChange(day)}
              className={clsx(
                'relative flex h-10 items-center justify-center rounded-control text-sm transition-colors',
                !isSameMonth(day, month) && 'text-navaro-muted/50',
                disabled && 'cursor-not-allowed opacity-30',
                !disabled && !selected && 'text-navaro-green hover:bg-navaro-hover',
                selected && 'bg-navaro-green font-medium text-navaro-heath',
                isSameDay(day, new Date()) && !selected && 'font-medium ring-1 ring-navaro-green/40'
              )}
            >
              {format(day, 'd')}
              {marked && <span className={clsx('absolute bottom-1 h-1.5 w-1.5 rounded-full', selected ? 'bg-navaro-yellow' : 'bg-navaro-turquoise')} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
