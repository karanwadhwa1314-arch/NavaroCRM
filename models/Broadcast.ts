import mongoose, { Schema, type Model, type Document, type Types } from 'mongoose';
import { BROADCAST_STATUSES, type BroadcastStatus } from '@/lib/constants';

export interface BroadcastAttachmentMeta {
  _id: Types.ObjectId;
  filename: string;
  contentType: string;
  size: number;
}

export interface BroadcastDocument extends Document {
  subject: string;
  preview: string;
  /** Sanitised HTML — the single source of truth for what gets sent. */
  content: string;
  /** Files attached to every recipient's email. The bytes live in BroadcastAttachment (same _id). */
  attachments: BroadcastAttachmentMeta[];
  status: BroadcastStatus;
  scheduledAt?: Date | null;
  /** When sending first began. */
  startedAt?: Date | null;
  /** When the last recipient was processed (set once nothing is pending). */
  sentAt?: Date | null;
  createdBy?: Types.ObjectId;
  /** Sender used (snapshotted so history stays accurate if config changes later). */
  fromEmail?: string;
  /** Lease: a worker owns this broadcast until this time. Null/expired = claimable. */
  lockedUntil?: Date | null;
  /** Set when the recipient snapshot (BroadcastDelivery rows) has been taken. */
  audienceSnapshotAt?: Date | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  transientFailures: number;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentMetaSchema = new Schema<BroadcastAttachmentMeta>(
  {
    filename: { type: String, required: true, maxlength: 100 },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: true }
);

const BroadcastSchema = new Schema<BroadcastDocument>(
  {
    subject: { type: String, required: true, trim: true, maxlength: 300 },
    preview: { type: String, required: true, trim: true, maxlength: 300 },
    content: { type: String, required: true },
    attachments: { type: [AttachmentMetaSchema], default: [] },
    status: { type: String, enum: BROADCAST_STATUSES, default: 'draft' },
    scheduledAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    fromEmail: { type: String },
    lockedUntil: { type: Date, default: null },
    audienceSnapshotAt: { type: Date, default: null },
    recipientCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    transientFailures: { type: Number, default: 0 },
    lastError: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true }
);

// What the scheduler scans: due scheduled broadcasts and resumable "sending" ones.
BroadcastSchema.index({ status: 1, scheduledAt: 1 });
BroadcastSchema.index({ createdAt: -1 });

const Broadcast: Model<BroadcastDocument> = mongoose.models.Broadcast || mongoose.model<BroadcastDocument>('Broadcast', BroadcastSchema);
export default Broadcast;
