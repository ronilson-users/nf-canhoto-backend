import { Schema, model, type Types } from 'mongoose';

export const INVOICE_STATUSES = [
  'registrada', 'em_rota', 'na_doca', 'conferida', 'com_divergencia', 'recebida_parcial', 'recusada', 'concluida',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Valores em reais, como na NF. Cálculos de divergência: arredondar em centavos. */
export interface IInvoiceItem {
  numeroItem?: number;
  codigo: string;
  descricao: string;
  ncm?: string;
  cfop?: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface IDuplicata {
  numero: string;
  vencimento?: string;
  valor: number;
}

export interface IInvoice {
  _id: Types.ObjectId;
  chave: string;
  uf: string;
  ano: number;
  mes: number;
  emitenteCnpj: string;
  emitenteNome?: string;
  modelo: string;
  serie: number;
  numero: number;
  destinatarioCnpj?: string;
  destinatarioNome?: string;
  pedido?: string;
  roteiro?: string;
  motorista?: string;
  placa?: string;
  volumes?: number;
  pesoLiquido?: number;
  pesoBruto?: number;
  modalidadeFrete?: number;
  valorTotal?: number;
  itens: IInvoiceItem[];
  duplicatas: IDuplicata[];
  emitidaEm?: Date;
  saidaEm?: Date;
  autorizada?: boolean;
  protocolo?: { numero: string; recebidoEm?: Date; status: number; motivo?: string };
  /** XML original (select:false) e seu SHA-256 — guarda para auditoria e reprocessamento. */
  xml?: string;
  xmlHash?: string;
  xmlImportadoEm?: Date;
  status: InvoiceStatus;
  companyId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<IInvoiceItem>(
  {
    numeroItem: Number,
    codigo: { type: String, required: true },
    descricao: { type: String, required: true },
    ncm: String,
    cfop: String,
    unidade: { type: String, required: true },
    quantidade: { type: Number, required: true },
    valorUnitario: { type: Number, required: true },
    valorTotal: { type: Number, required: true },
  },
  { _id: false },
);

const duplicataSchema = new Schema<IDuplicata>(
  { numero: { type: String, required: true }, vencimento: String, valor: { type: Number, required: true } },
  { _id: false },
);

const invoiceSchema = new Schema<IInvoice>(
  {
    chave: { type: String, required: true, unique: true },
    uf: { type: String, required: true },
    ano: { type: Number, required: true },
    mes: { type: Number, required: true },
    emitenteCnpj: { type: String, required: true, index: true },
    emitenteNome: String,
    modelo: { type: String, required: true },
    serie: { type: Number, required: true },
    numero: { type: Number, required: true },
    destinatarioCnpj: { type: String, index: true },
    destinatarioNome: String,
    pedido: String,
    roteiro: String,
    motorista: String,
    placa: String,
    volumes: Number,
    pesoLiquido: Number,
    pesoBruto: Number,
    modalidadeFrete: Number,
    valorTotal: Number,
    itens: { type: [itemSchema], default: [] },
    duplicatas: { type: [duplicataSchema], default: [] },
    emitidaEm: Date,
    saidaEm: Date,
    autorizada: Boolean,
    protocolo: {
      type: new Schema({ numero: String, recebidoEm: Date, status: Number, motivo: String }, { _id: false }),
      default: undefined,
    },
    xml: { type: String, select: false },
    xmlHash: String,
    xmlImportadoEm: Date,
    status: { type: String, enum: INVOICE_STATUSES, default: 'registrada', index: true },
    companyId: { type: Schema.Types.ObjectId, index: true },
    createdBy: { type: Schema.Types.ObjectId, required: true, index: true },
  },
  { timestamps: true },
);

export const Invoice = model<IInvoice>('Invoice', invoiceSchema);
