import mongoose, { Schema, type Model, type Document, type Types } from 'mongoose';

/** The bytes of one attached file. Metadata (name/size/type) is mirrored on Broadcast.attachments so lists never load file data. */
export interface BroadcastAttachmentDocument extends Document {
  broadcast: Types.ObjectId;
  filename: string;
  contentType: string;
  size: number;
  data: Buffer;
  createdAt: Date;
}

const BroadcastAttachmentSchema = new Schema<BroadcastAttachmentDocument>(
  {
    broadcast: { type: Schema.Types.ObjectId, ref: 'Broadcast', required: true, index: true },
    filename: { type: String, required: true, maxlength: 100 },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const BroadcastAttachment: Model<BroadcastAttachmentDocument> =
  mongoose.models.BroadcastAttachment || mongoose.model<BroadcastAttachmentDocument>('BroadcastAttachment', BroadcastAttachmentSchema);
export default BroadcastAttachment;
