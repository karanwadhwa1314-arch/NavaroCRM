import 'server-only';
import mongoose, { Schema, type Model, type Document, type Types } from 'mongoose';
import {
  CLIENT_STATUSES,
  CLIENT_TIERS,
  CLIENT_SOURCES,
  COMPANY_SIZES,
  CURRENCIES,
  type ClientStatus,
  type ClientTier,
  type ClientSource,
  type CompanySize,
} from '@/lib/constants';

export interface ClientAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

export interface ClientBillingAddress extends ClientAddress {
  sameAsAddress: boolean;
}

export interface ClientContact {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  isPrimary: boolean;
  department?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientDocument extends Document {
  companyName: string;
  displayName?: string;
  industry?: string;
  companySize?: CompanySize;
  website?: string;
  address?: ClientAddress;
  billingAddress?: ClientBillingAddress;
  contacts: Types.DocumentArray<ClientContact>;
  accountManager?: Types.ObjectId;
  status: ClientStatus;
  tier: ClientTier;
  paymentTerms: number;
  taxId?: string;
  currency: string;
  source: ClientSource;
  convertedFromLead?: Types.ObjectId;
  notes?: string;
  tags: string[];
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  primaryContact?: ClientContact;
}

const AddressSchema = new Schema<ClientAddress>(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    zipCode: { type: String, trim: true },
  },
  { _id: false }
);

const BillingAddressSchema = new Schema<ClientBillingAddress>(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    sameAsAddress: { type: Boolean, default: true },
  },
  { _id: false }
);

const ContactSchema = new Schema<ClientContact>(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    isPrimary: { type: Boolean, default: false },
    department: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

const ClientSchema = new Schema<ClientDocument>(
  {
    companyName: { type: String, required: true, trim: true, maxlength: 120 },
    displayName: { type: String, trim: true },
    industry: { type: String, trim: true },
    companySize: { type: String, enum: COMPANY_SIZES },
    website: { type: String, trim: true },
    address: AddressSchema,
    billingAddress: BillingAddressSchema,
    contacts: [ContactSchema],
    accountManager: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: CLIENT_STATUSES, default: 'active' },
    tier: { type: String, enum: CLIENT_TIERS, default: 'standard' },
    paymentTerms: { type: Number, default: 30, min: 0 },
    taxId: { type: String, trim: true },
    currency: { type: String, enum: CURRENCIES, default: 'USD' },
    source: { type: String, enum: CLIENT_SOURCES, default: 'direct' },
    convertedFromLead: { type: Schema.Types.ObjectId, ref: 'Lead' },
    notes: { type: String, maxlength: 5000 },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ClientSchema.virtual('primaryContact').get(function (this: ClientDocument) {
  if (!this.contacts || this.contacts.length === 0) return undefined;
  return this.contacts.find((c) => c.isPrimary) ?? this.contacts[0];
});

ClientSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).__v;
    return ret;
  },
});

ClientSchema.index(
  { companyName: 1 },
  { unique: true, partialFilterExpression: { isActive: true }, collation: { locale: 'en', strength: 2 } }
);
ClientSchema.index({ convertedFromLead: 1 }, { unique: true, sparse: true });
ClientSchema.index({ isActive: 1, status: 1, createdAt: -1 });
ClientSchema.index({ accountManager: 1, isActive: 1 });
ClientSchema.index({ 'contacts.email': 1 });

const Client: Model<ClientDocument> = mongoose.models.Client || mongoose.model<ClientDocument>('Client', ClientSchema);

export default Client;
