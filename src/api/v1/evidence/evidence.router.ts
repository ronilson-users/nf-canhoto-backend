import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';

import { AppError } from '@/shared/utils/error';

import * as evidenceController from './evidence.controller';

// herda :chave e a autenticação do invoice.router
const router = Router({ mergeParams: true });

// imagem em memória, 1 arquivo, até 5 MB (o app deve reduzir a foto antes de enviar)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

const uploadFile = (req: Request, res: Response, next: NextFunction) =>
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    const code = (err as { code?: string }).code;
    next(new AppError(code === 'LIMIT_FILE_SIZE' ? 'Imagem acima de 5 MB' : 'Falha no upload da imagem', 400));
  });

/** @swagger
 * /invoices/{chave}/evidence:
 *   post: { summary: Envia foto ou assinatura (multipart - campo file + tipo, alvo, numeroItem, nome, papel), tags: [Evidence], security: [{ BearerAuth: [] }], responses: { 201: { description: Registrada }, 400: { description: Arquivo ou campos inválidos } } }
 *   get: { summary: Lista evidências da nota, tags: [Evidence], security: [{ BearerAuth: [] }], responses: { 200: { description: OK } } }
 * /invoices/{chave}/evidence/{id}/file:
 *   get: { summary: Baixa a imagem, tags: [Evidence], security: [{ BearerAuth: [] }], responses: { 200: { description: Imagem } } }
 */
router.post('/', uploadFile, evidenceController.upload);
router.get('/', evidenceController.list);
router.get('/:id/file', evidenceController.download);

export default router;
