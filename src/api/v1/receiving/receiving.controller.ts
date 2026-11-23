import type { Request, Response } from 'express';

import { AppError } from '@/shared/utils/error';

import { chaveParamSchema } from '../invoices/invoice.validation';
import { ReceivingService } from './receiving.service';
import { conferItemSchema, finishSchema, itemParamsSchema } from './receiving.validation';

const service = new ReceivingService();

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

export const start = async (req: Request, res: Response) => {
  const { chave } = chaveParamSchema.parse(req.params);
  send(res, 201, await service.start(chave, authUser(req)), 'Conferência iniciada');
};

export const get = async (req: Request, res: Response) => {
  const { chave } = chaveParamSchema.parse(req.params);
  send(res, 200, await service.get(chave, authUser(req)));
};

export const conferItem = async (req: Request, res: Response) => {
  const { chave, numeroItem } = itemParamsSchema.parse(req.params);
  const input = conferItemSchema.parse(req.body);
  send(res, 200, await service.conferItem(chave, numeroItem, input, authUser(req)), 'Item conferido');
};

export const finish = async (req: Request, res: Response) => {
  const { chave } = chaveParamSchema.parse(req.params);
  const input = finishSchema.parse(req.body ?? {});
  send(res, 200, await service.finish(chave, input, authUser(req)), 'Conferência finalizada');
};

export const reset = async (req: Request, res: Response) => {
  const { chave } = chaveParamSchema.parse(req.params);
  // force=true: apaga também uma devolução já coletada (apenas para testes)
  await service.reset(chave, authUser(req), req.query.force === 'true');
  send(res, 200, undefined, 'Conferência reiniciada');
};
