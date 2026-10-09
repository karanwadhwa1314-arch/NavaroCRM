import type { BroadcastStatus } from '@/lib/constants';

export interface BroadcastAttachmentInfo {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

/** A broadcast as returned by the list API (no body). */
export interface BroadcastItem {
  id: string;
  subject: string;
  preview: string;
  attachments: BroadcastAttachmentInfo[];
  status: BroadcastStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  fromEmail: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  lastError: string | null;
}

/** A single broadcast including its body (detail API). */
export interface BroadcastDetail extends BroadcastItem {
  content: string;
  /** Server-rendered HTML exactly as recipients get it (sample first name). */
  previewHtml: string;
}

export const canEditBroadcast = (b: Pick<BroadcastItem, 'status'>) => b.status === 'draft' || b.status === 'scheduled';
export const canSendBroadcast = canEditBroadcast;
export const canRetryBroadcast = (b: Pick<BroadcastItem, 'status' | 'failedCount'>) => b.status === 'failed' || (b.status === 'sent' && b.failedCount > 0);
export const canDeleteBroadcast = (b: Pick<BroadcastItem, 'status' | 'sentCount'>) =>
  (b.status === 'draft' || b.status === 'scheduled' || b.status === 'failed') && b.sentCount === 0;
