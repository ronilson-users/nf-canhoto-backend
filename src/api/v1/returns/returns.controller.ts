import type { Request, Response } from 'express';

import { AppError } from '@/shared/utils/error';

import { chaveParamSchema } from '../invoices/invoice.validation';
import { ReturnsService } from './returns.service';
import { collectSchema, nfDevolucaoSchema } from './returns.validation';

const service = new ReturnsService();

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

export const get = async (req: Request, res: Response) => {
  const { chave } = chaveParamSchema.parse(req.params);
  send(res, 200, await service.get(chave, authUser(req)));
};

export const collect = async (req: Request, res: Response) => {
  const { chave } = chaveParamSchema.parse(req.params);
  const input = collectSchema.parse(req.body);
  send(res, 200, await service.collect(chave, input, authUser(req)), 'Devolução coletada');
};

export const registerNf = async (req: Request, res: Response) => {
  const { chave } = chaveParamSchema.parse(req.params);
  const input = nfDevolucaoSchema.parse(req.body);
  send(res, 200, await service.registerNf(chave, input, authUser(req)), 'NF de devolução registrada');
};
