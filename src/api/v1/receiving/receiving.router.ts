import { Router } from 'express';

import { requireRole } from '@/shared/middleware/auth';

import * as receivingController from './receiving.controller';

// herda :chave do invoice.router (e a autenticação aplicada lá)
const router = Router({ mergeParams: true });

const conferir = requireRole(['recebedor', 'admin']);

/** @swagger
 * /invoices/{chave}/receiving:
 *   post: { summary: Inicia a conferência (exige XML importado), tags: [Receiving], security: [{ BearerAuth: [] }], responses: { 201: { description: Iniciada }, 409: { description: Já iniciada }, 422: { description: Sem itens } } }
 *   get: { summary: Estado atual da conferência, tags: [Receiving], security: [{ BearerAuth: [] }], responses: { 200: { description: OK }, 404: { description: Não iniciada } } }
 *   delete: { summary: Reinicia a conferência (admin; ?force=true apaga devolução coletada, só em testes), tags: [Receiving], security: [{ BearerAuth: [] }], responses: { 200: { description: OK } } }
 * /invoices/{chave}/receiving/items/{numeroItem}:
 *   put: { summary: Registra a conferência de um item, tags: [Receiving], security: [{ BearerAuth: [] }], responses: { 200: { description: OK }, 409: { description: Já finalizada } } }
 * /invoices/{chave}/receiving/finish:
 *   post: { summary: Finaliza e calcula divergências e valor a abater, tags: [Receiving], security: [{ BearerAuth: [] }], responses: { 200: { description: OK }, 422: { description: Itens pendentes } } }
 */
router.post('/', conferir, receivingController.start);
router.get('/', receivingController.get);
router.put('/items/:numeroItem', conferir, receivingController.conferItem);
router.post('/finish', conferir, receivingController.finish);
router.delete('/', requireRole(['admin']), receivingController.reset);

export default router;
