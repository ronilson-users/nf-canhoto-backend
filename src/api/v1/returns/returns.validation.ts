import { z } from 'zod';

import { chaveField } from '../invoices/invoice.validation';

const placa = z
  .string()
  .transform((s) => s.toUpperCase().replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/, 'Placa inválida'));

export const collectSchema = z.object({
  motoristaNome: z.string().trim().min(3).max(100),
  motoristaDocumento: z.string().trim().min(5).max(20).optional(),
  placa: placa.optional(),
  /** id da evidência do tipo "assinatura" (alvo "devolucao", papel "motorista") */
  assinaturaId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'assinaturaId inválido'),
});
export type CollectInput = z.infer<typeof collectSchema>;

export const nfDevolucaoSchema = z.object({ chaveNfDevolucao: chaveField });
export type NfDevolucaoInput = z.infer<typeof nfDevolucaoSchema>;
