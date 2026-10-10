'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { CalendarClock, Paperclip, Plus, Repeat, Trash2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { CardFormModal, fromLocalInput, type CardFormValues, type CardRecord, type Member } from '@/components/projects/CardFormModal';
import { useSession } from '@/components/providers/SessionProvider';
import { api, ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { CARD_RECURRENCE_LABELS, CARD_STATUSES, CARD_STATUS_LABELS, DONE_CARD_RETENTION_DAYS, type CardStatus } from '@/lib/constants';

interface CardBoardProps {
  projectId: string;
  projectEnded: boolean;
  members: Member[];
  cards: CardRecord[];
  /** Health is at its floor, so the API will refuse new cards. */
  healthCritical: boolean;
}

export function CardBoard({ projectId, projectEnded, members, cards, healthCritical }: CardBoardProps) {
  const { user, can } = useSession();
  const router = useRouter();

  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CardRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteCard, setDeleteCard] = useState<CardRecord | null>(null);
  const [deadlinePrompt, setDeadlinePrompt] = useState<CardRecord | null>(null);
  const [deadlineValue, setDeadlineValue] = useState('');

  const canEdit = can('projects.edit') && !projectEnded;
  const canDelete = can('projects.delete') && !projectEnded;

  const people = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cards) for (const a of c.assignees) map.set(a.id, `${a.firstName} ${a.lastName}`);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);

  const visible = cards.filter((c) => !assigneeFilter || c.assignees.some((a) => a.id === (assigneeFilter === 'me' ? user.id : assigneeFilter)));

  function openNew() {
    setEditing(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(card: CardRecord) {
    setEditing(card);
    setFieldErrors({});
    setFormOpen(true);
  }

  function collectErrors(err: ApiError): Record<string, string> {
    const fe: Record<string, string> = {};
    for (const e of err.errors ?? []) fe[e.field] = e.message;
    return fe;
  }

  async function handleSubmit(values: CardFormValues) {
    setSubmitting(true);
    setFieldErrors({});
    const recurrence =
      values.recurrenceType === 'weekly'
        ? { type: 'weekly', daysOfWeek: values.daysOfWeek }
        : values.recurrenceType === 'monthly'
          ? { type: 'monthly', dayOfMonth: parseInt(values.dayOfMonth, 10) }
          : { type: values.recurrenceType };
    const payload = {
      title: values.title,
      description: values.description,
      fileLink: values.fileLink.trim(),
      status: values.status,
      assignees: values.assignees,
      deadline: fromLocalInput(values.deadline),
      recurrence,
    };
    try {
      if (editing) {
        await api.put(`/api/projects/${projectId}/cards/${editing.id}`, payload);
        toast.success('Card updated');
      } else {
        await api.post(`/api/projects/${projectId}/cards`, payload);
        toast.success('Card added');
      }
      setFormOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = collectErrors(err);
        if (Object.keys(fe).length > 0) setFieldErrors(fe);
        else toast.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(card: CardRecord, status: CardStatus, deadline?: string | null) {
    setBusyId(card.id);
    try {
      await api.put(`/api/projects/${projectId}/cards/${card.id}`, deadline ? { status, deadline } : { status });
      if (status === 'done') toast.success(card.recurrence.type !== 'none' ? 'Card done. The next one has been created.' : 'Card done');
      setDeadlinePrompt(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function handleStatusSelect(card: CardRecord, status: CardStatus) {
    if (status === card.status) return;
    if (status === 'in_progress' && !card.deadline) {
      setDeadlinePrompt(card);
      setDeadlineValue('');
      return;
    }
    void changeStatus(card, status);
  }

  async function handleDelete() {
    if (!deleteCard) return;
    setSubmitting(true);
    try {
      await api.delete(`/api/projects/${projectId}/cards/${deleteCard.id}`);
      toast.success('Card deleted');
      setDeleteCard(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const now = Date.now();

  return (
    <Card padding={false}>
      <CardHeader
        title="Cards"
        action={
          <div className="flex items-center gap-3">
            <Select aria-label="Filter cards by person" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="w-36 sm:w-44">
              <option value="">All cards</option>
              <option value="me">My cards</option>
              {people
                .filter((p) => p.id !== user.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </Select>
            {can('projects.edit') && (
              <Button size="sm" className="whitespace-nowrap" onClick={openNew} disabled={projectEnded || healthCritical} title={healthCritical ? 'Health is critically low: resolve missed deadlines first' : undefined}>
                <Plus className="h-4 w-4" /> Add card
              </Button>
            )}
          </div>
        }
      />
      <div className="p-6">
        {healthCritical && !projectEnded && (
          <p role="status" className="mb-4 rounded-control bg-danger-tint px-4 py-3 text-sm text-danger">
            Project health is critically low. Resolve missed deadlines before adding new cards.
          </p>
        )}
        {cards.length === 0 ? (
          <p className="py-6 text-center text-body text-navaro-muted">
            No cards yet.{canEdit ? ' Add the first card to start planning the work.' : ''}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {CARD_STATUSES.map((status) => {
              const column = visible.filter((c) => c.status === status);
              return (
                <section key={status} aria-label={CARD_STATUS_LABELS[status]} className="flex min-w-0 flex-col gap-3">
                  <h3 className="flex items-center gap-2 text-h3 text-navaro-green">
                    {CARD_STATUS_LABELS[status]}
                    <Badge tone="neutral">{column.length}</Badge>
                  </h3>
                  {status === 'done' && column.length > 0 && (
                    <p className="-mt-1 text-label text-navaro-muted">Done cards are removed after {DONE_CARD_RETENTION_DAYS} days.</p>
                  )}
                  {column.length === 0 ? (
                    <p className="rounded-control border border-dashed border-navaro-line px-3 py-6 text-center text-sm text-navaro-muted">No cards</p>
                  ) : (
                    column.map((card) => {
                      const locked = card.status === 'done' || projectEnded;
                      const overdue = card.deadline && card.status !== 'done' && new Date(card.deadline).getTime() < now;
                      return (
                        <article key={card.id} className="rounded-card border border-navaro-line bg-white p-4">
                          <div className="flex items-start justify-between gap-2">
                            {locked || !canEdit ? (
                              <div className="min-w-0 flex-1">
                                <p className="break-words text-sm font-medium text-navaro-green">{card.title}</p>
                              </div>
                            ) : (
                              <button type="button" onClick={() => openEdit(card)} className="min-w-0 flex-1 text-left" aria-label={`Edit card ${card.title}`}>
                                <p className="break-words text-sm font-medium text-navaro-green underline-offset-2 hover:underline">{card.title}</p>
                              </button>
                            )}
                            {canDelete && (
                              <IconButton aria-label={`Delete card ${card.title}`} size="sm" onClick={() => setDeleteCard(card)}>
                                <Trash2 className="h-4 w-4" />
                              </IconButton>
                            )}
                          </div>
                          {card.description && <p className="mt-1 break-words text-label text-navaro-muted">{card.description}</p>}

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {card.deadline && (
                              <Badge tone={overdue ? 'dangerSolid' : 'neutral'} className="gap-1">
                                <CalendarClock className="h-3 w-3" aria-hidden="true" />
                                {overdue ? 'Overdue · ' : 'Due '}
                                {formatDate(card.deadline, 'd MMM, h:mm a')}
                              </Badge>
                            )}
                            {card.recurrence.type !== 'none' && (
                              <Badge tone="lavender" className="gap-1">
                                <Repeat className="h-3 w-3" aria-hidden="true" />
                                {CARD_RECURRENCE_LABELS[card.recurrence.type]}
                              </Badge>
                            )}
                          </div>

                          {card.assignees.length > 0 && (
                            <div className="mt-3 flex items-center gap-2" aria-label={`Assigned to ${card.assignees.map((a) => `${a.firstName} ${a.lastName}`).join(', ')}`}>
                              <div className="flex -space-x-1.5">
                                {card.assignees.map((a) => (
                                  <span key={a.id} title={`${a.firstName} ${a.lastName}`} className="rounded-full ring-2 ring-white">
                                    <Avatar firstName={a.firstName} lastName={a.lastName} size={24} />
                                  </span>
                                ))}
                              </div>
                              <span className="truncate text-label text-navaro-muted">{card.assignees.map((a) => a.firstName).join(', ')}</span>
                            </div>
                          )}

                          {card.fileLink && (
                            <a
                              href={card.fileLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex items-center gap-1 break-all text-label text-navaro-green underline"
                            >
                              <Paperclip className="h-3 w-3 shrink-0" aria-hidden="true" /> Attached file
                            </a>
                          )}

                          {canEdit && (
                            <Select
                              aria-label={`Status of ${card.title}`}
                              value={card.status}
                              onChange={(e) => handleStatusSelect(card, e.target.value as CardStatus)}
                              disabled={locked || busyId === card.id}
                              className="mt-3 h-8 text-label"
                            >
                              {CARD_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {CARD_STATUS_LABELS[s]}
                                </option>
                              ))}
                            </Select>
                          )}
                        </article>
                      );
                    })
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <CardFormModal open={formOpen} onClose={() => setFormOpen(false)} card={editing} members={members} submitting={submitting} fieldErrors={fieldErrors} onSubmit={handleSubmit} />

      <Modal
        open={Boolean(deadlinePrompt)}
        onClose={() => setDeadlinePrompt(null)}
        title="Set a deadline"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeadlinePrompt(null)}>
              Cancel
            </Button>
            <Button
              disabled={!deadlineValue}
              loading={busyId === deadlinePrompt?.id}
              onClick={() => deadlinePrompt && changeStatus(deadlinePrompt, 'in_progress', fromLocalInput(deadlineValue))}
            >
              Move to in progress
            </Button>
          </>
        }
      >
        <p className="mb-3 text-body text-navaro-green">“{deadlinePrompt?.title}” needs a deadline before it can move to in progress.</p>
        <Field label="Deadline" required>
          {(p) => <Input {...p} type="datetime-local" value={deadlineValue} onChange={(e) => setDeadlineValue(e.target.value)} />}
        </Field>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteCard)}
        onClose={() => setDeleteCard(null)}
        onConfirm={handleDelete}
        title={`Delete card “${deleteCard?.title ?? ''}”?`}
        body="This can’t be undone."
        confirmLabel="Delete"
        loading={submitting}
      />
    </Card>
  );
}
