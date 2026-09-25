import 'server-only';
import mongoose, { Schema, type Model, type Document, type Types } from 'mongoose';
import {
  LEAD_STAGES,
  LEAD_SOURCES,
  PRIORITIES,
  TIMELINES,
  COMPANY_SIZES,
  ACTIVITY_TYPES,
  CURRENCIES,
  type LeadStage,
  type LeadSource,
  type Priority,
  type Timeline,
  type CompanySize,
  type ActivityType,
} from '@/lib/constants';

export interface LeadStageHistoryEntry {
  stage: LeadStage;
  changedAt: Date;
  changedBy?: Types.ObjectId;
}

export interface LeadActivity {
  _id: Types.ObjectId;
  type: ActivityType;
  description: string;
  user?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface LeadDocument extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  company: string;
  companySize?: CompanySize;
  industry?: string;
  website?: string;
  source: LeadSource;
  sourceDetails?: string;
  stage: LeadStage;
  stageHistory: Types.DocumentArray<LeadStageHistoryEntry>;
  estimatedBudget?: { min?: number; max?: number; currency: string };
  expectedTimeline?: Timeline;
  assignedTo?: Types.ObjectId;
  requirements?: string;
  notes?: string;
  tags: string[];
  priority: Priority;
  isActive: boolean;
  lostReason?: string;
  wonDate?: Date;
  activities: Types.DocumentArray<LeadActivity>;
  convertedToClient?: Types.ObjectId;
  convertedAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  fullName: string;
}

const StageHistorySchema = new Schema<LeadStageHistoryEntry>(
  {
    stage: { type: String, enum: LEAD_STAGES, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const ActivitySchema = new Schema<LeadActivity>(
  {
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    description: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const LeadSchema = new Schema<LeadDocument>(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    company: { type: String, required: true, trim: true, maxlength: 120 },
    companySize: { type: String, enum: COMPANY_SIZES },
    industry: { type: String, trim: true },
    website: { type: String, trim: true },
    source: { type: String, enum: LEAD_SOURCES, default: 'website' },
    sourceDetails: { type: String, trim: true },
    stage: { type: String, enum: LEAD_STAGES, default: 'new' },
    stageHistory: [StageHistorySchema],
    estimatedBudget: {
      min: { type: Number, min: 0 },
      max: { type: Number, min: 0 },
      currency: { type: String, enum: CURRENCIES, default: 'USD' },
    },
    expectedTimeline: { type: String, enum: TIMELINES },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    requirements: { type: String, maxlength: 5000 },
    notes: { type: String, maxlength: 5000 },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    isActive: { type: Boolean, default: true },
    lostReason: { type: String, trim: true },
    wonDate: { type: Date },
    activities: [ActivitySchema],
    convertedToClient: { type: Schema.Types.ObjectId, ref: 'Client' },
    convertedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

LeadSchema.virtual('fullName').get(function (this: LeadDocument) {
  return `${this.firstName} ${this.lastName}`.trim();
});

LeadSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).__v;
    return ret;
  },
});

LeadSchema.index({ isActive: 1, stage: 1, createdAt: -1 });
LeadSchema.index({ assignedTo: 1, isActive: 1 });
LeadSchema.index({ email: 1 });
LeadSchema.index({ convertedToClient: 1 }, { sparse: true });

const Lead: Model<LeadDocument> = mongoose.models.Lead || mongoose.model<LeadDocument>('Lead', LeadSchema);

export default Lead;
