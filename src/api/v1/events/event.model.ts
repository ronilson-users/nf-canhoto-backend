import { Schema, model, type Types } from 'mongoose';

export interface IInvoiceEvent {
  _id: Types.ObjectId;
  chave: string;
  /** Posição na cadeia da nota (1, 2, 3...). Único por chave: impede ramificação. */
  seq: number;
  type: string;
  actorId: Types.ObjectId;
  actorRole: string;
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
  createdAt: Date;
}

const eventSchema = new Schema<IInvoiceEvent>(
  {
    chave: { type: String, required: true },
    seq: { type: Number, required: true },
    type: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, required: true },
    actorRole: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    prevHash: { type: String, required: true },
    hash: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { timestamps: false, minimize: false }, // minimize:false mantém payload {} (o hash depende dele)
);

eventSchema.index({ chave: 1, seq: 1 }, { unique: true });

export const InvoiceEvent = model<IInvoiceEvent>('InvoiceEvent', eventSchema);
