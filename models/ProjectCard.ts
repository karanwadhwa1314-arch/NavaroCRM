import mongoose, { Schema, type Model, type Document, type Types } from 'mongoose';
import { CARD_RECURRENCE_TYPES, CARD_STATUSES, type CardRecurrenceType, type CardStatus } from '@/lib/constants';

export interface ProjectCardDocument extends Document {
  title: string;
  description?: string;
  fileLink?: string;
  project: Types.ObjectId;
  status: CardStatus;
  deadline?: Date | null;
  /** Stamped on the first move into Done; drives the 10-day clean-up. */
  doneAt?: Date | null;
  assignees: Types.ObjectId[];
  createdBy: Types.ObjectId;
  recurrence: {
    type: CardRecurrenceType;
    daysOfWeek: number[];
    dayOfMonth?: number | null;
  };
  /** Shared by every occurrence of a recurring card. Not a reference. */
  recurrenceSeriesId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectCardSchema = new Schema<ProjectCardDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 500 },
    fileLink: { type: String, trim: true, default: '', maxlength: 2000 },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    status: { type: String, enum: CARD_STATUSES, default: 'todo' },
    deadline: { type: Date, default: null },
    doneAt: { type: Date, default: null },
    assignees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recurrence: {
      type: { type: String, enum: CARD_RECURRENCE_TYPES, default: 'none' },
      daysOfWeek: [{ type: Number, min: 0, max: 6 }],
      dayOfMonth: { type: Number, min: 1, max: 31 },
    },
    recurrenceSeriesId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);

ProjectCardSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).__v;
    return ret;
  },
});

ProjectCardSchema.index({ project: 1, status: 1 });
ProjectCardSchema.index({ assignees: 1 });
ProjectCardSchema.index({ recurrenceSeriesId: 1 });
ProjectCardSchema.index({ status: 1, doneAt: 1 });

const ProjectCard: Model<ProjectCardDocument> =
  mongoose.models.ProjectCard || mongoose.model<ProjectCardDocument>('ProjectCard', ProjectCardSchema);

export default ProjectCard;
