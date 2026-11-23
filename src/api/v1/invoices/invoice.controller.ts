import type { Request, Response } from 'express';

 import { AppError } from '@/shared/utils/error';

import { InvoiceService } from './invoice.service';
import {
  chaveParamSchema,
  createInvoiceSchema,
  listInvoicesQuerySchema,
  parseKeySchema,
} from './invoice.validation';

const invoiceService = new InvoiceService();

const send = (res: Response, status: number, data: unknown, message?: string) =>
  res.status(status).json({
    success: true,
    ...(message ? { message } : {}),
    data,
    timestamp: new Date().toISOString(),
  });

const authUser = (req: Request) => {
  if (!req.user) throw new AppError('Usuário não autenticado', 401);
  return req.user;
};

export const parseKey = async (req: Request, res: Response) => {
  const { chave } = parseKeySchema.parse(req.body);
  send(res, 200, invoiceService.parseKey(chave));
};

export const create = async (req: Request, res: Response) => {
  const invoice = await invoiceService.register(createInvoiceSchema.parse(req.body), authUser(req));
  send(res, 201, invoice, 'Nota fiscal registrada com sucesso');
};

export const list = async (req: Request, res: Response) => {
  const { page, limit, status } = listInvoicesQuerySchema.parse(req.query);
  send(res, 200, await invoiceService.list(authUser(req), page, limit, status));
};

export const getByChave = async (req: Request, res: Response) => {
  const { chave } = chaveParamSchema.parse(req.params);
  send(res, 200, await invoiceService.getByChave(chave, authUser(req)));
};

export const importXml = async (req: Request, res: Response) => {
  // preenchido pelo multer (upload.single('xml'))
  const file = (req as unknown as { file?: { buffer: Buffer } }).file;
  if (!file) throw new AppError('Envie o arquivo XML no campo "xml" (multipart/form-data)', 400);

  const { invoice, created, avisos } = await invoiceService.importXml(file.buffer, authUser(req));
  send(
    res,
    created ? 201 : 200,
    { invoice, avisos },
    created ? 'NF-e importada com sucesso' : 'NF-e atualizada com os dados do XML',
  );
};
