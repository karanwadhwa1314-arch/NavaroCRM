'use client';

import { useState, type KeyboardEvent } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  COMPANY_SIZES,
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  TIMELINES,
  TIMELINE_LABELS,
  CURRENCIES,
} from '@/lib/constants';
import type { CreateLeadInput } from '@/lib/validation/lead';

export interface LeadFormValues extends Partial<CreateLeadInput> {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
}

interface AssignableUser {
  id: string;
  firstName: string;
  lastName: string;
}

interface LeadFormProps {
  initial?: Partial<LeadFormValues>;
  onSubmit: (values: LeadFormValues) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  submitLabel: string;
  isAdmin: boolean;
  assignableUsers: AssignableUser[];
  fieldErrors?: Record<string, string>;
}

const EMPTY: LeadFormValues = { firstName: '', lastName: '', email: '', company: '' };

export function LeadForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
  isAdmin,
  assignableUsers,
  fieldErrors = {},
}: LeadFormProps) {
  const [values, setValues] = useState<LeadFormValues>({ ...EMPTY, ...initial });
  const [showMore, setShowMore] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  function set<K extends keyof LeadFormValues>(key: K, value: LeadFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function addTag() {
    const tag = tagInput.trim();
    if (!tag) return;
    const tags = values.tags ?? [];
    if (!tags.includes(tag)) set('tags', [...tags, tag]);
    setTagInput('');
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  }

  function removeTag(tag: string) {
    set('tags', (values.tags ?? []).filter((t) => t !== tag));
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!values.firstName.trim()) errors.firstName = 'First name is required';
    if (!values.lastName.trim()) errors.lastName = 'Last name is required';
    if (!values.email.trim() || !/^\S+@\S+\.\S+$/.test(values.email)) errors.email = 'Enter a valid email';
    if (!values.company.trim()) errors.company = 'Company is required';
    setLocalErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    await onSubmit(values);
  }

  const errors = { ...localErrors, ...fieldErrors };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" required error={errors.firstName}>
          {(p) => <Input {...p} value={values.firstName} onChange={(e) => set('firstName', e.target.value)} />}
        </Field>
        <Field label="Last name" required error={errors.lastName}>
          {(p) => <Input {...p} value={values.lastName} onChange={(e) => set('lastName', e.target.value)} />}
        </Field>
        <Field label="Email" required error={errors.email}>
          {(p) => <Input {...p} type="email" value={values.email} onChange={(e) => set('email', e.target.value)} />}
        </Field>
        <Field label="Phone" error={errors.phone}>
          {(p) => <Input {...p} value={values.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />}
        </Field>
        <Field label="Company" required error={errors.company}>
          {(p) => <Input {...p} value={values.company} onChange={(e) => set('company', e.target.value)} />}
        </Field>
        <Field label="Job title" error={errors.jobTitle}>
          {(p) => <Input {...p} value={values.jobTitle ?? ''} onChange={(e) => set('jobTitle', e.target.value)} />}
        </Field>
        <Field label="Source" error={errors.source}>
          {(p) => (
            <Select {...p} value={values.source ?? ''} onChange={(e) => set('source', e.target.value as never)}>
              <option value="">Select a source</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_SOURCE_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Priority" error={errors.priority}>
          {(p) => (
            <Select {...p} value={values.priority ?? 'medium'} onChange={(e) => set('priority', e.target.value as never)}>
              {PRIORITIES.map((pr) => (
                <option key={pr} value={pr}>
                  {PRIORITY_LABELS[pr]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Assigned to" error={errors.assignedTo}>
          {(p) =>
            isAdmin ? (
              <Select {...p} value={values.assignedTo ?? ''} onChange={(e) => set('assignedTo', e.target.value || null)}>
                <option value="">Unassigned</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="flex h-10 items-center text-sm text-navaro-muted">Assigned to you</p>
            )
          }
        </Field>
      </div>

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="flex items-center gap-1 text-sm font-medium text-navaro-green"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
        More details
      </button>

      {showMore && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company size">
            {(p) => (
              <Select {...p} value={values.companySize ?? ''} onChange={(e) => set('companySize', e.target.value as never)}>
                <option value="">Not set</option>
                {COMPANY_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Industry">
            {(p) => <Input {...p} value={values.industry ?? ''} onChange={(e) => set('industry', e.target.value)} />}
          </Field>
          <Field label="Website">
            {(p) => <Input {...p} value={values.website ?? ''} onChange={(e) => set('website', e.target.value)} />}
          </Field>
          <Field label="Expected timeline">
            {(p) => (
              <Select
                {...p}
                value={values.expectedTimeline ?? ''}
                onChange={(e) => set('expectedTimeline', e.target.value as never)}
              >
                <option value="">Not set</option>
                {TIMELINES.map((t) => (
                  <option key={t} value={t}>
                    {TIMELINE_LABELS[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Budget min">
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                value={values.estimatedBudget?.min ?? ''}
                onChange={(e) =>
                  set('estimatedBudget', {
                    ...values.estimatedBudget,
                    currency: values.estimatedBudget?.currency ?? 'USD',
                    min: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            )}
          </Field>
          <Field label="Budget max">
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                value={values.estimatedBudget?.max ?? ''}
                onChange={(e) =>
                  set('estimatedBudget', {
                    ...values.estimatedBudget,
                    currency: values.estimatedBudget?.currency ?? 'USD',
                    max: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            )}
          </Field>
          <Field label="Currency">
            {(p) => (
              <Select
                {...p}
                value={values.estimatedBudget?.currency ?? 'USD'}
                onChange={(e) =>
                  set('estimatedBudget', {
                    ...values.estimatedBudget,
                    currency: e.target.value as (typeof CURRENCIES)[number],
                  })
                }
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Requirements" className="sm:col-span-2">
            {(p) => (
              <Textarea {...p} rows={3} value={values.requirements ?? ''} onChange={(e) => set('requirements', e.target.value)} />
            )}
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={3} value={values.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />}
          </Field>

          <Field label="Tags" className="sm:col-span-2">
            {(p) => (
              <div>
                <Input
                  {...p}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={addTag}
                  placeholder="Type a tag and press Enter"
                />
                {(values.tags ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(values.tags ?? []).map((tag) => (
                      <Badge key={tag} tone="neutral">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="ml-1" aria-label={`Remove ${tag}`}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Field>
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-navaro-line pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
