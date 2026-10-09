'use client';

import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertCircle, FileUp } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api, ApiError } from '@/lib/api-client';
import { MAX_IMPORT_ROWS, parseLeadCsv } from '@/lib/csv';
import type { ImportLeadsResult } from '@/services/leads';

const MAX_BYTES = 2 * 1024 * 1024;

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ImportLeadsModal({ open, onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportLeadsResult | null>(null);

  function reset() {
    setError(null);
    setFileName('');
    setRows([]);
    setIgnored([]);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPreview(null);

    if (!/\.csv$/i.test(file.name)) return setError('Please choose a .csv file.');
    if (file.size > MAX_BYTES) return setError('That file is larger than 2 MB. Split it into smaller files.');

    setBusy(true);
    try {
      const parsed = parseLeadCsv(await file.text());
      if (parsed.missingColumns.length > 0) {
        return setError(`The file is missing required column${parsed.missingColumns.length > 1 ? 's' : ''}: ${parsed.missingColumns.join('; ')}.`);
      }
      if (parsed.rows.length === 0) return setError('The file has a header row but no leads.');
      if (parsed.rows.length > MAX_IMPORT_ROWS) return setError(`The file has ${parsed.rows.length.toLocaleString()} rows. Import at most ${MAX_IMPORT_ROWS.toLocaleString()} at a time.`);

      // Server-side dry run: validation and duplicate detection happen where the data lives.
      const result = await api.post<ImportLeadsResult>('/api/leads/import', { rows: parsed.rows, dryRun: true });
      setFileName(file.name);
      setRows(parsed.rows);
      setIgnored(parsed.ignoredColumns);
      setPreview(result);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    setBusy(true);
    try {
      const res = await api.post<ImportLeadsResult>('/api/leads/import', { rows, dryRun: false });
      const skipped = res.total - res.imported;
      if (skipped === 0) toast.success(`${res.imported} lead${res.imported === 1 ? '' : 's'} imported successfully.`);
      else toast.success(`${res.imported} lead${res.imported === 1 ? '' : 's'} imported successfully. ${skipped} row${skipped === 1 ? '' : 's'} could not be imported.`);
      reset();
      onClose();
      onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Import failed. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  }

  const problems = preview?.rows.filter((r) => r.status !== 'valid') ?? [];

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import leads from CSV"
      size="lg"
      preventClose={busy}
      footer={
        <>
          <Button variant="secondary" onClick={preview ? reset : close} disabled={busy}>
            {preview ? 'Choose another file' : 'Cancel'}
          </Button>
          {preview && (
            <Button onClick={confirmImport} loading={busy} disabled={preview.valid === 0}>
              Import {preview.valid.toLocaleString()} lead{preview.valid === 1 ? '' : 's'}
            </Button>
          )}
        </>
      }
    >
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-control bg-danger-tint px-3 py-2 text-sm text-danger" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {!preview && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 text-body text-navaro-green">
            <p>
              Every row needs an <strong className="font-medium">Email</strong> and a <strong className="font-medium">Phone</strong>, plus
              either a <strong className="font-medium">person&rsquo;s name</strong> (First name and Last name, or one Contact person column)
              or a <strong className="font-medium">Company name</strong>.
            </p>
            <ul className="list-disc pl-5 text-sm text-navaro-muted">
              <li>A row with a person&rsquo;s name becomes an <strong className="font-medium">individual</strong> lead (the company is where they work).</li>
              <li>A row with only a company name, or whose contact is just the company, becomes a <strong className="font-medium">company</strong> lead with no first or last name.</li>
              <li>
                Designation / Job title, Website, Industry, Segment, Source and Notes are used when present; other columns are ignored. Rows with an
                email that already exists are skipped.
              </li>
            </ul>
          </div>
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" id="lead-csv" onChange={(e) => handleFile(e.target.files?.[0])} />
          <label
            htmlFor="lead-csv"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed border-navaro-green/30 bg-white px-6 py-10 text-center hover:border-navaro-green hover:bg-navaro-hover"
          >
            <FileUp className="h-7 w-7 text-navaro-green" strokeWidth={1.75} aria-hidden="true" />
            <span className="text-sm font-medium text-navaro-green">{busy ? 'Checking file…' : 'Choose a CSV file'}</span>
            <span className="text-label text-navaro-muted">Up to {MAX_IMPORT_ROWS.toLocaleString()} leads, 2 MB</span>
          </label>
        </div>
      )}

      {preview && (
        <div className="flex flex-col gap-4">
          <p className="text-body text-navaro-muted">
            {fileName} · {preview.total.toLocaleString()} row{preview.total === 1 ? '' : 's'}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="Ready to import"
              value={preview.valid}
              detail={`${preview.individuals.toLocaleString()} individual${preview.individuals === 1 ? '' : 's'} · ${preview.companies.toLocaleString()} compan${preview.companies === 1 ? 'y' : 'ies'}`}
              className="bg-navaro-turquoise"
            />
            <Stat label="Duplicates skipped" value={preview.duplicates} className="bg-navaro-yellow" />
            <Stat label="Invalid rows" value={preview.invalid} className={preview.invalid ? 'bg-danger text-white' : 'bg-navaro-hover'} />
          </div>
          {ignored.length > 0 && (
            <p className="text-label text-navaro-muted">Ignored columns: {ignored.join(', ')}</p>
          )}
          {preview.samples.length > 0 && (
            <div>
              <p className="mb-1.5 text-label font-medium text-navaro-green">How the first rows will be imported</p>
              <div className="overflow-x-auto rounded-control border border-navaro-line">
                <table className="w-full text-left text-label">
                  <thead className="bg-navaro-heath text-navaro-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Line</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Company</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navaro-line">
                    {preview.samples.map((s) => (
                      <tr key={s.line}>
                        <td className="px-3 py-2">{s.line}</td>
                        <td className="px-3 py-2">
                          <Badge tone={s.type === 'company' ? 'lavenderSolid' : 'green'}>{s.type === 'company' ? 'Company' : 'Individual'}</Badge>
                        </td>
                        <td className="px-3 py-2">{s.type === 'company' ? '—' : s.name}</td>
                        <td className="px-3 py-2">{s.company}</td>
                        <td className="px-3 py-2">{s.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {problems.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-control border border-navaro-line">
              <table className="w-full text-left text-label">
                <thead className="sticky top-0 bg-navaro-heath text-navaro-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Line</th>
                    <th className="px-3 py-2 font-medium">Lead</th>
                    <th className="px-3 py-2 font-medium">Issue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navaro-line">
                  {problems.map((r) => (
                    <tr key={r.line}>
                      <td className="px-3 py-2">{r.line}</td>
                      <td className="px-3 py-2">{r.name || r.email || '—'}</td>
                      <td className="px-3 py-2">
                        <Badge tone={r.status === 'duplicate' ? 'yellowSolid' : 'dangerSolid'}>{r.status === 'duplicate' ? 'Duplicate' : 'Invalid'}</Badge>{' '}
                        {r.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview.problemsTruncated && (
            <p className="text-label text-navaro-muted">
              Showing the first {preview.rows.length} of {(preview.invalid + preview.duplicates).toLocaleString()} rows that will be skipped.
            </p>
          )}
          {preview.valid === 0 && <p className="text-sm text-danger">Nothing in this file can be imported.</p>}
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, detail, className }: { label: string; value: number; detail?: string; className: string }) {
  return (
    <div className={`rounded-card p-4 text-navaro-green ${className}`}>
      <p className="text-display">{value.toLocaleString()}</p>
      <p className="mt-1 text-label">{label}</p>
      {detail && <p className="mt-0.5 text-label opacity-80">{detail}</p>}
    </div>
  );
}
