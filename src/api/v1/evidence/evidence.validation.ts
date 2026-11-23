import { z } from 'zod';

import { chaveField } from '../invoices/invoice.validation';
import { EVIDENCE_ALVOS, EVIDENCE_TIPOS } from './evidence.model';

/** Campos de texto que acompanham o arquivo no multipart/form-data. */
export const evidenceBodySchema = z
  .object({
    tipo: z.enum(EVIDENCE_TIPOS),
    alvo: z.enum(EVIDENCE_ALVOS).default('nota'),
    numeroItem: z.coerce.number().int().min(1).optional(),
    nome: z.string().trim().min(3).max(100).optional(),
    documento: z.string().trim().min(5).max(20).optional(),
    papel: z.enum(['recebedor', 'motorista']).optional(),
    legenda: z.string().trim().max(200).optional(),
    /** horário do aparelho (informativo; o horário oficial é o do servidor) */
    capturadoEm: z.string().datetime({ offset: true }).optional(),
  })
  .refine((d) => d.alvo !== 'item' || d.numeroItem !== undefined, {
    message: 'alvo "item" exige numeroItem',
    path: ['numeroItem'],
  })
  .refine((d) => d.tipo !== 'assinatura' || (d.nome !== undefined && d.papel !== undefined), {
    message: 'Assinatura exige nome e papel (recebedor ou motorista) de quem assinou',
    path: ['nome'],
  });
export type EvidenceBody = z.infer<typeof evidenceBodySchema>;

export const evidenceFileParamsSchema = z.object({
  chave: chaveField,
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID inválido'),
});
