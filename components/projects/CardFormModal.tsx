'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { CARD_RECURRENCE_LABELS, CARD_RECURRENCE_TYPES, CARD_STATUSES, CARD_STATUS_LABELS, type CardRecurrenceType, type CardStatus } from '@/lib/constants';

export interface CardRecord {
  id: string;
  title: string;
  description?: string;
  fileLink?: string;
  status: CardStatus;
  deadline: string | null;
  doneAt: string | null;
  assignees: { id: string; firstName: string; lastName: string }[];
  createdBy: { firstName: string; lastName: string } | null;
  recurrence: { type: CardRecurrenceType; daysOfWeek: number[]; dayOfMonth: number | null };
}

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
}

export interface CardFormValues {
  title: string;
  description: string;
  fileLink: string;
  status: CardStatus;
  /** `yyyy-MM-ddTHH:mm` in the browser's timezone, or ''. */
  deadline: string;
  assignees: string[];
  recurrenceType: CardRecurrenceType;
  daysOfWeek: number[];
  dayOfMonth: string;
}

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function emptyValues(): CardFormValues {
  return { title: '', description: '', fileLink: '', status: 'todo', deadline: '', assignees: [], recurrenceType: 'none', daysOfWeek: [], dayOfMonth: '' };
}

function valuesFromCard(card: CardRecord): CardFormValues {
  return {
    title: card.title,
    description: card.description ?? '',
    fileLink: card.fileLink ?? '',
    status: card.status,
    deadline: toLocalInput(card.deadline),
    assignees: card.assignees.map((a) => a.id),
    recurrenceType: card.recurrence.type,
    daysOfWeek: card.recurrence.daysOfWeek,
    dayOfMonth: card.recurrence.dayOfMonth != null ? String(card.recurrence.dayOfMonth) : '',
  };
}

interface CardFormModalProps {
  open: boolean;
  onClose: () => void;
  card: CardRecord | null;
  members: Member[];
  submitting: boolean;
  fieldErrors: Record<string, string>;
  onSubmit: (values: CardFormValues) => Promise<void>;
}

