import 'server-only';
import mongoose, { Schema, type Model, type Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { USER_ROLES, type UserRole } from '@/lib/constants';
import { PERMISSIONS, type Permission } from '@/lib/permissions';

const SALT_ROUNDS = 10;

export interface UserDocument extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
  permissions: Permission[];
  phone?: string;
  department?: string;
  isActive: boolean;
  lastLogin?: Date;
  tokenVersion: number;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  fullName: string;
}

const UserSchema = new Schema<UserDocument>(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: USER_ROLES, default: 'member' },
    permissions: [{ type: String, enum: PERMISSIONS }],
    phone: { type: String, trim: true },
    department: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    tokenVersion: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

UserSchema.pre<UserDocument>('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

UserSchema.virtual('fullName').get(function (this: UserDocument) {
  return `${this.firstName} ${this.lastName}`.trim();
});

UserSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    delete r.password;
    delete r.__v;
    return ret;
  },
});

UserSchema.index({ role: 1, isActive: 1 });

const User: Model<UserDocument> = mongoose.models.User || mongoose.model<UserDocument>('User', UserSchema);

export default User;
