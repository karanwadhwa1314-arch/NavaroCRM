import { describe, it, expect } from 'vitest';
import { calculateDeadlineHealth, getHealthLevel, MIN_HEALTH } from '@/lib/project-health';
import { buildProjectNaming, codeSequence, formatProjectCode, validateMotive } from '@/lib/project-naming';
import { computeNextOccurrenceDate } from '@/lib/card-recurrence';
import { createCardSchema, createProjectSchema } from '@/lib/validation/project';

const NOW = new Date('2026-06-10T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

describe('deadline health', () => {
  it('is 100% with no cards, no deadlines, or only future deadlines', () => {
    expect(calculateDeadlineHealth([], NOW)).toBe(100);
    expect(calculateDeadlineHealth([{ status: 'todo' }], NOW)).toBe(100);
    expect(calculateDeadlineHealth([{ status: 'in_progress', deadline: hoursAhead(1) }], NOW)).toBe(100);
  });

  it('costs 5% the moment a deadline is missed, then 5% per further full 24h', () => {
    const at = (h: number) => calculateDeadlineHealth([{ status: 'todo', deadline: hoursAgo(h) }], NOW);
    expect(at(0.01)).toBe(95);
    expect(at(23.9)).toBe(95);
    expect(at(24)).toBe(90);
    expect(at(48.1)).toBe(85);
  });

  it('adds up across cards and ignores Done cards', () => {
    const health = calculateDeadlineHealth(
      [
        { status: 'todo', deadline: hoursAgo(1) },
        { status: 'in_progress', deadline: hoursAgo(30) },
        { status: 'done', deadline: hoursAgo(500) },
      ],
      NOW
    );
    expect(health).toBe(100 - 5 - 10);
  });

  it('never drops below the floor', () => {
    const cards = Array.from({ length: 40 }, () => ({ status: 'todo' as const, deadline: hoursAgo(100) }));
    expect(calculateDeadlineHealth(cards, NOW)).toBe(MIN_HEALTH);
  });

  it('maps a percentage to a level at the documented boundaries', () => {
    expect(getHealthLevel(100)).toBe('perfect');
    expect(getHealthLevel(99)).toBe('good');
    expect(getHealthLevel(80)).toBe('good');
    expect(getHealthLevel(79)).toBe('average');
    expect(getHealthLevel(40)).toBe('average');
    expect(getHealthLevel(39)).toBe('critical');
    expect(getHealthLevel(20)).toBe('critical');
  });
});

describe('project naming', () => {
  it('builds Client-Motive names and CLI-MOT code prefixes', () => {
    const r = buildProjectNaming('Acme Trading Co.', 'Spice sourcing');
    expect(r).toEqual({ ok: true, name: 'Acme-Trading-Co.-Spice sourcing', codePrefix: 'ACM-SPI' });
  });

  it('rejects a motive with fewer than 3 letters, however long it is', () => {
    expect(validateMotive('12-3').valid).toBe(false);
    expect(validateMotive('  ').valid).toBe(false);
    expect(validateMotive('Q4 ops').valid).toBe(true);
    expect(buildProjectNaming('Acme', 'ab')).toMatchObject({ ok: false, field: 'motive' });
  });

  it('rejects a client whose name has too few letters to make a code', () => {
    expect(buildProjectNaming('3M', 'Logistics')).toMatchObject({ ok: false, field: 'client' });
  });

  it('formats and parses running numbers', () => {
    expect(formatProjectCode('ACM-SPI', 7)).toBe('ACM-SPI-007');
    expect(formatProjectCode('ACM-SPI', 1234)).toBe('ACM-SPI-1234');
    expect(codeSequence('ACM-SPI-007')).toBe(7);
    expect(codeSequence('garbage')).toBe(0);
  });
});

describe('card recurrence', () => {
  const at = (iso: string) => new Date(iso);
  const ymd = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null);

  it('daily → the next day', () => {
    expect(ymd(computeNextOccurrenceDate({ type: 'daily' }, at('2026-06-10T15:00:00')))).toBe('2026-06-11');
  });

  it('weekly → the next selected weekday strictly after the completion day', () => {
    // 2026-06-10 is a Wednesday (3). Mon(1) and Fri(5) selected → Friday 12th.
    expect(ymd(computeNextOccurrenceDate({ type: 'weekly', daysOfWeek: [1, 5] }, at('2026-06-10T09:00:00')))).toBe('2026-06-12');
    // Completed on a selected day → the next one, not the same day.
    expect(ymd(computeNextOccurrenceDate({ type: 'weekly', daysOfWeek: [3] }, at('2026-06-10T09:00:00')))).toBe('2026-06-17');
  });

  it('monthly → next month, clamped to its last day', () => {
    expect(ymd(computeNextOccurrenceDate({ type: 'monthly', dayOfMonth: 15 }, at('2026-06-10T09:00:00')))).toBe('2026-07-15');
    expect(ymd(computeNextOccurrenceDate({ type: 'monthly', dayOfMonth: 31 }, at('2026-01-10T09:00:00')))).toBe('2026-02-28');
    expect(ymd(computeNextOccurrenceDate({ type: 'monthly', dayOfMonth: 31 }, at('2027-12-05T09:00:00')))).toBe('2028-01-31');
  });

  it('none → no next occurrence', () => {
    expect(computeNextOccurrenceDate({ type: 'none' })).toBeNull();
  });
});

