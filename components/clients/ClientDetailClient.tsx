'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { MoreVertical, Trash2, Plus, ArrowLeft } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ClientStatusBadge } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { ContactList, type Contact } from '@/components/clients/ContactList';
import { ContactForm, type ContactFormValues } from '@/components/clients/ContactForm';
import { useSession } from '@/components/providers/SessionProvider';
import { api, ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { CLIENT_STATUSES, CLIENT_STATUS_LABELS, CLIENT_TIERS, CLIENT_TIER_LABELS } from '@/lib/constants';
import type { ClientStatus, ClientTier } from '@/lib/constants';

interface ClientDetail {
  id: string;
  companyName: string;
  displayName?: string;
  industry?: string;
  companySize?: string;
  website?: string;
  taxId?: string;
  paymentTerms: number;
  currency: string;
  source: string;
  status: ClientStatus;
  tier: ClientTier;
  accountManager?: { firstName: string; lastName: string } | null;
  convertedFromLead?: { _id: string; firstName: string; lastName: string; company: string } | null;
  address?: { street?: string; city?: string; state?: string; country?: string; zipCode?: string };
  billingAddress?: { sameAsAddress: boolean; street?: string; city?: string; state?: string; country?: string; zipCode?: string };
  contacts: Contact[];
  notes?: string;
  tags: string[];
  createdAt: string;
}

export function ClientDetailClient({ client }: { client: ClientDetail }) {
  const { can, user } = useSession();
  const router = useRouter();

  const [status, setStatus] = useState(client.status);
  const [tier, setTier] = useState(client.tier);
  const [contactModal, setContactModal] = useState<{ mode: 'add' | 'edit'; contact?: Contact } | null>(null);
  const [deleteContact, setDeleteContact] = useState<Contact | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleStatusChange(next: ClientStatus) {
    const prev = status;
    setStatus(next);
    try {
      await api.put(`/api/clients/${client.id}`, { status: next });
      toast.success('Status updated');
      router.refresh();
    } catch (err) {
      setStatus(prev);
      if (err instanceof ApiError) toast.error(err.message);
    }
  }

  async function handleTierChange(next: ClientTier) {
    const prev = tier;
    setTier(next);
    try {
      await api.put(`/api/clients/${client.id}`, { tier: next });
      toast.success('Tier updated');
      router.refresh();
    } catch (err) {
      setTier(prev);
      if (err instanceof ApiError) toast.error(err.message);
    }
  }

  async function handleContactSubmit(values: ContactFormValues) {
    setSubmitting(true);
    try {
      if (contactModal?.mode === 'edit' && contactModal.contact) {
        await api.put(`/api/clients/${client.id}/contacts/${contactModal.contact.id}`, values);
        toast.success('Contact updated');
      } else {
        await api.post(`/api/clients/${client.id}/contacts`, values);
        toast.success('Contact added');
      }
      setContactModal(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteContact() {
    if (!deleteContact) return;
    setSubmitting(true);
    try {
      await api.delete(`/api/clients/${client.id}/contacts/${deleteContact.id}`);
      toast.success('Contact removed');
      setDeleteContact(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteClient() {
    setSubmitting(true);
    try {
      await api.delete(`/api/clients/${client.id}`);
      toast.success('Client deleted');
      router.push('/clients');
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const admin = user.role !== 'member';
  const billing = client.billingAddress;
  const billingIsSame = billing?.sameAsAddress ?? true;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/clients" className="inline-flex items-center gap-1 text-label text-navaro-muted hover:text-navaro-green">
          <ArrowLeft className="h-3.5 w-3.5" /> Clients
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-h1 text-navaro-green">{client.companyName}</h1>
            {(client.displayName || client.industry) && (
              <p className="mt-1 text-body text-navaro-muted">{[client.displayName, client.industry].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ClientStatusBadge status={status} />
            {can('clients.edit') && (
              <Button variant="secondary" onClick={() => router.push(`/clients/${client.id}/edit`)}>
                Edit
              </Button>
            )}
            {can('clients.delete') && (
              <Menu trigger={<IconButton aria-label="More actions"><MoreVertical className="h-4 w-4" /></IconButton>}>
                <MenuItem danger onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4" /> Delete
                </MenuItem>
              </Menu>
            )}
          </div>
        </div>
      </div>

      {can('clients.edit') && (
        <Card>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-label text-navaro-muted">Status</span>
              <Select value={status} onChange={(e) => handleStatusChange(e.target.value as ClientStatus)} className="w-40">
                {CLIENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CLIENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-label text-navaro-muted">Tier</span>
              <Select value={tier} onChange={(e) => handleTierChange(e.target.value as ClientTier)} className="w-40">
                {CLIENT_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {CLIENT_TIER_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Card>
      )}

      {client.convertedFromLead && (
        <div className="rounded-control bg-navaro-lavender px-4 py-3 text-sm font-medium text-navaro-ink">
          Converted from lead{' '}
          <Link href={`/leads/${client.convertedFromLead._id}`} className="underline">
            {`${client.convertedFromLead.firstName ?? ''} ${client.convertedFromLead.lastName ?? ''}`.trim() || client.convertedFromLead.company}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card padding={false}>
            <CardHeader
              title="Contacts"
              action={
                can('clients.edit') && (
                  <Button size="sm" variant="secondary" onClick={() => setContactModal({ mode: 'add' })}>
                    <Plus className="h-4 w-4" /> Add contact
                  </Button>
                )
              }
            />
            <div className="p-6">
              <ContactList
                contacts={client.contacts}
                canEdit={can('clients.edit')}
                onEdit={(contact) => setContactModal({ mode: 'edit', contact })}
                onDelete={(contact) => setDeleteContact(contact)}
              />
            </div>
          </Card>

          {client.notes && (
            <Card>
              <h2 className="mb-2 text-h3 text-navaro-green">Notes</h2>
              <p className="whitespace-pre-wrap text-body text-navaro-green">{client.notes}</p>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 text-h3 text-navaro-green">Overview</h2>
            <dl className="flex flex-col gap-3 text-sm">
              {client.industry && <Row label="Industry">{client.industry}</Row>}
              {client.companySize && <Row label="Company size">{client.companySize}</Row>}
              {client.website && <Row label="Website">{client.website}</Row>}
              {client.taxId && <Row label="Tax ID">{client.taxId}</Row>}
              <Row label="Payment terms">{client.paymentTerms} days</Row>
              <Row label="Currency">{client.currency}</Row>
              <Row label="Source">{client.source.replace('_', ' ')}</Row>
              <Row label="Account manager">
                {client.accountManager ? `${client.accountManager.firstName} ${client.accountManager.lastName}` : '—'}
              </Row>
              <Row label="Created">{formatDate(client.createdAt)}</Row>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-3 text-h3 text-navaro-green">Address</h2>
            <AddressBlock address={client.address} />
            <h3 className="mb-1 mt-4 text-label font-medium text-navaro-muted">Billing address</h3>
            {billingIsSame ? (
              <p className="text-sm text-navaro-muted">Same as address</p>
            ) : (
              <AddressBlock address={billing} />
            )}
          </Card>

          {client.tags.length > 0 && (
            <Card>
              <h2 className="mb-2 text-h3 text-navaro-green">Tags</h2>
              <div className="flex flex-wrap gap-1.5">
                {client.tags.map((tag) => (
                  <Badge key={tag} tone="neutral">
                    {tag}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <ContactForm
        open={Boolean(contactModal)}
        onClose={() => setContactModal(null)}
        initial={contactModal?.contact}
        onSubmit={handleContactSubmit}
        submitting={submitting}
        title={contactModal?.mode === 'edit' ? 'Edit contact' : 'Add contact'}
      />

      <ConfirmDialog
        open={Boolean(deleteContact)}
        onClose={() => setDeleteContact(null)}
        onConfirm={handleDeleteContact}
        title={`Remove ${deleteContact?.firstName ?? ''} ${deleteContact?.lastName ?? ''}?`}
        body="This contact will be removed from the client."
        confirmLabel="Remove"
        loading={submitting}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteClient}
        title={`Delete client ${client.companyName}?`}
        body={admin ? "This can't be undone." : 'The client will be archived.'}
        confirmLabel="Delete"
        loading={submitting}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-navaro-muted">{label}</dt>
      <dd className="text-right text-navaro-green">{children}</dd>
    </div>
  );
}

function AddressBlock({ address }: { address?: { street?: string; city?: string; state?: string; country?: string; zipCode?: string } }) {
  if (!address || !(address.street || address.city || address.state || address.country || address.zipCode)) {
    return <p className="text-sm text-navaro-muted">Not set</p>;
  }
  return (
    <p className="text-sm text-navaro-green">
      {[address.street, address.city, address.state, address.zipCode, address.country].filter(Boolean).join(', ')}
    </p>
  );
}
