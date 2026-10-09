/** Shared by the browser (to pre-check a file) and the server (the authoritative check). Pure: no Node APIs. */

export const MAX_ATTACHMENT_BYTES = 400 * 1024; // 400 KB per file
export const MAX_ATTACHMENTS = 5;

/** Plain documents and images only. Anything executable or scriptable (exe, js, html, svg, zip...) is deliberately absent. */
export const ATTACHMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_TYPES)
  .map((e) => `.${e}`)
  .join(',');

export const ATTACHMENT_EXTENSIONS_LABEL = 'PDF, images, Word, Excel, PowerPoint, TXT or CSV';

export function extensionOf(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i < 0 ? '' : filename.slice(i + 1).toLowerCase();
}

/** Strips any path, control characters and characters that are unsafe in headers or file systems. */
export function cleanFilename(raw: string): string {
  const base = raw.split(/[\/]/).pop() ?? '';
  return base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .replace(/^\.+/, '')
    .trim()
    .slice(-100);
}

export function formatBytes(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
}

/** Message for the first problem with a file, or null. Used by both sides so the wording matches. */
export function attachmentProblem(filename: string, size: number): string | null {
  if (!cleanFilename(filename)) return 'This file needs a name';
  if (!ATTACHMENT_TYPES[extensionOf(cleanFilename(filename))]) return `"${cleanFilename(filename)}" isn't an allowed file type. Allowed: ${ATTACHMENT_EXTENSIONS_LABEL}.`;
  if (size <= 0) return `"${cleanFilename(filename)}" is empty`;
  if (size > MAX_ATTACHMENT_BYTES) return `"${cleanFilename(filename)}" is ${formatBytes(size)}. Each file must be ${formatBytes(MAX_ATTACHMENT_BYTES)} or smaller.`;
  return null;
}
