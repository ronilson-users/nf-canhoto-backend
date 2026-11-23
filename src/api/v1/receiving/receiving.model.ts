import { Schema, model, type Types } from 'mongoose';

import type { InvoiceStatus } from '../invoices/invoice.model';
import type { DivergenciaTipo } from './receiving.calc';
import {
  CATEGORIAS,
  SUBCATEGORIAS,
  type Categoria,
  type Condicao,
  type Subcategoria,
} from './receiving.perishable';

export const RECEIVING_STATUSES = ['em_conferencia', 'finalizada'] as const;
export type ReceivingStatus = (typeof RECEIVING_STATUSES)[number];
const TIPOS: DivergenciaTipo[] = ['ok', 'falta', 'sobra', 'avaria', 'recusa'];

/** Uma linha do FT-19 (controle de recebimento de perecíveis). */
export interface IPerecivel {
  categoria: Categoria;
  subcategoria?: Subcategoria;
  temperaturaC?: number;
  limiteC?: number;
  lote?: string;
  sif?: string;
  fabricacao?: string;
  validade?: string;
  condicoes?: { rotulo: Condicao; produto: Condicao; transporte: Condicao; entregador: Condicao };
  conformidade: 'conforme' | 'nao_conforme';
  motivosNaoConformidade: string[];
  /** justificativa do responsável técnico para aceitar um item não conforme */
  ressalva?: string;
}

export interface IReceivingItem {
  numeroItem: number;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidadeEsperada: number;
  valorUnitario: number;
  /** aprendido de conferências anteriores (por empresa + fornecedor + código) */
  categoriaSugerida?: Categoria;
  subcategoriaSugerida?: Subcategoria;
  conferido: boolean;
  quantidadeRecebida?: number;
  quantidadeAvariada?: number;
  recusado?: boolean;
  motivo?: string;
  tipo?: DivergenciaTipo;
  quantidadeAceita?: number;
  /** o que volta com o motorista: item recusado (tudo) ou unidades avariadas */
  quantidadeDevolver?: number;
  diferenca?: number;
  dentroDaTolerancia?: boolean;
  valorAbaterCentavos?: number;
  valorSobraCentavos?: number;
  perecivel?: IPerecivel;
  conferidoPor?: Types.ObjectId;
  conferidoEm?: Date;
}

export interface IReceiving {
  _id: Types.ObjectId;
  chave: string;
  invoiceId: Types.ObjectId;
  companyId?: Types.ObjectId;
  status: ReceivingStatus;
  startedBy: Types.ObjectId;
  startedAt: Date;
  finishedBy?: Types.ObjectId;
  finishedAt?: Date;
  volumesEsperados?: number;
  volumesRecebidos?: number;
  volumesDivergentes?: boolean;
  observacao?: string;
  itens: IReceivingItem[];
  resumo?: {
    valorNotaCentavos: number;
    valorAbaterCentavos: number;
    valorSobraCentavos: number;
    valorLiquidoCentavos: number;
    itensComDivergencia: number;
  };
  resultado?: Extract<InvoiceStatus, 'conferida' | 'com_divergencia' | 'recebida_parcial' | 'recusada'>;
  devolucaoId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const condicaoField = { type: String, enum: ['C', 'NC'] };
const condicoesSchema = new Schema(
  { rotulo: condicaoField, produto: condicaoField, transporte: condicaoField, entregador: condicaoField },
  { _id: false },
);

const pereciveSchema = new Schema<IPerecivel>(
  {
    categoria: { type: String, enum: CATEGORIAS, required: true },
    subcategoria: { type: String, enum: SUBCATEGORIAS },
    temperaturaC: Number,
    limiteC: Number,
    lote: String,
    sif: String,
    fabricacao: String,
    validade: String,
    condicoes: { type: condicoesSchema, default: undefined },
    conformidade: { type: String, enum: ['conforme', 'nao_conforme'], required: true },
    motivosNaoConformidade: { type: [String], default: [] },
    ressalva: String,
  },
  { _id: false },
);

const itemSchema = new Schema<IReceivingItem>(
  {
    numeroItem: { type: Number, required: true },
    codigo: { type: String, required: true },
    descricao: { type: String, required: true },
    unidade: { type: String, required: true },
    quantidadeEsperada: { type: Number, required: true },
    valorUnitario: { type: Number, required: true },
    categoriaSugerida: { type: String, enum: CATEGORIAS },
    subcategoriaSugerida: { type: String, enum: SUBCATEGORIAS },
    conferido: { type: Boolean, default: false },
    quantidadeRecebida: Number,
    quantidadeAvariada: Number,
    recusado: Boolean,
    motivo: String,
    tipo: { type: String, enum: TIPOS },
    quantidadeAceita: Number,
    quantidadeDevolver: Number,
    diferenca: Number,
    dentroDaTolerancia: Boolean,
    valorAbaterCentavos: Number,
    valorSobraCentavos: Number,
    perecivel: { type: pereciveSchema, default: undefined },
    conferidoPor: Schema.Types.ObjectId,
    conferidoEm: Date,
  },
  { _id: false },
);

const receivingSchema = new Schema<IReceiving>(
  {
    chave: { type: String, required: true, unique: true },
    invoiceId: { type: Schema.Types.ObjectId, required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, index: true },
    status: { type: String, enum: RECEIVING_STATUSES, default: 'em_conferencia' },
    startedBy: { type: Schema.Types.ObjectId, required: true },
    startedAt: { type: Date, required: true },
    finishedBy: Schema.Types.ObjectId,
    finishedAt: Date,
    volumesEsperados: Number,
    volumesRecebidos: Number,
    volumesDivergentes: Boolean,
    observacao: String,
    itens: { type: [itemSchema], default: [] },
    resumo: {
      type: new Schema(
        {
          valorNotaCentavos: Number,
          valorAbaterCentavos: Number,
          valorSobraCentavos: Number,
          valorLiquidoCentavos: Number,
          itensComDivergencia: Number,
        },
        { _id: false },
      ),
      default: undefined,
    },
    resultado: { type: String, enum: ['conferida', 'com_divergencia', 'recebida_parcial', 'recusada'] },
    devolucaoId: Schema.Types.ObjectId,
  },
  { timestamps: true },
);

export const Receiving = model<IReceiving>('Receiving', receivingSchema);
