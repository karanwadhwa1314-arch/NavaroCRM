import type { CardRecurrenceType } from '@/lib/constants';

export interface Recurrence {
  type: CardRecurrenceType;
  daysOfWeek?: number[];
  dayOfMonth?: number | null;
}

/**
 * The calendar day of the next occurrence of a recurring card, anchored on the day the previous one was
 * completed (not on its old deadline). Returns midnight local time; the caller re-applies the original
 * time of day. Monthly recurrences clamp to the last day of short months (31st → 30th/28th/29th).
 */
export function computeNextOccurrenceDate(recurrence: Recurrence, from: Date = new Date()): Date | null {
  const today = new Date(from);
  today.setHours(0, 0, 0, 0);

  if (recurrence.type === 'daily') {
    const next = new Date(today);
    next.setDate(next.getDate() + 1);
    return next;
  }

  if (recurrence.type === 'weekly') {
    const days = recurrence.daysOfWeek ?? [];
    for (let offset = 1; offset <= 7; offset++) {
      const candidate = new Date(today);
      candidate.setDate(candidate.getDate() + offset);
      if (days.includes(candidate.getDay())) return candidate;
    }
    const fallback = new Date(today);
    fallback.setDate(fallback.getDate() + 7);
    return fallback;
  }

  if (recurrence.type === 'monthly' && recurrence.dayOfMonth) {
    const targetMonth = today.getMonth() + 1;
    const targetYear = today.getFullYear() + Math.floor(targetMonth / 12);
    const month = targetMonth % 12;
    const lastDay = new Date(targetYear, month + 1, 0).getDate();
    return new Date(targetYear, month, Math.min(recurrence.dayOfMonth, lastDay));
  }

  return null;
}
