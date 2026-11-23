import { z } from 'zod';

import { chaveField } from '../invoices/invoice.validation';
import { CATEGORIAS, SUBCATEGORIAS } from './receiving.perishable';

export const itemParamsSchema = z.object({
  chave: chaveField,
  numeroItem: z.coerce.number().int().min(1),
});

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Data inválida');

const condicao = z.enum(['C', 'NC']);

/** Linha do FT-19. Para congelado/resfriado exige temperatura e as 4 condições (validado no conferItemSchema). */
export const pereciveInputSchema = z.object({
  categoria: z.enum(CATEGORIAS),
  subcategoria: z.enum(SUBCATEGORIAS).optional(),
  temperaturaC: z.number().min(-60).max(60).optional(),
  /** "conforme especificação do fornecedor": sobrescreve o limite padrão */
  limiteMaxC: z.number().min(-60).max(60).optional(),
  lote: z.string().trim().max(50).optional(),
  sif: z.string().trim().max(20).optional(),
  fabricacao: dateStr.optional(),
  validade: dateStr.optional(),
  condicoes: z.object({ rotulo: condicao, produto: condicao, transporte: condicao, entregador: condicao }).optional(),
  ressalva: z.string().trim().min(5, 'Ressalva deve ter ao menos 5 caracteres').max(300).optional(),
});

export const conferItemSchema = z
  .object({
    quantidadeRecebida: z.number().min(0).optional(),
    quantidadeAvariada: z.number().min(0).default(0),
    recusado: z.boolean().default(false),
    motivo: z.string().trim().max(200).optional(),
    perecivel: pereciveInputSchema.optional(),
  })
  .refine((d) => d.recusado || d.quantidadeRecebida !== undefined, {
    message: 'Informe quantidadeRecebida (ou marque recusado)',
    path: ['quantidadeRecebida'],
  })
  .refine((d) => d.quantidadeAvariada <= (d.quantidadeRecebida ?? 0) || d.recusado, {
    message: 'quantidadeAvariada não pode ser maior que a recebida',
    path: ['quantidadeAvariada'],
  })
  .refine(
    (d) =>
      !d.perecivel ||
      d.recusado ||
      d.perecivel.categoria === 'seco' ||
      (d.perecivel.temperaturaC !== undefined && d.perecivel.condicoes !== undefined),
    {
      message: 'Perecíveis exigem temperaturaC e as 4 condições (rotulo, produto, transporte, entregador)',
      path: ['perecivel'],
    },
  )
  .refine((d) => !d.perecivel || d.perecivel.categoria !== 'resfriado' || d.perecivel.subcategoria !== undefined, {
    message: 'Resfriado exige subcategoria (carne, pescado ou outros)',
    path: ['perecivel', 'subcategoria'],
  })
  .refine(
    (d) => !d.perecivel?.fabricacao || !d.perecivel?.validade || d.perecivel.validade >= d.perecivel.fabricacao,
    { message: 'Validade anterior à fabricação', path: ['perecivel', 'validade'] },
  );
export type ConferItemInput = z.infer<typeof conferItemSchema>;

export const finishSchema = z.object({
  volumesRecebidos: z.number().int().min(0).max(100000).optional(),
  observacao: z.string().trim().max(500).optional(),
});
export type FinishInput = z.infer<typeof finishSchema>;
