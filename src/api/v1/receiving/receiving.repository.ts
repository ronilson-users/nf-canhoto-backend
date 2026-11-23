import { Receiving, type IReceiving } from './receiving.model';

export class ReceivingRepository {
  async create(data: Partial<IReceiving>) {
    return new Receiving(data).save();
  }

  /** Documento do Mongoose (editável e com .save()). */
  async findDoc(chave: string) {
    return Receiving.findOne({ chave });
  }

  async findPlain(chave: string): Promise<IReceiving | null> {
    return Receiving.findOne({ chave }).select('-__v').lean<IReceiving>();
  }

  async deleteByChave(chave: string) {
    return Receiving.deleteOne({ chave });
  }
}
