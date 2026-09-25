import { Mail, Phone, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  isPrimary: boolean;
}

interface ContactListProps {
  contacts: Contact[];
  canEdit: boolean;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}

export function ContactList({ contacts, canEdit, onEdit, onDelete }: ContactListProps) {
  if (contacts.length === 0) {
    return <p className="text-body text-navaro-muted">No contacts yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-navaro-line">
      {contacts.map((contact) => (
        <li key={contact.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-medium text-navaro-green">
              {contact.firstName} {contact.lastName}
              {contact.isPrimary && <Badge tone="turquoiseSolid">Primary</Badge>}
            </p>
            {contact.jobTitle && <p className="text-label text-navaro-muted">{contact.jobTitle}</p>}
            <div className="mt-1 flex flex-wrap gap-x-4 text-label">
              <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-navaro-green hover:underline">
                <Mail className="h-3.5 w-3.5" /> {contact.email}
              </a>
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-navaro-green hover:underline">
                  <Phone className="h-3.5 w-3.5" /> {contact.phone}
                </a>
              )}
            </div>
          </div>
          {canEdit && (
            <div className="flex shrink-0 items-center gap-1">
              <IconButton aria-label={`Edit ${contact.firstName}`} size="sm" onClick={() => onEdit(contact)}>
                <Pencil className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton aria-label={`Delete ${contact.firstName}`} size="sm" onClick={() => onDelete(contact)}>
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
