/**
 * Project names are `<Client-name>-<Motive>` (the client's company name with spaces turned into hyphens,
 * then the motive). Codes are `<CLI>-<MOT>-<nnn>`: three letters from the client, three from the motive,
 * and a running number per prefix.
 */
export const lettersOnly = (value: string | undefined | null): string => (value ?? '').replace(/[^a-zA-Z]/g, '');

export const MIN_NAME_LETTERS = 3;

export function deriveNameClientPart(companyName: string): string {
  return companyName.trim().replace(/\s+/g, '-');
}

export function deriveCodeClientPrefix(companyName: string): string {
  return lettersOnly(companyName).toUpperCase().slice(0, MIN_NAME_LETTERS);
}

export function deriveCodeMotivePrefix(motive: string): string {
  return lettersOnly(motive).toUpperCase().slice(0, MIN_NAME_LETTERS);
}

export function validateMotive(raw: string | undefined | null): { valid: true; motive: string } | { valid: false; error: string } {
  const motive = (raw ?? '').trim();
  if (!motive) return { valid: false, error: 'Motive is required' };
  if (lettersOnly(motive).length < MIN_NAME_LETTERS) {
    return { valid: false, error: `The motive must contain at least ${MIN_NAME_LETTERS} letters` };
  }
  return { valid: true, motive };
}

export type NamingResult =
  | { ok: true; name: string; codePrefix: string }
  | { ok: false; error: string; field: 'client' | 'motive' };

export function buildProjectNaming(companyName: string, rawMotive: string): NamingResult {
  const clientPrefix = deriveCodeClientPrefix(companyName);
  if (clientPrefix.length < MIN_NAME_LETTERS) {
    return {
      ok: false,
      field: 'client',
      error: 'This client’s company name does not contain enough letters to build a project code',
    };
  }
  const motive = validateMotive(rawMotive);
  if (!motive.valid) return { ok: false, field: 'motive', error: motive.error };

  return {
    ok: true,
    name: `${deriveNameClientPart(companyName)}-${motive.motive}`,
    codePrefix: `${clientPrefix}-${deriveCodeMotivePrefix(motive.motive)}`,
  };
}

export function formatProjectCode(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(3, '0')}`;
}

/** Pulls the running number off a code like `ACM-DES-004`; 0 when the code does not match. */
export function codeSequence(code: string): number {
  const match = /-(\d+)$/.exec(code);
  return match ? parseInt(match[1], 10) : 0;
}
