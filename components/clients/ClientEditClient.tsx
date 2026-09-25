'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { AddressFields, type AddressValue } from '@/components/clients/AddressFields';
import { ContactList, type Contact } from '@/components/clients/ContactList';
import { ContactForm, type ContactFormValues } from '@/components/clients/ContactForm';
import { useSession } from '@/components/providers/SessionProvider';
import { api, ApiError } from '@/lib/api-client';
import { isAdmin } from '@/lib/permissions';
import {
  COMPANY_SIZES,
  CLIENT_STATUSES,
  CLIENT_STATUS_LABELS,
  CLIENT_TIERS,
  CLIENT_TIER_LABELS,
  CURRENCIES,
} from '@/lib/constants';
import type { ClientStatus, ClientTier } from '@/lib/constants';

interface AssignableUser {
  id: string;
  firstName: string;
  lastName: string;
}

interface ClientEditData {
  id: string;
  companyName: string;
  displayName?: string;
  industry?: string;
  companySize?: string;
  website?: string;
  taxId?: string;
  paymentTerms: number;
  currency: string;
  status: ClientStatus;
  tier: ClientTier;
  accountManager?: { _id?: string; id?: string } | null;
  address?: AddressValue;
  billingAddress?: AddressValue & { sameAsAddress: boolean };
  contacts: Contact[];
}

