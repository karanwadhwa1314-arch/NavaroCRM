'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertCircle, Paperclip } from 'lucide-react';
import { formatBytes } from '@/lib/broadcast-attachment-rules';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { BroadcastStatusBadge } from '@/components/broadcasts/BroadcastStatusBadge';
import { LocalDateTime } from '@/components/broadcasts/LocalDateTime';
import { useSession } from '@/components/providers/SessionProvider';
import { api, ApiError } from '@/lib/api-client';
import { canDeleteBroadcast, canEditBroadcast, canRetryBroadcast, canSendBroadcast, type BroadcastDetail, type BroadcastItem } from '@/components/broadcasts/types';

interface Props {
  broadcast: BroadcastItem | null;
  onClose: () => void;
  onEdit: (b: BroadcastItem) => void;
  onSendNow: (b: BroadcastItem) => void;
  onRetry: (b: BroadcastItem) => void;
  onDelete: (b: BroadcastItem) => void;
}

export function BroadcastViewModal({ broadcast, onClose, onEdit, onSendNow, onRetry, onDelete }: Props) {
  const { can } = useSession();
  const [detail, setDetail] = useState<BroadcastDetail | null>(null);

  useEffect(() => {
    setDetail(null);
    if (!broadcast) return;
    let cancelled = false;
    api
      .get<BroadcastDetail>(`/api/broadcasts/${broadcast.id}`)
      .then((d) => !cancelled && setDetail(d))
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : 'Could not load this broadcast');
        onClose();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcast?.id]);

  // List data keeps the status/counts fresh while the body comes from the detail request.
  const b = broadcast ? { ...(detail ?? broadcast), ...broadcast } : null;

  return (
    <Modal
      open={Boolean(broadcast)}
      onClose={onClose}
      title={b?.subject ?? 'Broadcast'}
      size="xl"
      footer={
        b && (
          <>
            {can('broadcasts.delete') && canDeleteBroadcast(b) && (
              <Button variant="danger" onClick={() => onDelete(b)} className="mr-auto">
                Delete
              </Button>
            )}
            {can('broadcasts.edit') && canEditBroadcast(b) && (
              <Button variant="secondary" onClick={() => onEdit(b)}>
                Edit
              </Button>
            )}
            {can('broadcasts.send') && canRetryBroadcast(b) && (
              <Button variant="secondary" onClick={() => onRetry(b)}>
                {b.status === 'sent' ? 'Retry rejected recipients' : 'Retry'}
              </Button>
            )}
            {can('broadcasts.send') && canSendBroadcast(b) && <Button onClick={() => onSendNow(b)}>Broadcast now</Button>}
          </>
        )
      }
    >
      {b && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <BroadcastStatusBadge status={b.status} />
            <Meta label="Created">
              <LocalDateTime value={b.createdAt} />
            </Meta>
            {b.scheduledAt && (
              <Meta label={b.status === 'scheduled' ? 'Scheduled for' : 'Was scheduled for'}>
                <LocalDateTime value={b.scheduledAt} />
              </Meta>
            )}
            {b.sentAt && (
              <Meta label="Sent">
                <LocalDateTime value={b.sentAt} />
              </Meta>
            )}
            {b.recipientCount > 0 && (
              <Meta label="Recipients">
                {b.sentCount.toLocaleString()} delivered{b.failedCount > 0 ? ` · ${b.failedCount.toLocaleString()} rejected` : ''} of {b.recipientCount.toLocaleString()}
              </Meta>
            )}
            {b.fromEmail && <Meta label="From">{b.fromEmail}</Meta>}
          </div>

          {b.lastError && (
            <div className="flex items-start gap-2 rounded-control bg-danger-tint px-3 py-2 text-sm text-danger" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{b.lastError}</span>
            </div>
          )}

          <div>
            <p className="text-label text-navaro-muted">Preview text</p>
            <p className="text-body text-navaro-green">{b.preview}</p>
          </div>

          {b.attachments?.length > 0 && (
            <div>
              <p className="mb-1.5 text-label text-navaro-muted">Attachments (sent with the email)</p>
              <ul className="flex flex-col gap-1.5">
                {b.attachments.map((a) => (
                  <li key={a.id}>
                    <a
                      href={`/api/broadcasts/${b.id}/attachments/${a.id}`}
                      className="inline-flex max-w-full items-center gap-2 rounded-control border border-navaro-line bg-white px-3 py-2 text-sm text-navaro-green hover:bg-navaro-hover"
                    >
                      <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{a.filename}</span>
                      <span className="shrink-0 text-label text-navaro-muted">{formatBytes(a.size)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="mb-2 text-label text-navaro-muted">Email as recipients will see it (<code>{'{{first_name}}'}</code> becomes each lead&rsquo;s own first name)</p>
            {detail ? (
              // Sandboxed (no scripts, no same-origin access): the stored HTML is also sanitised server-side.
              <iframe title="Email preview" sandbox="" srcDoc={detail.previewHtml} className="h-[420px] w-full rounded-control border border-navaro-line bg-white" />
            ) : (
              <Skeleton className="h-[420px]" />
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-navaro-green">
      <span className="text-navaro-muted">{label}: </span>
      {children}
    </p>
  );
}