export function CardFormModal({ open, onClose, card, members, submitting, fieldErrors, onSubmit }: CardFormModalProps) {
  const [values, setValues] = useState<CardFormValues>(emptyValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setValues(card ? valuesFromCard(card) : emptyValues());
      setErrors({});
    }
  }, [open, card]);

  function set<K extends keyof CardFormValues>(key: K, value: CardFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toggleAssignee(id: string) {
    set('assignees', values.assignees.includes(id) ? values.assignees.filter((a) => a !== id) : [...values.assignees, id]);
  }

  function toggleDay(day: number) {
    set('daysOfWeek', values.daysOfWeek.includes(day) ? values.daysOfWeek.filter((d) => d !== day) : [...values.daysOfWeek, day]);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!values.title.trim()) e.title = 'Title is required';
    if (values.status === 'in_progress' && !values.deadline) e.deadline = 'A deadline is required for an in-progress card';
    if (values.assignees.length === 0) e.assignees = 'Select at least one team member';
    if (values.fileLink.trim() && !/^https?:\/\/\S+$/i.test(values.fileLink.trim())) e.fileLink = 'File link must be a valid http(s) URL';
    if (values.recurrenceType === 'weekly' && values.daysOfWeek.length === 0) e.daysOfWeek = 'Select at least one weekday';
    if (values.recurrenceType === 'monthly') {
      const day = parseInt(values.dayOfMonth, 10);
      if (!day || day < 1 || day > 31) e.dayOfMonth = 'Enter a day between 1 and 31';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    await onSubmit(values);
  }

  const all = { ...errors, ...fieldErrors };

  return (
    <Modal open={open} onClose={onClose} title={card ? 'Edit card' : 'Add card'} size="lg" preventClose={submitting}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {card?.createdBy && (
          <p className="text-label text-navaro-muted">
            Created by {card.createdBy.firstName} {card.createdBy.lastName}
          </p>
        )}

        <Field label="Title" required error={all.title}>
          {(p) => <Input {...p} value={values.title} maxLength={200} onChange={(e) => set('title', e.target.value)} error={Boolean(all.title)} />}
        </Field>

        <Field label="Description" error={all.description} hint={`${values.description.length}/500`}>
          {(p) => <Textarea {...p} rows={3} maxLength={500} value={values.description} onChange={(e) => set('description', e.target.value)} />}
        </Field>

        <Field label="File link" error={all.fileLink} hint="Optional. For example a Google Drive link.">
          {(p) => (
            <Input {...p} type="url" placeholder="https://drive.google.com/…" value={values.fileLink} onChange={(e) => set('fileLink', e.target.value)} error={Boolean(all.fileLink)} />
          )}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Status" error={all.status}>
            {(p) => (
              <Select {...p} value={values.status} onChange={(e) => set('status', e.target.value as CardStatus)}>
                {CARD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CARD_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Deadline"
            required={values.status === 'in_progress'}
            error={all.deadline}
            hint={values.status === 'in_progress' ? undefined : 'Optional while the card is to do.'}
          >
            {(p) => <Input {...p} type="datetime-local" value={values.deadline} onChange={(e) => set('deadline', e.target.value)} error={Boolean(all.deadline)} />}
          </Field>
        </div>

        <Field label="Repeat" error={all.recurrence}>
          {(p) => (
            <Select
              {...p}
              value={values.recurrenceType}
              onChange={(e) => setValues((v) => ({ ...v, recurrenceType: e.target.value as CardRecurrenceType, daysOfWeek: [], dayOfMonth: '' }))}
            >
              {CARD_RECURRENCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CARD_RECURRENCE_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {values.recurrenceType !== 'none' && (
          <p className="-mt-2 text-label text-navaro-muted">When this card is marked done, the next one is created automatically.</p>
        )}

        {values.recurrenceType === 'weekly' && (
          <fieldset>
            <legend className="mb-1.5 text-label font-medium text-navaro-green">Repeat on</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map(({ value, label }) => {
                const on = values.daysOfWeek.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(value)}
                    className={`h-8 rounded-control border px-3 text-sm ${
                      on ? 'border-navaro-green bg-navaro-green text-navaro-heath' : 'border-navaro-line bg-white text-navaro-green hover:bg-navaro-hover'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {all.daysOfWeek && <p className="mt-1.5 text-label text-danger">{all.daysOfWeek}</p>}
          </fieldset>
        )}

        {values.recurrenceType === 'monthly' && (
          <Field label="Day of month" error={all.dayOfMonth} hint="Months with fewer days use their last day.">
            {(p) => (
              <Input {...p} type="number" min={1} max={31} className="sm:w-32" value={values.dayOfMonth} onChange={(e) => set('dayOfMonth', e.target.value)} error={Boolean(all.dayOfMonth)} />
            )}
          </Field>
        )}

        <fieldset>
          <legend className="mb-1.5 text-label font-medium text-navaro-green">
            Assigned team members<span className="text-danger"> *</span>
          </legend>
          {members.length === 0 ? (
            <p className="text-sm text-navaro-muted">Add team members or a project manager to this project before assigning cards.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {members.map((m) => (
                <li key={m.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-sm text-navaro-green hover:bg-navaro-hover">
                    <Checkbox aria-label={`Assign ${m.firstName} ${m.lastName}`} checked={values.assignees.includes(m.id)} onChange={() => toggleAssignee(m.id)} />
                    {m.firstName} {m.lastName}
                  </label>
                </li>
              ))}
            </ul>
          )}
          {all.assignees && <p className="mt-1.5 text-label text-danger">{all.assignees}</p>}
        </fieldset>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={members.length === 0}>
            {card ? 'Save card' : 'Add card'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
