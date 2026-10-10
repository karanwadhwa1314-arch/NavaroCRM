'use client';

import { useMemo, useState } from 'react';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { PRIORITIES, PRIORITY_LABELS, type Priority } from '@/lib/constants';
import { buildProjectNaming, deriveCodeClientPrefix, deriveCodeMotivePrefix, deriveNameClientPart, validateMotive } from '@/lib/project-naming';

export interface ProjectFormValues {
  client: string;
  motive: string;
  description: string;
  startDate: string;
  priority: Priority;
  projectManager: string;
  notes: string;
}

interface Option {
  id: string;
  firstName: string;
  lastName: string;
}
interface ClientOption {
  id: string;
  companyName: string;
}

interface ProjectFormProps {
  mode: 'create' | 'edit';
  clients: ClientOption[];
  users: Option[];
  isAdmin: boolean;
  initial?: Partial<ProjectFormValues>;
  /** Edit mode: the project's code is fixed once issued. */
  code?: string;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  fieldErrors?: Record<string, string>;
}

export function todayInputValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ProjectForm({ mode, clients, users, isAdmin, initial, code, onSubmit, onCancel, submitting, fieldErrors = {} }: ProjectFormProps) {
  const [values, setValues] = useState<ProjectFormValues>({
    client: initial?.client ?? '',
    motive: initial?.motive ?? '',
    description: initial?.description ?? '',
    startDate: initial?.startDate ?? todayInputValue(),
    priority: initial?.priority ?? 'medium',
    projectManager: initial?.projectManager ?? '',
    notes: initial?.notes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [motiveTouched, setMotiveTouched] = useState(false);

  const client = useMemo(() => clients.find((c) => c.id === values.client), [clients, values.client]);
  const namePrefix = client ? `${deriveNameClientPart(client.companyName)}-` : '';
  const motiveCheck = validateMotive(values.motive);
  const naming = client ? buildProjectNaming(client.companyName, values.motive) : null;

  const codePreview =
    mode === 'edit' && code
      ? code
      : client
        ? `${deriveCodeClientPrefix(client.companyName)}-${deriveCodeMotivePrefix(values.motive) || '···'}-···`
        : 'Choose a client first';

  function set<K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!values.client) e.client = 'Select a client';
    else if (naming && !naming.ok && naming.field === 'client') e.client = naming.error;
    if (!motiveCheck.valid) e.motive = motiveCheck.error;
    if (!values.startDate) e.startDate = 'Start date is required';
    setErrors(e);
    setMotiveTouched(true);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    await onSubmit(values);
  }

  const all = { ...errors, ...fieldErrors };
  const motiveError = all.motive ?? (motiveTouched && values.motive && !motiveCheck.valid ? motiveCheck.error : undefined);

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Client" required error={all.client} className="sm:col-span-2" hint={mode === 'edit' ? 'The client cannot be changed after the project is created.' : undefined}>
          {(p) => (
            <Select {...p} value={values.client} onChange={(e) => set('client', e.target.value)} disabled={mode === 'edit'} error={Boolean(all.client)}>
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Project name"
          required
          error={motiveError}
          hint={
            !client
              ? 'Select a client first.'
              : naming && naming.ok
                ? `Saved as “${naming.name}”`
                : 'Add a motive of at least 3 letters, for example “Spice sourcing”.'
          }
          className="sm:col-span-2"
        >
          {(p) => (
            <div className="flex">
              <span className="inline-flex max-w-[55%] items-center truncate rounded-l-control border border-r-0 border-navaro-line bg-navaro-skeleton px-3 text-sm text-navaro-muted">
                {namePrefix || '—'}
              </span>
              <Input
                {...p}
                value={values.motive}
                disabled={!client}
                onChange={(e) => set('motive', e.target.value)}
                onBlur={() => setMotiveTouched(true)}
                placeholder="Motive"
                maxLength={100}
                error={Boolean(motiveError)}
                className="rounded-l-none"
              />
            </div>
          )}
        </Field>

        <Field label="Project code" hint={mode === 'create' ? 'Assigned automatically when you save.' : 'Fixed once issued, even if the name changes.'}>
          {(p) => <Input {...p} value={codePreview} readOnly tabIndex={-1} className="bg-navaro-skeleton font-mono" />}
        </Field>

        <Field label="Start date" required error={all.startDate}>
          {(p) => <Input {...p} type="date" value={values.startDate} onChange={(e) => set('startDate', e.target.value)} error={Boolean(all.startDate)} />}
        </Field>

        <Field label="Priority" error={all.priority}>
          {(p) => (
            <Select {...p} value={values.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
              {PRIORITIES.map((pr) => (
                <option key={pr} value={pr}>
                  {PRIORITY_LABELS[pr]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {isAdmin ? (
          <Field label="Project manager" error={all.projectManager}>
            {(p) => (
              <Select {...p} value={values.projectManager} onChange={(e) => set('projectManager', e.target.value)}>
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          mode === 'create' && (
            <p className="self-end pb-2 text-label text-navaro-muted">You will be the project manager. An admin can change this later.</p>
          )
        )}

        <Field label="Description" error={all.description} className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={3} maxLength={5000} value={values.description} onChange={(e) => set('description', e.target.value)} />}
        </Field>

        <Field label="Notes" error={all.notes} className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={3} maxLength={5000} value={values.notes} onChange={(e) => set('notes', e.target.value)} />}
        </Field>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === 'create' ? 'Create project' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
