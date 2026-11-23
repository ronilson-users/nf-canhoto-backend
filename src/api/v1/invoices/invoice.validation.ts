import { z } from 'zod';

import { isValidCnpj, normalizeCnpj, normalizeNfeKey } from '@/shared/utils/nfe-key';

import { INVOICE_STATUSES } from './invoice.model';

/** Normaliza (espaços, "NFe") e exige 44 posições; letras só nas 12 primeiras do CNPJ. */
export const chaveField = z
  .string()
  .transform(normalizeNfeKey)
  .pipe(z.string().regex(/^[0-9]{6}[A-Z0-9]{12}[0-9]{26}$/, 'Chave de acesso inválida (44 caracteres)'));

const cnpjField = z
  .string()
  .transform(normalizeCnpj)
  .refine(isValidCnpj, 'CNPJ inválido');

const placaField = z
  .string()
  .transform((s) => s.toUpperCase().replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/, 'Placa inválida'));

export const parseKeySchema = z.object({ chave: chaveField });

export const createInvoiceSchema = z.object({
  chave: chaveField,
  destinatarioCnpj: cnpjField.optional(),
  pedido: z.string().trim().max(50).optional(),
  roteiro: z.string().trim().max(50).optional(),
  motorista: z.string().trim().max(100).optional(),
  placa: placaField.optional(),
  volumes: z.number().int().min(0).max(100000).optional(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const chaveParamSchema = z.object({ chave: chaveField });

export const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(INVOICE_STATUSES).optional(),
});
