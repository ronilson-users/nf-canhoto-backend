import { Schema, model, type Types } from 'mongoose';

export const DEVOLUCAO_STATUSES = ['pendente_coleta', 'coletada'] as const;
export type DevolucaoStatus = (typeof DEVOLUCAO_STATUSES)[number];

export interface IDevolucaoItem {
  numeroItem: number;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorCentavos: number;
  tipo: 'recusa' | 'avaria';
  motivo?: string;
}

export interface IDevolucao {
  _id: Types.ObjectId;
  chave: string;
  invoiceId: Types.ObjectId;
  companyId?: Types.ObjectId;
  status: DevolucaoStatus;
  itens: IDevolucaoItem[];
  totalCentavos: number;
  criadaPor: Types.ObjectId;
  criadaEm: Date;
  coletadaEm?: Date;
  coletadoPor?: { nome: string; documento?: string; placa?: string };
  /** evidência (assinatura) do motorista confirmando que leva a mercadoria de volta */
  assinaturaId?: Types.ObjectId;
  /** NF de devolução (emitida pelo comprador ou pelo fornecedor, conforme o caso fiscal) */
  nfDevolucaoChave?: string;
  nfRegistradaEm?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<IDevolucaoItem>(
  {
    numeroItem: { type: Number, required: true },
    codigo: { type: String, required: true },
    descricao: { type: String, required: true },
    unidade: { type: String, required: true },
    quantidade: { type: Number, required: true },
    valorUnitario: { type: Number, required: true },
    valorCentavos: { type: Number, required: true },
    tipo: { type: String, enum: ['recusa', 'avaria'], required: true },
    motivo: String,
  },
  { _id: false },
);

const devolucaoSchema = new Schema<IDevolucao>(
  {
    chave: { type: String, required: true, unique: true },
    invoiceId: { type: Schema.Types.ObjectId, required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, index: true },
    status: { type: String, enum: DEVOLUCAO_STATUSES, default: 'pendente_coleta' },
    itens: { type: [itemSchema], default: [] },
    totalCentavos: { type: Number, required: true },
    criadaPor: { type: Schema.Types.ObjectId, required: true },
    criadaEm: { type: Date, required: true },
    coletadaEm: Date,
    coletadoPor: {
      type: new Schema({ nome: { type: String, required: true }, documento: String, placa: String }, { _id: false }),
      default: undefined,
    },
    assinaturaId: Schema.Types.ObjectId,
    nfDevolucaoChave: String,
    nfRegistradaEm: Date,
  },
  { timestamps: true },
);

export const Devolucao = model<IDevolucao>('Devolucao', devolucaoSchema);
