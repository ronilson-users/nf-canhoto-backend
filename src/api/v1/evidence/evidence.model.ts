import { Schema, model, type Types } from 'mongoose';

export const EVIDENCE_TIPOS = ['foto', 'assinatura'] as const;
export const EVIDENCE_ALVOS = ['nota', 'item', 'devolucao'] as const;
export type EvidenceTipo = (typeof EVIDENCE_TIPOS)[number];
export type EvidenceAlvo = (typeof EVIDENCE_ALVOS)[number];

export interface IEvidence {
  _id: Types.ObjectId;
  chave: string;
  invoiceId: Types.ObjectId;
  tipo: EvidenceTipo;
  alvo: { tipo: EvidenceAlvo; numeroItem?: number; devolucaoId?: Types.ObjectId };
  arquivo: { mimeType: string; tamanhoBytes: number; sha256: string; storageKey: string };
  /** dados pessoais ficam aqui (apagáveis), nunca na trilha de eventos imutável */
  signatario?: { nome: string; documento?: string; papel: 'recebedor' | 'motorista' };
  legenda?: string;
  capturadoEm?: Date;
  registradaPor: Types.ObjectId;
  registradaEm: Date;
}

const evidenceSchema = new Schema<IEvidence>({
  chave: { type: String, required: true, index: true },
  invoiceId: { type: Schema.Types.ObjectId, required: true },
  tipo: { type: String, enum: EVIDENCE_TIPOS, required: true },
  alvo: {
    type: new Schema(
      {
        tipo: { type: String, enum: EVIDENCE_ALVOS, required: true },
        numeroItem: Number,
        devolucaoId: Schema.Types.ObjectId,
      },
      { _id: false },
    ),
    required: true,
  },
  arquivo: {
    type: new Schema(
      {
        mimeType: { type: String, required: true },
        tamanhoBytes: { type: Number, required: true },
        sha256: { type: String, required: true },
        storageKey: { type: String, required: true },
      },
      { _id: false },
    ),
    required: true,
  },
  signatario: {
    type: new Schema(
      {
        nome: { type: String, required: true },
        documento: String,
        papel: { type: String, enum: ['recebedor', 'motorista'], required: true },
      },
      { _id: false },
    ),
    default: undefined,
  },
  legenda: String,
  capturadoEm: Date,
  registradaPor: { type: Schema.Types.ObjectId, required: true },
  registradaEm: { type: Date, required: true },
});

export const Evidence = model<IEvidence>('Evidence', evidenceSchema);
