import type { Request, Response } from 'express';

import { AppError } from '@/shared/utils/error';

import { InvoiceService } from '../invoices/invoice.service';
import { chaveParamSchema } from '../invoices/invoice.validation';
import { EventService } from './event.service';

const invoiceService = new InvoiceService();
const eventService = new EventService();

export const list = async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Usuário não autenticado', 401);
  const { chave } = chaveParamSchema.parse(req.params);
  await invoiceService.getByChave(chave, req.user); // garante que o usuário enxerga a nota
  res.json({ success: true, data: await eventService.list(chave), timestamp: new Date().toISOString() });
};
