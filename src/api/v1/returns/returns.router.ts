import { Router } from 'express';

import { requireRole } from '@/shared/middleware/auth';

import * as returnsController from './returns.controller';

// herda :chave e a autenticação do invoice.router
const router = Router({ mergeParams: true });
const conferir = requireRole(['recebedor', 'admin']);

/** @swagger
 * /invoices/{chave}/return:
 *   get: { summary: Devolução gerada na conferência (itens recusados/avariados), tags: [Returns], security: [{ BearerAuth: [] }], responses: { 200: { description: OK }, 404: { description: Sem devolução } } }
 * /invoices/{chave}/return/collect:
 *   post: { summary: Registra a coleta pelo motorista (exige assinatura dele), tags: [Returns], security: [{ BearerAuth: [] }], responses: { 200: { description: Coletada }, 409: { description: Já coletada }, 422: { description: Assinatura inválida } } }
 * /invoices/{chave}/return/nf:
 *   post: { summary: Registra a chave da NF de devolução, tags: [Returns], security: [{ BearerAuth: [] }], responses: { 200: { description: OK }, 400: { description: Chave inválida }, 422: { description: Emitente incompatível } } }
 */
router.get('/', returnsController.get);
router.post('/collect', conferir, returnsController.collect);
router.post('/nf', conferir, returnsController.registerNf);

export default router;
