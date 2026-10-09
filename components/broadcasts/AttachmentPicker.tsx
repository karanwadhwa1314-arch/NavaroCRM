'use client';

import { useRef, useState } from 'react';
import { FileText, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_EXTENSIONS_LABEL,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  attachmentProblem,
  cleanFilename,
  formatBytes,
} from '@/lib/broadcast-attachment-rules';

/** A file in the composer: either one already saved on the broadcast (`id`) or a new one waiting to be saved (`data`, base64). */
export interface AttachmentDraft {
  key: string;
  id?: string;
  filename: string;
  size: number;
  data?: string;
}

interface Props {
  id?: string;
  value: AttachmentDraft[];
  onChange: (next: AttachmentDraft[]) => void;
  disabled?: boolean;
  error?: string;
}

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*;base64,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AttachmentPicker({ id, value, onChange, disabled, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setProblem(null);
    const next = [...value];
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      const name = cleanFilename(file.name);
      if (next.length >= MAX_ATTACHMENTS) {
        problems.push(`You can attach up to ${MAX_ATTACHMENTS} files.`);
        break;
      }
      const issue = attachmentProblem(file.name, file.size);
      if (issue) {
        problems.push(issue);
        continue;
      }
      if (next.some((a) => a.filename === name && a.size === file.size)) continue; // already attached
      try {
        next.push({ key: `${Date.now()}-${Math.random()}`, filename: name, size: file.size, data: await readBase64(file) });
      } catch {
        problems.push(`"${name}" could not be read. Please try again.`);
      }
    }
    setProblem(problems.length ? problems.join(' ') : null);
    onChange(next);
    if (inputRef.current) inputRef.current.value = ''; // allow choosing the same file again after removing it
  }

  const shown = problem ?? error;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button id={id} type="button" variant="secondary" size="sm" disabled={disabled || value.length >= MAX_ATTACHMENTS} onClick={() => inputRef.current?.click()}>
          <Paperclip className="h-4 w-4" /> Attach files
        </Button>
        <input ref={inputRef} type="file" multiple accept={ATTACHMENT_ACCEPT} className="sr-only" tabIndex={-1} aria-label="Attach files" onChange={(e) => void addFiles(e.target.files)} />
        <p className="text-label text-navaro-muted">
          Up to {MAX_ATTACHMENTS} files, {formatBytes(MAX_ATTACHMENT_BYTES)} each. {ATTACHMENT_EXTENSIONS_LABEL}.
        </p>
      </div>

      {value.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {value.map((a) => (
            <li key={a.key} className="flex items-center gap-2 rounded-control border border-navaro-line bg-white px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-navaro-green" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm text-navaro-green" title={a.filename}>
                {a.filename}
              </span>
              <span className="shrink-0 text-label text-navaro-muted">{formatBytes(a.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${a.filename}`}
                disabled={disabled}
                onClick={() => onChange(value.filter((x) => x.key !== a.key))}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-navaro-green hover:bg-navaro-hover disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {shown && (
        <p className="text-label text-danger" role="alert">
          {shown}
        </p>
      )}
    </div>
  );
}
