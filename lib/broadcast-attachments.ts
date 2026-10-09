import { AppError } from '@/lib/api/errors';
import { ATTACHMENT_TYPES, attachmentProblem, cleanFilename, extensionOf } from '@/lib/broadcast-attachment-rules';

export interface DecodedUpload {
  filename: string;
  contentType: string;
  size: number;
  data: Buffer;
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const startsWith = (b: Buffer, bytes: number[], at = 0) => bytes.every((v, i) => b[at + i] === v);

/** Does the file's content match what its extension claims? (An .exe renamed to .pdf must not get through.) */
function contentMatches(ext: string, b: Buffer): boolean {
  switch (ext) {
    case 'pdf':
      return b.subarray(0, 1024).includes('%PDF-');
    case 'png':
      return startsWith(b, [0x89, 0x50, 0x4e, 0x47]);
    case 'jpg':
    case 'jpeg':
      return startsWith(b, [0xff, 0xd8, 0xff]);
    case 'gif':
      return startsWith(b, [0x47, 0x49, 0x46, 0x38]);
    case 'webp':
      return startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8);
    case 'docx':
    case 'xlsx':
    case 'pptx':
      return startsWith(b, [0x50, 0x4b, 0x03, 0x04]);
    case 'doc':
    case 'xls':
    case 'ppt':
      return startsWith(b, [0xd0, 0xcf, 0x11, 0xe0]);
    case 'txt':
    case 'csv':
      return !b.subarray(0, 8192).includes(0) && !startsWith(b, [0x4d, 0x5a]); // plain text only: no NUL bytes, not a Windows executable
    default:
      return false;
  }
}

function reject(message: string): never {
  throw new AppError(400, message, { errors: [{ field: 'attachments', message }] });
}

/** Authoritative server-side check of one uploaded file (name, type, size, real content). Throws a 400 describing the first problem. */
export function decodeUpload(upload: { filename: string; data: string }): DecodedUpload {
  const filename = cleanFilename(upload.filename);
  const raw = upload.data.replace(/^data:[^,]*;base64,/, '');
  if (!BASE64.test(raw)) reject(`"${filename || 'This file'}" could not be read. Please attach it again.`);
  const data = Buffer.from(raw, 'base64');
  const problem = attachmentProblem(filename, data.length);
  if (problem) reject(problem);
  const ext = extensionOf(filename);
  if (!contentMatches(ext, data)) reject(`"${filename}" doesn't look like a real .${ext} file.`);
  return { filename, contentType: ATTACHMENT_TYPES[ext], size: data.length, data };
}
