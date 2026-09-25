'use client';

import { useState } from 'react';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { CLIENT_STATUSES, CLIENT_STATUS_LABELS, CLIENT_TIERS, CLIENT_TIER_LABELS, CURRENCIES } from '@/lib/constants';
import type { CreateClientInput } from '@/lib/validation/client';

export interface ClientFormValues extends Partial<CreateClientInput> {
  companyName: string;
}

interface AssignableUser {
  id: string;
  firstName: string;
  lastName: string;
}

interface ClientFormProps {
  onSubmit: (values: ClientFormValues) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  isAdmin: boolean;
  assignableUsers: AssignableUser[];
  fieldErrors?: Record<string, string>;
}

export function ClientForm({ onSubmit, onCancel, submitting, isAdmin, assignableUsers, fieldErrors = {} }: ClientFormProps) {
  const [values, setValues] = useState<ClientFormValues>({ companyName: '', status: 'active' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function setContact<K extends keyof NonNullable<ClientFormValues['contact']>>(key: K, value: string) {
    setValues((v) => ({ ...v, contact: { ...v.contact, [key]: value } }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!values.companyName.trim()) e.companyName = 'Company name is required';
    const contact = values.contact;
    const anyContactFilled = contact && (contact.firstName || contact.lastName || contact.email || contact.phone);
    if (anyContactFilled) {
      if (!contact?.firstName) e['contact.firstName'] = 'Required';
      if (!contact?.lastName) e['contact.lastName'] = 'Required';
      if (!contact?.email || !/^\S+@\S+\.\S+$/.test(contact.email)) e['contact.email'] = 'Enter a valid email';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    await onSubmit(values);
  }

  const allErrors = { ...errors, ...fieldErrors };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Company name" required error={allErrors.companyName} className="sm:col-span-2">
          {(p) => <Input {...p} value={values.companyName} onChange={(e) => set('companyName', e.target.value)} />}
        </Field>
        <Field label="Industry">
          {(p) => <Input {...p} value={values.industry ?? ''} onChange={(e) => set('industry', e.target.value)} />}
        </Field>
        <Field label="Website">
          {(p) => <Input {...p} value={values.website ?? ''} onChange={(e) => set('website', e.target.value)} />}
        </Field>
        <Field label="Status">
          {(p) => (
            <Select {...p} value={values.status ?? 'active'} onChange={(e) => set('status', e.target.value as never)}>
              {CLIENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CLIENT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Tier">
          {(p) => (
            <Select {...p} value={values.tier ?? 'standard'} onChange={(e) => set('tier', e.target.value as never)}>
              {CLIENT_TIERS.map((t) => (
                <option key={t} value={t}>
                  {CLIENT_TIER_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {isAdmin && (
          <Field label="Account manager">
            {(p) => (
              <Select {...p} value={values.accountManager ?? ''} onChange={(e) => set('accountManager', e.target.value || null)}>
                <option value="">Unassigned</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Currency">
          {(p) => (
            <Select {...p} value={values.currency ?? 'USD'} onChange={(e) => set('currency', e.target.value as never)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="border-t border-navaro-line pt-4">
        <h3 className="mb-3 text-h3 text-navaro-green">Primary contact</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" error={allErrors['contact.firstName']}>
            {(p) => <Input {...p} value={values.contact?.firstName ?? ''} onChange={(e) => setContact('firstName', e.target.value)} />}
          </Field>
          <Field label="Last name" error={allErrors['contact.lastName']}>
            {(p) => <Input {...p} value={values.contact?.lastName ?? ''} onChange={(e) => setContact('lastName', e.target.value)} />}
          </Field>
          <Field label="Email" error={allErrors['contact.email']}>
            {(p) => <Input {...p} type="email" value={values.contact?.email ?? ''} onChange={(e) => setContact('email', e.target.value)} />}
          </Field>
          <Field label="Phone">
            {(p) => <Input {...p} value={values.contact?.phone ?? ''} onChange={(e) => setContact('phone', e.target.value)} />}
          </Field>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-navaro-line pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={submitting}>
          Create client
        </Button>
      </div>
    </div>
  );
}
