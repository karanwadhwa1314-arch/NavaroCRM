'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import type { ClientContactInput } from '@/lib/validation/client';

export interface ContactFormValues extends ClientContactInput {
  id?: string;
}

interface ContactFormProps {
  open: boolean;
  onClose: () => void;
  initial?: Partial<ContactFormValues>;
  onSubmit: (values: ContactFormValues) => Promise<void>;
  submitting: boolean;
  title: string;
}

const EMPTY: ContactFormValues = { firstName: '', lastName: '', email: '', isPrimary: false };

export function ContactForm({ open, onClose, initial, onSubmit, submitting, title }: ContactFormProps) {
  const [values, setValues] = useState<ContactFormValues>({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!values.firstName.trim()) e.firstName = 'Required';
    if (!values.lastName.trim()) e.lastName = 'Required';
    if (!values.email.trim() || !/^\S+@\S+\.\S+$/.test(values.email)) e.email = 'Enter a valid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    await onSubmit(values);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      preventClose={submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Save
          </Button>
        </>
      }
    >
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
        <Field label="Phone">
          {(p) => <Input {...p} value={values.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />}
        </Field>
        <Field label="Job title">
          {(p) => <Input {...p} value={values.jobTitle ?? ''} onChange={(e) => set('jobTitle', e.target.value)} />}
        </Field>
        <Field label="Department">
          {(p) => <Input {...p} value={values.department ?? ''} onChange={(e) => set('department', e.target.value)} />}
        </Field>
      </div>
      <label className="mt-4 flex items-center gap-2">
        <Checkbox checked={values.isPrimary ?? false} onChange={(e) => set('isPrimary', e.target.checked)} />
        <span className="text-sm text-navaro-green">Primary contact</span>
      </label>
    </Modal>
  );
}
