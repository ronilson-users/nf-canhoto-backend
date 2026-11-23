import type { FilterQuery } from 'mongoose';

import { Invoice, type IInvoice } from './invoice.model';

export class InvoiceRepository {
  async create(data: Partial<IInvoice>): Promise<IInvoice> {
    const saved = (await new Invoice(data).save()).toObject();
    delete saved.xml; // o XML não volta nas respostas
    return saved;
  }

  async findOne(filter: FilterQuery<IInvoice>): Promise<IInvoice | null> {
    return Invoice.findOne(filter).select('-__v').lean<IInvoice>();
  }

  /** Atualiza só os campos informados (status e createdBy nunca são enviados por aqui). */
  async updateOne(filter: FilterQuery<IInvoice>, data: Partial<IInvoice>): Promise<IInvoice | null> {
    return Invoice.findOneAndUpdate(filter, { $set: data }, { new: true, runValidators: true })
      .select('-__v')
      .lean<IInvoice>();
  }

  async findPage(filter: FilterQuery<IInvoice>, page: number, limit: number) {
    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<IInvoice[]>(),
      Invoice.countDocuments(filter),
    ]);
    return { invoices, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
