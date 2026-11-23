import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';

import { authMiddleware } from '@/shared/middleware/auth';
import { AppError } from '@/shared/utils/error';

import eventsRouter from '../events/event.router';
import evidenceRouter from '../evidence/evidence.router';
import receivingRouter from '../receiving/receiving.router';
import returnsRouter from '../returns/returns.router';
import * as invoiceController from './invoice.controller';

const router = Router();
router.use(authMiddleware);

// XML em memória, 1 arquivo, até 2 MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

const uploadXml = (req: Request, res: Response, next: NextFunction) =>
  upload.single('xml')(req, res, (err: unknown) => {
    if (!err) return next();
    const code = (err as { code?: string }).code;
    next(new AppError(code === 'LIMIT_FILE_SIZE' ? 'XML acima de 2 MB' : 'Falha no upload do XML', 400));
  });

/** @swagger
 * /invoices/parse-key:
 *   post: { summary: Valida e decodifica a chave de acesso (não grava), tags: [Invoices], security: [{ BearerAuth: [] }], responses: { 200: { description: Dados da chave }, 400: { description: Chave inválida } } }
 * /invoices/xml:
 *   post: { summary: Importa o XML da NF-e (multipart, campo xml), tags: [Invoices], security: [{ BearerAuth: [] }], responses: { 201: { description: Importada }, 200: { description: Atualizada }, 400: { description: XML inválido }, 409: { description: Registrada por outra empresa }, 422: { description: NF-e não autorizada } } }
 * /invoices:
 *   post: { summary: Registra uma NF-e pela chave, tags: [Invoices], security: [{ BearerAuth: [] }], responses: { 201: { description: Registrada }, 409: { description: Já registrada } } }
 *   get: { summary: Lista NF-e visíveis ao usuário, tags: [Invoices], security: [{ BearerAuth: [] }], responses: { 200: { description: OK } } }
 * /invoices/{chave}:
 *   get: { summary: Busca NF-e pela chave, tags: [Invoices], security: [{ BearerAuth: [] }], responses: { 200: { description: OK }, 404: { description: Não encontrada } } }
 */
router.post('/parse-key', invoiceController.parseKey);
router.post('/xml', uploadXml, invoiceController.importXml);
router.post('/', invoiceController.create);
router.get('/', invoiceController.list);
router.use('/:chave/receiving', receivingRouter);
router.use('/:chave/events', eventsRouter);
router.use('/:chave/evidence', evidenceRouter);
router.use('/:chave/return', returnsRouter);
router.get('/:chave', invoiceController.getByChave);

export default router;