describe('project and card validation', () => {
  const id = '65f000000000000000000001';

  it('a bare date for startDate is pinned to noon UTC so it never slides a day', () => {
    const parsed = createProjectSchema.parse({ client: id, motive: 'Sourcing', startDate: '2026-03-01' });
    expect(parsed.startDate.toISOString()).toBe('2026-03-01T12:00:00.000Z');
  });

  it('requires a start date and a valid client id', () => {
    expect(createProjectSchema.safeParse({ client: id, motive: 'Sourcing' }).success).toBe(false);
    expect(createProjectSchema.safeParse({ client: 'nope', motive: 'Sourcing', startDate: '2026-03-01' }).success).toBe(false);
  });

  it('cards need a title and at least one assignee', () => {
    expect(createCardSchema.safeParse({ title: 'x', assignees: [] }).success).toBe(false);
    expect(createCardSchema.safeParse({ title: ' ', assignees: [id] }).success).toBe(false);
    expect(createCardSchema.safeParse({ title: 'x', assignees: [id] }).success).toBe(true);
  });

  it('card description is capped at 500 and file links must be http(s)', () => {
    expect(createCardSchema.safeParse({ title: 'x', assignees: [id], description: 'a'.repeat(501) }).success).toBe(false);
    expect(createCardSchema.safeParse({ title: 'x', assignees: [id], fileLink: 'javascript:alert(1)' }).success).toBe(false);
    expect(createCardSchema.safeParse({ title: 'x', assignees: [id], fileLink: 'https://drive.google.com/x' }).success).toBe(true);
    expect(createCardSchema.safeParse({ title: 'x', assignees: [id], fileLink: '' }).success).toBe(true);
  });

  it('weekly recurrence needs weekdays; monthly needs a day of month', () => {
    expect(createCardSchema.safeParse({ title: 'x', assignees: [id], recurrence: { type: 'weekly', daysOfWeek: [] } }).success).toBe(false);
    expect(createCardSchema.safeParse({ title: 'x', assignees: [id], recurrence: { type: 'monthly' } }).success).toBe(false);
    expect(createCardSchema.safeParse({ title: 'x', assignees: [id], recurrence: { type: 'weekly', daysOfWeek: [1] } }).success).toBe(true);
  });

  it('an empty deadline string means no deadline', () => {
    const parsed = createCardSchema.parse({ title: 'x', assignees: [id], deadline: '' });
    expect(parsed.deadline).toBeNull();
  });
});
