import type { LeadType } from '@/lib/constants';

/**
 * Decides what one CSV row is. Pure (no database), so the rules are easy to read and test.
 *
 *  - A row with a person's name is an *individual* lead (the company, if given, is where they work).
 *  - A row with only a company name — or whose "contact person" is just the company's own name — is a
 *    *company* lead: no first/last name is stored.
 *  - A row needs one or the other.
 */

export interface RowNames {
  firstName?: string;
  lastName?: string;
  /** A single "Contact person" / "Name" cell; split into first/last name when no separate name columns are given. */
  contactPerson?: string;
  company?: string;
}

export type RowIdentity =
  | {
      ok: true;
      type: LeadType;
      firstName: string;
      lastName: string;
      company: string;
      displayName: string;
      /** A business-like contact name that differs from the company, kept so no information is lost. */
      note?: string;
    }
  | { ok: false; reason: string };

/** Words that mark a name as a business rather than a person ("ACAS LOGISTICS SOLUTION PVT LTD"). */
const ENTITY_WORDS =
  /\b(pvt|ltd|llp|limited|private|inc|corp|corporation|llc|gmbh|company|enterprises?|logistics?|shipping|freight|forwarding|forwarders?|cargo|exports?|imports?|impex|exim|traders?|trading|international|overseas|solutions|services|global|worldwide|carriers|industr(?:y|ies)|group|associates|agency|express|transports?|travels)\b/i;

const LEGAL_SUFFIX = /\b(pvt|private|ltd|limited|llp|inc|corp|corporation|llc|co|company)\b/g;
const HONORIFIC = /^(mr|mrs|ms|miss|dr|shri|smt|sri)\.?\s+/i;

const squash = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(LEGAL_SUFFIX, ' ')
    .replace(/[^a-z0-9]+/g, '');

/**
 * True when a "person" cell is clearly a business ("… Pvt Ltd", "… Logistics"). A cell that merely repeats the
 * company name is NOT enough on its own: sole proprietors are listed under their own name ("ASIF FAROOQUI" at
 * "ASIF FAROOQUI"), and those are people.
 */
export function looksLikeCompany(name: string): boolean {
  return ENTITY_WORDS.test(name.trim());
}

export const sameName = (a: string, b: string) => squash(a) !== '' && squash(a) === squash(b);

/** "SHASHWAT" / "amardeep malhotra" -> "Shashwat" / "Amardeep Malhotra". Mixed-case input is left exactly as typed. */
export function tidyPersonName(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ');
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (!letters || (s !== s.toUpperCase() && s !== s.toLowerCase())) return s;
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'.])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

function splitContactPerson(cell: string): { firstName: string; lastName: string } {
  const cleaned = cell.trim().replace(HONORIFIC, '').replace(/\s+/g, ' ');
  const [first = '', ...rest] = cleaned.split(' ');
  return { firstName: tidyPersonName(first), lastName: tidyPersonName(rest.join(' ')) };
}

export function classifyRow(row: RowNames): RowIdentity {
  let company = (row.company ?? '').trim();
  let firstName = (row.firstName ?? '').trim();
  let lastName = (row.lastName ?? '').trim();
  const contact = (row.contactPerson ?? '').trim();

  let note: string | undefined;
  if (!firstName && !lastName && contact) {
    if (looksLikeCompany(contact)) {
      if (!company) company = contact; // the cell names the business and there is no separate company column value
      else if (!sameName(contact, company)) note = `Contact: ${contact}`;
    } else {
      ({ firstName, lastName } = splitContactPerson(contact));
    }
  } else {
    firstName = tidyPersonName(firstName);
    lastName = tidyPersonName(lastName);
  }

  if (firstName) {
    // A person. Their last name may be missing (a single-word contact) as long as we know the company.
    if (!lastName && !company) return { ok: false, reason: 'Last name is required, or provide a company name' };
    const displayName = `${firstName} ${lastName}`.trim();
    return { ok: true, type: 'individual', firstName, lastName, company: company || displayName, displayName };
  }

  if (lastName) return { ok: false, reason: 'First name is required, or provide a company name' };
  if (company) return { ok: true, type: 'company', firstName: '', lastName: '', company, displayName: company, ...(note ? { note } : {}) };
  return { ok: false, reason: "Add a person's name (first and last) or a company name" };
}
