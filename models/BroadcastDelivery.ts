import mongoose, { Schema, type Model, type Document, type Types } from 'mongoose';

export const DELIVERY_STATUSES = ['pending', 'sent', 'failed'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** One row per recipient per broadcast: the audience snapshot and the per-recipient audit trail. */
export interface BroadcastDeliveryDocument extends Document {
  broadcast: Types.ObjectId;
  lead?: Types.ObjectId;
  email: string;
  firstName?: string;
  status: DeliveryStatus;
  error?: string | null;
  providerId?: string | null;
  attemptedAt?: Date | null;
}

const BroadcastDeliverySchema = new Schema<BroadcastDeliveryDocument>(
  {
    broadcast: { type: Schema.Types.ObjectId, ref: 'Broadcast', required: true },
    lead: { type: Schema.Types.ObjectId, ref: 'Lead' },
    email: { type: String, required: true, lowercase: true, trim: true },
    firstName: { type: String, trim: true },
    status: { type: String, enum: DELIVERY_STATUSES, default: 'pending' },
    error: { type: String, default: null, maxlength: 500 },
    providerId: { type: String, default: null },
    attemptedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One delivery per address per broadcast: this is the duplicate-send guard.
BroadcastDeliverySchema.index({ broadcast: 1, email: 1 }, { unique: true });
BroadcastDeliverySchema.index({ broadcast: 1, status: 1, _id: 1 });

const BroadcastDelivery: Model<BroadcastDeliveryDocument> =
  mongoose.models.BroadcastDelivery || mongoose.model<BroadcastDeliveryDocument>('BroadcastDelivery', BroadcastDeliverySchema);
export default BroadcastDelivery;
