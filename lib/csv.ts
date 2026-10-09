export const MAX_IMPORT_ROWS = 5000;

/** Minimal RFC-4180 CSV parser: quoted fields, escaped quotes, CRLF/LF, embedded newlines. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (inQuotes) throw new Error('The file has an unclosed quoted field. Check for a stray " character.');
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Canonical lead import fields and the header spellings we accept for each (compared after normalising). */
export const LEAD_IMPORT_FIELDS = {
  firstName: ['firstname', 'first', 'givenname', 'forename'],
  lastName: ['lastname', 'last', 'surname', 'familyname'],
  /** One cell holding the whole name ("Contact Person", "Name"); split into first/last on the server. */
  contactPerson: ['contactperson', 'contactname', 'contact', 'fullname', 'name', 'person', 'leadname'],
  email: ['email', 'emailaddress', 'mail', 'workemail'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'tel', 'telephone', 'cell'],
  company: ['company', 'companyname', 'organization', 'organisation', 'account'],
  jobTitle: ['jobtitle', 'title', 'position', 'role', 'designation'],
  website: ['website', 'url', 'web', 'site'],
  industry: ['industry', 'sector'],
  source: ['source', 'leadsource'],
  segment: ['segment', 'category'],
  notes: ['notes', 'note', 'comments', 'comment', 'description'],
} as const;

export type LeadImportField = keyof typeof LEAD_IMPORT_FIELDS;
/** Every row needs these... */
export const REQUIRED_IMPORT_FIELDS: LeadImportField[] = ['email', 'phone'];
export const REQUIRED_IMPORT_LABELS: Record<string, string> = {
  email: 'Email',
  phone: 'Phone',
};
/** ...and something to identify the lead: a person's name, or a company name (see lib/lead-import.ts). */
export const IDENTITY_COLUMNS_LABEL = "Company name, or a person's name (First name + Last name, or Contact person)";

const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface ParsedLeadCsv {
  /** Canonical-keyed rows, ready to send to the import API. */
  rows: Record<string, string>[];
  /** Human-readable names of required columns the file does not have. */
  missingColumns: string[];
  ignoredColumns: string[];
}

export function parseLeadCsv(text: string): ParsedLeadCsv {
  const table = parseCsv(text);
  if (table.length === 0) throw new Error('The file is empty.');

  const [header, ...body] = table;
  const columnField: (LeadImportField | null)[] = header.map((h) => {
    const n = normalizeHeader(h);
    const hit = (Object.keys(LEAD_IMPORT_FIELDS) as LeadImportField[]).find((f) => (LEAD_IMPORT_FIELDS[f] as readonly string[]).includes(n));
    return hit ?? null;
  });

  const present = new Set(columnField.filter(Boolean) as LeadImportField[]);
  const missingColumns: string[] = REQUIRED_IMPORT_FIELDS.filter((f) => !present.has(f)).map((f) => REQUIRED_IMPORT_LABELS[f]);
  const hasPersonColumns = (present.has('firstName') && present.has('lastName')) || present.has('contactPerson');
  if (!present.has('company') && !hasPersonColumns) missingColumns.push(IDENTITY_COLUMNS_LABEL);
  const ignoredColumns = header.filter((_, i) => !columnField[i]).map((h) => h.trim()).filter(Boolean);

  const rows = body.map((cells) => {
    const out: Record<string, string> = {};
    columnField.forEach((field, i) => {
      // First column wins if two headers map to the same field.
      if (field && out[field] === undefined) out[field] = (cells[i] ?? '').trim();
    });
    return out;
  });

  return { rows, missingColumns, ignoredColumns };
}
