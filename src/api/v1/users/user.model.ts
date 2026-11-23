// src/api/v1/users/user.model.ts
import bcrypt from 'bcryptjs';
import { Schema, model, type Types } from 'mongoose';
import { USER_ROLES, type UserRole } from './user.types';

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  companyId?: Types.ObjectId;
  isActive: boolean;

  // soft-delete / suspensão (herdado do Model B)
  deletedAt?: Date | null;
  suspendedAt?: Date | null;
  suspendedReason?: string | null;
  reactivationToken?: string | null;
  reactivationExpires?: Date | null;

  createdAt: Date;
  updatedAt: Date;

  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email inválido'],
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: 'recebedor' },
    companyId: { type: Schema.Types.ObjectId, index: true, ref: 'Company' },
    isActive: { type: Boolean, default: true },

    deletedAt: { type: Date, default: null },
    suspendedAt: { type: Date, default: null },
    suspendedReason: { type: String, default: null },
    reactivationToken: { type: String, default: null, select: false },
    reactivationExpires: { type: Date, default: null, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const {
          password: _password,
          __v,
          reactivationToken: _rt,
          ...rest
        } = ret as Record<string, unknown>;
        return rest;
      },
    },
  },
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.method('comparePassword', function (this: IUser, candidate: string) {
  return bcrypt.compare(candidate, this.password);
});

export const User = model<IUser>('User', userSchema);