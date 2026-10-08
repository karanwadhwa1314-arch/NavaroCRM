'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { AlertCircle, Mail, MoreVertical, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { BroadcastModal } from '@/components/broadcasts/BroadcastModal';
import { BroadcastViewModal } from '@/components/broadcasts/BroadcastViewModal';
import { BroadcastStatusBadge } from '@/components/broadcasts/BroadcastStatusBadge';
import { LocalDateTime } from '@/components/broadcasts/LocalDateTime';
import { useSession } from '@/components/providers/SessionProvider';
import { api, ApiError } from '@/lib/api-client';
import { canDeleteBroadcast, canEditBroadcast, canRetryBroadcast, canSendBroadcast, type BroadcastItem } from '@/components/broadcasts/types';

interface Props {
  items: BroadcastItem[];
  emailConfigured: boolean;
  sender: string;
  leadCount: number;
}

type Pending = { kind: 'send' | 'retry' | 'delete'; broadcast: BroadcastItem } | null;

export function BroadcastsClient({ items, emailConfigured, sender, leadCount }: Props) {
  const { can } = useSession();
  const router = useRouter();

  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<BroadcastItem | null>(null);
  const [viewing, setViewing] = useState<BroadcastItem | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  // While anything is sending, keep the progress fresh (stops by itself once nothing is sending).
  const anySending = items.some((b) => b.status === 'sending');
  useEffect(() => {
    if (!anySending) return;
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [anySending, router]);

  const refresh = () => router.refresh();

  function openComposer(b: BroadcastItem | null) {
    setViewing(null);
    setEditing(b);
    setComposerOpen(true);
  }

  async function confirm() {
    if (!pending) return;
    const { kind, broadcast } = pending;
    setBusy(true);
    try {
      if (kind === 'delete') {
        await api.delete(`/api/broadcasts/${broadcast.id}`);
        toast.success('Broadcast deleted');
      } else {
        const res = await api.post<BroadcastItem>(`/api/broadcasts/${broadcast.id}/${kind === 'send' ? 'send' : 'retry'}`);
        if (res.status === 'sent') toast.success(`Broadcast sent to ${res.sentCount.toLocaleString()} leads`);
        else if (res.status === 'sending') toast.success('Sending has started. The rest will finish automatically.');
        else if (res.status === 'failed') toast.error(res.lastError ?? 'The broadcast could not be sent');
      }
      setPending(null);
      setViewing(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setPending(null);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  const confirmCopy = {
    send: {
      title: 'Broadcast now?',
      body: `This email will be sent immediately to all existing leads (about ${leadCount.toLocaleString()} recipients). This can't be undone.`,
      label: 'Broadcast now',
      variant: 'primary' as const,
    },
    retry: {
      title: 'Retry this broadcast?',
      body: 'Only recipients who have not received it yet will be sent the email. Nobody gets it twice.',
      label: 'Retry',
      variant: 'primary' as const,
    },
    delete: {
      title: 'Delete this broadcast?',
      body: "It will not be sent and will disappear from the schedule. This can't be undone.",
      label: 'Delete',
      variant: 'danger' as const,
    },
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 text-navaro-green">Broadcasts</h1>
          <p className="mt-1 text-body text-navaro-muted">Email every lead in your CRM, now or on a schedule. Sent from {sender}.</p>
        </div>
        {can('broadcasts.create') && (
          <Button onClick={() => openComposer(null)}>
            <Plus className="h-4 w-4" /> Add new mail broadcast
          </Button>
        )}
      </div>

      {!emailConfigured && (
        <div className="flex items-start gap-2 rounded-control bg-navaro-yellow px-4 py-3 text-sm text-navaro-green" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Email sending isn&rsquo;t set up yet, so broadcasts can be saved but not sent. Ask an administrator to add the Resend API key.</span>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No broadcasts yet"
          body="Create your first email broadcast to get started."
          action={can('broadcasts.create') ? <Button onClick={() => openComposer(null)}>Add new mail broadcast</Button> : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((b) => (
            <li key={b.id}>
              <Card padding={false} className="transition-colors hover:border-navaro-green/40">
                <div className="flex items-start gap-3 p-5">
                  <button type="button" onClick={() => setViewing(b)} className="min-w-0 flex-1 text-left" aria-label={`Open broadcast: ${b.subject}`}>
                    <p className="truncate text-h3 text-navaro-green">{b.subject}</p>
                    <p className="mt-1 line-clamp-2 text-body text-navaro-muted">{b.preview}</p>
                    <div className="mt-3">
                      <StatusLine b={b} />
                    </div>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <BroadcastStatusBadge status={b.status} />
                    <Menu
                      trigger={
                        <IconButton aria-label={`Actions for ${b.subject}`} size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </IconButton>
                      }
                    >
                      <MenuItem onClick={() => setViewing(b)}>View email</MenuItem>
                      {can('broadcasts.edit') && canEditBroadcast(b) && <MenuItem onClick={() => openComposer(b)}>Edit</MenuItem>}
                      {can('broadcasts.send') && canSendBroadcast(b) && <MenuItem onClick={() => setPending({ kind: 'send', broadcast: b })}>Broadcast now</MenuItem>}
                      {can('broadcasts.send') && canRetryBroadcast(b) && <MenuItem onClick={() => setPending({ kind: 'retry', broadcast: b })}>Retry</MenuItem>}
                      {can('broadcasts.delete') && canDeleteBroadcast(b) && (
                        <MenuItem danger onClick={() => setPending({ kind: 'delete', broadcast: b })}>
                          Delete
                        </MenuItem>
                      )}
                    </Menu>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <BroadcastModal open={composerOpen} onClose={() => setComposerOpen(false)} editing={editing} existing={items} onSaved={refresh} />

      <BroadcastViewModal
        broadcast={viewing ? (items.find((i) => i.id === viewing.id) ?? viewing) : null}
        onClose={() => setViewing(null)}
        onEdit={(b) => openComposer(b)}
        onSendNow={(b) => setPending({ kind: 'send', broadcast: b })}
        onRetry={(b) => setPending({ kind: 'retry', broadcast: b })}
        onDelete={(b) => setPending({ kind: 'delete', broadcast: b })}
      />

      {pending && (
        <ConfirmDialog
          open
          onClose={() => !busy && setPending(null)}
          onConfirm={() => void confirm()}
          title={busy && pending.kind !== 'delete' ? 'Sending broadcast…' : confirmCopy[pending.kind].title}
          body={busy && pending.kind !== 'delete' ? "Please keep this window open. This can take a little while for a large list." : confirmCopy[pending.kind].body}
          confirmLabel={confirmCopy[pending.kind].label}
          variant={confirmCopy[pending.kind].variant}
          loading={busy}
        />
      )}
    </div>
  );
}

function StatusLine({ b }: { b: BroadcastItem }) {
  if (b.status === 'sent') {
    return (
      <p className="text-sm text-navaro-muted">
        Sent <LocalDateTime value={b.sentAt} />
        {` · ${b.sentCount.toLocaleString()} delivered`}
        {b.failedCount > 0 ? ` · ${b.failedCount.toLocaleString()} rejected` : ''}
      </p>
    );
  }
  if (b.status === 'scheduled') {
    return (
      <div className="text-sm text-navaro-green">
        <p className="text-navaro-muted">Scheduled for</p>
        <p className="font-medium">
          <LocalDateTime value={b.scheduledAt} />
        </p>
      </div>
    );
  }
  if (b.status === 'sending') {
    const pct = b.recipientCount ? Math.round(((b.sentCount + b.failedCount) / b.recipientCount) * 100) : 0;
    return (
      <div className="text-sm text-navaro-green" aria-live="polite">
        <p className="font-medium">Sending… {b.recipientCount ? `${(b.sentCount + b.failedCount).toLocaleString()} of ${b.recipientCount.toLocaleString()}` : ''}</p>
        <div className="mt-1.5 h-1.5 w-48 overflow-hidden rounded-full bg-navaro-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-navaro-turquoise transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        </div>
        {b.lastError && <p className="mt-1 text-label text-navaro-muted">{b.lastError}</p>}
      </div>
    );
  }
  if (b.status === 'failed') {
    return (
      <p className="text-sm text-danger">
        {b.lastError ?? 'This broadcast could not be sent.'}
        {b.sentCount > 0 ? ` ${b.sentCount.toLocaleString()} recipients already received it.` : ''}
      </p>
    );
  }
  return <p className="text-sm text-navaro-muted">Draft, not scheduled</p>;
}