export function ClientEditClient({ client, assignableUsers }: { client: ClientEditData; assignableUsers: AssignableUser[] }) {
  const { user } = useSession();
  const router = useRouter();
  const admin = isAdmin({ role: user.role, permissions: user.permissions });

  const [companyName, setCompanyName] = useState(client.companyName);
  const [displayName, setDisplayName] = useState(client.displayName ?? '');
  const [industry, setIndustry] = useState(client.industry ?? '');
  const [companySize, setCompanySize] = useState(client.companySize ?? '');
  const [website, setWebsite] = useState(client.website ?? '');
  const [taxId, setTaxId] = useState(client.taxId ?? '');
  const [paymentTerms, setPaymentTerms] = useState(client.paymentTerms);
  const [currency, setCurrency] = useState(client.currency);
  const [status, setStatus] = useState(client.status);
  const [tier, setTier] = useState(client.tier);
  const [accountManager, setAccountManager] = useState(client.accountManager?.id ?? client.accountManager?._id ?? '');
  const [address, setAddress] = useState<AddressValue>(client.address ?? {});
  const [sameAsAddress, setSameAsAddress] = useState(client.billingAddress?.sameAsAddress ?? true);
  const [billingAddress, setBillingAddress] = useState<AddressValue>(client.billingAddress ?? {});
  const [contacts, setContacts] = useState(client.contacts);
  const [contactModal, setContactModal] = useState<{ mode: 'add' | 'edit'; contact?: Contact } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  async function handleSave() {
    setSaving(true);
    setErrors({});
    try {
      await api.put(`/api/clients/${client.id}`, {
        companyName,
        displayName: displayName || undefined,
        industry: industry || undefined,
        companySize: companySize || undefined,
        website: website || undefined,
        taxId: taxId || undefined,
        paymentTerms,
        currency,
        status,
        tier,
        accountManager: admin ? accountManager || null : undefined,
        address,
        billingAddress: { ...billingAddress, sameAsAddress },
      });
      toast.success('Client updated');
      setDirty(false);
      router.push(`/clients/${client.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errors) {
          const fe: Record<string, string> = {};
          for (const e of err.errors) fe[e.field] = e.message;
          setErrors(fe);
        } else {
          toast.error(err.message);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    router.push(`/clients/${client.id}`);
  }

  async function handleContactSubmit(values: ContactFormValues) {
    try {
      if (contactModal?.mode === 'edit' && contactModal.contact) {
        const updated = await api.put<{ contacts: Contact[] }>(`/api/clients/${client.id}/contacts/${contactModal.contact.id}`, values);
        setContacts(updated.contacts);
        toast.success('Contact updated');
      } else {
        const updated = await api.post<{ contacts: Contact[] }>(`/api/clients/${client.id}/contacts`, values);
        setContacts(updated.contacts);
        toast.success('Contact added');
      }
      setContactModal(null);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    }
  }

  async function handleDeleteContact(contact: Contact) {
    if (!window.confirm(`Remove ${contact.firstName} ${contact.lastName}?`)) return;
    try {
      const updated = await api.delete<{ contacts: Contact[] }>(`/api/clients/${client.id}/contacts/${contact.id}`);
      setContacts(updated.contacts);
      toast.success('Contact removed');
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div>
        <h1 className="text-h1 text-navaro-green">Edit client</h1>
        <p className="mt-1 text-body text-navaro-muted">{client.companyName}</p>
      </div>

      <Card>
        <h2 className="mb-4 text-h3 text-navaro-green">Company details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company name" required error={errors.companyName} className="sm:col-span-2">
            {(p) => <Input {...p} value={companyName} onChange={(e) => markDirty(setCompanyName)(e.target.value)} />}
          </Field>
          <Field label="Display name">
            {(p) => <Input {...p} value={displayName} onChange={(e) => markDirty(setDisplayName)(e.target.value)} />}
          </Field>
          <Field label="Industry">
            {(p) => <Input {...p} value={industry} onChange={(e) => markDirty(setIndustry)(e.target.value)} />}
          </Field>
          <Field label="Company size">
            {(p) => (
              <Select {...p} value={companySize} onChange={(e) => markDirty(setCompanySize)(e.target.value)}>
                <option value="">Not set</option>
                {COMPANY_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Website">
            {(p) => <Input {...p} value={website} onChange={(e) => markDirty(setWebsite)(e.target.value)} />}
          </Field>
          <Field label="Tax ID">
            {(p) => <Input {...p} value={taxId} onChange={(e) => markDirty(setTaxId)(e.target.value)} />}
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-h3 text-navaro-green">Status &amp; commercial</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Status">
            {(p) => (
              <Select {...p} value={status} onChange={(e) => markDirty(setStatus)(e.target.value as ClientStatus)}>
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
              <Select {...p} value={tier} onChange={(e) => markDirty(setTier)(e.target.value as ClientTier)}>
                {CLIENT_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {CLIENT_TIER_LABELS[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {admin && (
            <Field label="Account manager">
              {(p) => (
                <Select {...p} value={accountManager} onChange={(e) => markDirty(setAccountManager)(e.target.value)}>
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
          <Field label="Payment terms (days)">
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                value={paymentTerms}
                onChange={(e) => markDirty(setPaymentTerms)(Number(e.target.value))}
              />
            )}
          </Field>
          <Field label="Currency">
            {(p) => (
              <Select {...p} value={currency} onChange={(e) => markDirty(setCurrency)(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-h3 text-navaro-green">Address</h2>
        <AddressFields value={address} onChange={(v) => markDirty(setAddress)(v)} />
        <label className="mt-4 flex items-center gap-2">
          <Checkbox checked={sameAsAddress} onChange={(e) => markDirty(setSameAsAddress)(e.target.checked)} />
          <span className="text-sm text-navaro-green">Billing address same as address</span>
        </label>
        {!sameAsAddress && (
          <div className="mt-4">
            <h3 className="mb-2 text-label font-medium text-navaro-muted">Billing address</h3>
            <AddressFields value={billingAddress} onChange={(v) => markDirty(setBillingAddress)(v)} />
          </div>
        )}
      </Card>

      <Card padding={false}>
        <div className="flex items-center justify-between border-b border-navaro-line px-6 py-5">
          <h2 className="text-h2 text-navaro-green">Contacts</h2>
          <Button size="sm" variant="secondary" onClick={() => setContactModal({ mode: 'add' })}>
            <Plus className="h-4 w-4" /> Add contact
          </Button>
        </div>
        <div className="p-6">
          <ContactList contacts={contacts} canEdit onEdit={(c) => setContactModal({ mode: 'edit', contact: c })} onDelete={handleDeleteContact} />
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-navaro-line bg-white px-4 py-3 lg:pl-[264px]">
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Save changes
          </Button>
        </div>
      </div>

      <ContactForm
        open={Boolean(contactModal)}
        onClose={() => setContactModal(null)}
        initial={contactModal?.contact}
        onSubmit={handleContactSubmit}
        submitting={false}
        title={contactModal?.mode === 'edit' ? 'Edit contact' : 'Add contact'}
      />
    </div>
  );
}
