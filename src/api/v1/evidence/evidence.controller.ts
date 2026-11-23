import type { Request, Response } from 'express';

import { AppError } from '@/shared/utils/error';

import { chaveParamSchema } from '../invoices/invoice.validation';
import { EvidenceService } from './evidence.service';
import { evidenceBodySchema, evidenceFileParamsSchema } from './evidence.validation';

const service = new EvidenceService();

const authUser = (req: Request) => {
  if (!req.user) throw new AppError('Usuário não autenticado', 401);
  return req.user;
};

const send = (res: Response, status: number, data: unknown, message?: string) =>
  res.status(status).json({
    success: true,
    ...(message ? { message } : {}),
    data,
    timestamp: new Date().toISOString(),
  });

export const upload = async (req: Request, res: Response) => {
  // preenchido pelo multer (upload.single('file'))
  const file = (req as unknown as { file?: { buffer: Buffer } }).file;
  if (!file) throw new AppError('Envie a imagem no campo "file" (multipart/form-data)', 400);

  const { chave } = chaveParamSchema.parse(req.params);
  const meta = evidenceBodySchema.parse({ ...(req.body ?? {}) });
  send(res, 201, await service.register(chave, file, meta, authUser(req)), 'Evidência registrada');
};

export const list = async (req: Request, res: Response) => {
  const { chave } = chaveParamSchema.parse(req.params);
  send(res, 200, await service.list(chave, authUser(req)));
};

export const download = async (req: Request, res: Response) => {
  const { chave, id } = evidenceFileParamsSchema.parse(req.params);
  const f = await service.file(chave, id, authUser(req));
  res.set({
    'Content-Type': f.mimeType,
    'Content-Disposition': 'inline',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Evidence-SHA256': f.sha256,
  });
  res.send(f.buffer);
};
