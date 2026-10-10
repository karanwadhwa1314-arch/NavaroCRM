import mongoose, { Schema, type Model, type Document, type Types } from 'mongoose';
import {
  PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_TEAM_ROLES,
  type Priority,
  type ProjectStatus,
  type ProjectTeamRole,
} from '@/lib/constants';

export const PROJECT_ACTIVITY_TYPES = ['created', 'status_change', 'team_change', 'updated'] as const;
export type ProjectActivityType = (typeof PROJECT_ACTIVITY_TYPES)[number];

export interface ProjectTeamMember {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  role: ProjectTeamRole;
  addedAt: Date;
}

export interface ProjectActivity {
  _id: Types.ObjectId;
  type: ProjectActivityType;
  description: string;
  user?: Types.ObjectId;
  createdAt: Date;
}

export interface ProjectDocument extends Document {
  name: string;
  code: string;
  description?: string;
  client: Types.ObjectId;
  status: ProjectStatus;
  priority: Priority;
  startDate: Date;
  /** Set when the project is ended (status completed), cleared when it is restarted. */
  actualEndDate?: Date;
  projectManager?: Types.ObjectId;
  team: Types.DocumentArray<ProjectTeamMember>;
  activities: Types.DocumentArray<ProjectActivity>;
  tags: string[];
  notes?: string;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TeamMemberSchema = new Schema<ProjectTeamMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: PROJECT_TEAM_ROLES, required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ActivitySchema = new Schema<ProjectActivity>(
  {
    type: { type: String, enum: PROJECT_ACTIVITY_TYPES, required: true },
    description: { type: String, required: true, maxlength: 500 },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const ProjectSchema = new Schema<ProjectDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 250 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    description: { type: String, trim: true, maxlength: 5000 },
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    status: { type: String, enum: PROJECT_STATUSES, default: 'planning' },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    startDate: { type: Date, required: true },
    actualEndDate: { type: Date },
    projectManager: { type: Schema.Types.ObjectId, ref: 'User' },
    team: [TeamMemberSchema],
    activities: [ActivitySchema],
    tags: [{ type: String, trim: true, maxlength: 40 }],
    notes: { type: String, trim: true, maxlength: 5000 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ProjectSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).__v;
    return ret;
  },
});

// Codes are never reused (even by archived projects); names only need to be unique among active ones.
ProjectSchema.index({ code: 1 }, { unique: true });
ProjectSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { isActive: true }, collation: { locale: 'en', strength: 2 } }
);
ProjectSchema.index({ isActive: 1, status: 1, createdAt: -1 });
ProjectSchema.index({ client: 1, isActive: 1 });
ProjectSchema.index({ projectManager: 1, isActive: 1 });
ProjectSchema.index({ 'team.user': 1, isActive: 1 });

const Project: Model<ProjectDocument> = mongoose.models.Project || mongoose.model<ProjectDocument>('Project', ProjectSchema);

export default Project;
