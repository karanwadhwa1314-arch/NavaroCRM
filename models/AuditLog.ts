import 'server-only';
import mongoose, { Schema, type Model, type Document, type Types } from 'mongoose';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditAction, type AuditEntity } from '@/lib/constants';

export interface AuditLogDocument extends Document {
  user?: Types.ObjectId;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: Types.ObjectId;
  description?: string;
  changes?: { before?: unknown; after?: unknown };
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<AuditLogDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    entity: { type: String, enum: AUDIT_ENTITIES, required: true },
    entityId: { type: Schema.Types.ObjectId },
    description: { type: String },
    changes: {
      before: { type: Schema.Types.Mixed },
      after: { type: Schema.Types.Mixed },
    },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

AuditLogSchema.index({ user: 1, createdAt: -1 });
AuditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, 'metadata.email': 1, createdAt: -1 });

export interface AuditLogEntry {
  user?: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  description?: string;
  changes?: { before?: unknown; after?: unknown };
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

async function log(entry: AuditLogEntry): Promise<void> {
  try {
    await AuditLog.create(entry as unknown as Partial<AuditLogDocument>);
  } catch (err) {
    // Auditing must never break the request it's logging.
    console.error('AuditLog.log failed', err);
  }
}

AuditLogSchema.statics.log = log;

interface AuditLogModel extends Model<AuditLogDocument> {
  log(entry: AuditLogEntry): Promise<void>;
}

const AuditLog = (mongoose.models.AuditLog as AuditLogModel) || mongoose.model<AuditLogDocument, AuditLogModel>('AuditLog', AuditLogSchema);

export default AuditLog;
