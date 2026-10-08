'use client';

import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, format, isBefore } from 'date-fns';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { CalendarPicker } from '@/components/broadcasts/CalendarPicker';
import { RichTextEditor } from '@/components/broadcasts/RichTextEditor';
import { LocalDateTime, localTimezoneName } from '@/components/broadcasts/LocalDateTime';
import { useSession } from '@/components/providers/SessionProvider';
import { api, ApiError } from '@/lib/api-client';
import { BROADCAST_STATUS_LABELS } from '@/lib/constants';
import type { BroadcastDetail, BroadcastItem } from '@/components/broadcasts/types';

interface BroadcastModalProps {
  open: boolean;
  onClose: () => void;
  /** Present when editing an existing draft/scheduled broadcast. */
  editing: BroadcastItem | null;
  /** All current broadcasts — the source of the "Previous broadcasts" timeline (read live from the database via the page). */
  existing: BroadcastItem[];
  onSaved: () => void;
}

function visibleText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/ /g, ' ').trim();
}

function combine(day: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

const stepClass = (active: boolean, done: boolean) =>
  clsx(
    'flex h-7 w-7 items-center justify-center rounded-full border-2 text-label font-medium transition-colors',
    done || active ? 'border-navaro-green bg-navaro-green text-navaro-heath' : 'border-navaro-line text-navaro-muted'
  );

export function BroadcastModal({ open, onClose, editing, existing, onSaved }: BroadcastModalProps) {
  const { can } = useSession();
  const canSchedule = can('broadcasts.send');

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'schedule' | null>(null);
  const [subject, setSubject] = useState('');
  const [preview, setPreview] = useState('');
  const [html, setHtml] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const [initialHtml, setInitialHtml] = useState('');
  const [day, setDay] = useState<Date | null>(null);
  const [time, setTime] = useState('10:00');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset (or load the broadcast being edited) every time the modal opens.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setErrors({});
    setSaving(null);
    setDay(null);
    setTime('10:00');
    if (!editing) {
      setSubject('');
      setPreview('');
      setHtml('');
      setInitialHtml('');
      setEditorKey((k) => k + 1);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<BroadcastDetail>(`/api/broadcasts/${editing.id}`)
      .then((b) => {
        if (cancelled) return;
        setSubject(b.subject);
        setPreview(b.preview);
        setHtml(b.content);
        setInitialHtml(b.content);
        setEditorKey((k) => k + 1);
        if (b.scheduledAt) {
          const d = new Date(b.scheduledAt);
          setDay(d);
          setTime(format(d, 'HH:mm'));
        }
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : 'Could not load this broadcast');
        onClose();
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  // "Previous broadcasts": derived from real records. Drafts have no schedule so they are not on the timeline.
  const timeline = useMemo(
    () =>
      existing
        .filter((b) => b.id !== editing?.id && b.status !== 'draft' && (b.sentAt || b.scheduledAt))
        .map((b) => ({ ...b, when: new Date((b.status === 'sent' ? b.sentAt : b.scheduledAt) ?? b.scheduledAt!) }))
        .sort((a, b) => a.when.getTime() - b.when.getTime()),
    [existing, editing?.id]
  );
  const markedDays = useMemo(() => new Set(timeline.map((t) => format(t.when, 'yyyy-MM-dd'))), [timeline]);

  const selected = day ? combine(day, time) : null;
  const previousBefore = selected ? [...timeline].reverse().find((t) => t.when.getTime() < selected.getTime()) : undefined;

  function validateContent(): boolean {
    const e: Record<string, string> = {};
    if (!subject.trim()) e.subject = 'Subject is required';
    if (!preview.trim()) e.preview = 'Preview is required';
    if (!visibleText(html)) e.content = 'Email content is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function apiErrors(err: unknown) {
    if (err instanceof ApiError) {
      if (err.errors?.length) {
        const fe: Record<string, string> = {};
        for (const e of err.errors) fe[e.field === 'scheduledAt' ? 'schedule' : e.field] = e.message;
        setErrors(fe);
        if (fe.subject || fe.preview || fe.content) setStep(1);
      } else {
        toast.error(err.message);
      }
    } else {
      toast.error('Something went wrong. Please try again.');
    }
  }

  async function save(mode: 'draft' | 'schedule') {
    if (!validateContent()) {
      setStep(1);
      return;
    }
    let scheduledAt: string | null = null;
    if (mode === 'schedule') {
      if (!selected) {
        setErrors({ schedule: 'Choose a date' });
        return;
      }
      if (!isBefore(new Date(), selected)) {
        setErrors({ schedule: 'Choose a date and time in the future' });
        return;
      }
      scheduledAt = selected.toISOString();
    }

    setSaving(mode);
    try {
      const body = { subject, preview, content: html, scheduledAt };
      if (editing) await api.put(`/api/broadcasts/${editing.id}`, body);
      else await api.post('/api/broadcasts', body);
      toast.success(mode === 'draft' ? 'Draft saved' : `Broadcast scheduled for ${format(selected!, "MMM d, yyyy 'at' h:mm a")}`);
      onSaved();
      onClose();
    } catch (err) {
      apiErrors(err);
    } finally {
      setSaving(null);
    }
  }

  const title = step === 1 ? (editing ? 'Edit mail broadcast' : 'Add new mail broadcast') : 'Schedule broadcast';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="xl"
      preventClose={saving !== null}
      footer={
        step === 1 ? (
          <>
            <Button variant="secondary" onClick={() => void save('draft')} loading={saving === 'draft'} disabled={loading || saving === 'schedule'}>
              Save as draft
            </Button>
            <Button
              onClick={() => {
                if (validateContent()) setStep(2);
              }}
              disabled={loading}
            >
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep(1)} disabled={saving !== null}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={() => void save('schedule')} loading={saving === 'schedule'} disabled={!canSchedule || saving === 'draft'}>
              Schedule broadcast
            </Button>
          </>
        )
      }
    >
      <ol className="mb-5 flex items-center gap-3" aria-label="Progress">
        <li className="flex items-center gap-2" aria-current={step === 1 ? 'step' : undefined}>
          <span className={stepClass(step === 1, step === 2)}>{step === 2 ? <Check className="h-4 w-4" /> : 1}</span>
          <span className={clsx('text-sm', step === 1 ? 'font-medium text-navaro-green' : 'text-navaro-muted')}>Content</span>
        </li>
        <span className={clsx('h-0.5 flex-1 rounded-full', step === 2 ? 'bg-navaro-green' : 'bg-navaro-line')} aria-hidden="true" />
        <li className="flex items-center gap-2" aria-current={step === 2 ? 'step' : undefined}>
          <span className={stepClass(step === 2, false)}>2</span>
          <span className={clsx('text-sm', step === 2 ? 'font-medium text-navaro-green' : 'text-navaro-muted')}>Schedule</span>
        </li>
      </ol>

      {/* Stage 1 stays mounted (just hidden) so the editor keeps its content when going Back. */}
      <div className={step === 1 ? 'flex flex-col gap-4' : 'hidden'}>
        {loading ? (
          <div className="flex flex-col gap-4" aria-busy="true">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-56" />
          </div>
        ) : (
          <>
            <Field label="Subject" required error={errors.subject}>
              {(p) => <Input {...p} value={subject} maxLength={300} onChange={(e) => setSubject(e.target.value)} error={Boolean(errors.subject)} />}
            </Field>
            <Field label="Preview" required error={errors.preview} hint="The short line shown next to the subject in the inbox.">
              {(p) => <Input {...p} value={preview} maxLength={300} onChange={(e) => setPreview(e.target.value)} error={Boolean(errors.preview)} />}
            </Field>
            <Field label="Email content" required error={errors.content} hint="Use the person icon to insert the lead's first name.">
              {(p) => (
                <RichTextEditor
                  key={editorKey}
                  id={p.id}
                  aria-describedby={p['aria-describedby']}
                  initialHtml={initialHtml}
                  error={Boolean(errors.content)}
                  onChange={setHtml}
                />
              )}
            </Field>
          </>
        )}
      </div>

      {step === 2 && (
        <div className={clsx('grid grid-cols-[minmax(0,1fr)] gap-6', timeline.length > 0 && 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]')}>
          <div className="flex min-w-0 flex-col gap-4">
            <div>
              <p className="mb-2 text-label font-medium text-navaro-green">Select date</p>
              <CalendarPicker value={day} onChange={setDay} markedDays={markedDays} />
            </div>
            <Field label="Time" hint={`In your local time (${localTimezoneName()}).`} error={errors.schedule}>
              {(p) => <Input {...p} type="time" value={time} onChange={(e) => setTime(e.target.value || '10:00')} className="w-40" />}
            </Field>

            <div className="rounded-card border border-navaro-line bg-navaro-heath p-4" aria-live="polite">
              <p className="text-label text-navaro-muted">Schedule broadcast</p>
              {selected ? (
                <>
                  <p className="mt-1 text-h3 text-navaro-green">{format(selected, 'MMMM d, yyyy')}</p>
                  <p className="text-body text-navaro-green">{format(selected, 'h:mm a')}</p>
                  {previousBefore && (
                    <p className="mt-2 text-label text-navaro-muted">
                      {Math.max(0, differenceInCalendarDays(selected, previousBefore.when))} days after &ldquo;{previousBefore.subject}&rdquo;
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-body text-navaro-muted">Pick a date to continue.</p>
              )}
            </div>
            {!canSchedule && (
              <p className="rounded-control bg-navaro-yellow px-3 py-2 text-sm text-navaro-green" role="alert">
                You can save this as a draft, but scheduling needs the send permission.
              </p>
            )}
            <p className="text-label text-navaro-muted">It will be sent to all existing leads in the CRM.</p>
          </div>

          {timeline.length > 0 && (
            <section aria-labelledby="previous-broadcasts" className="min-w-0">
              <p id="previous-broadcasts" className="mb-2 text-label font-medium text-navaro-green">
                Previous broadcasts
              </p>
              <ol className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
                {timeline.map((t, i) => (
                  <li key={t.id} className="rounded-control border border-navaro-line bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-navaro-green">
                        {t.status === 'sent' && <Check className="h-4 w-4 text-navaro-green" aria-label="Sent" />}
                        Email {i + 1}
                      </p>
                      <Badge tone={t.status === 'sent' ? 'green' : t.status === 'failed' ? 'dangerSolid' : t.status === 'sending' ? 'turquoiseSolid' : 'yellowSolid'}>
                        {BROADCAST_STATUS_LABELS[t.status]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-label text-navaro-muted" title={t.subject}>
                      {t.subject}
                    </p>
                    <p className="mt-0.5 text-label text-navaro-green">
                      <LocalDateTime value={t.when} />
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
