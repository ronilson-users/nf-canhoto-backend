import { Devolucao, type IDevolucao } from './returns.model';

export class ReturnsRepository {
  async create(data: Partial<IDevolucao>): Promise<IDevolucao> {
    return (await new Devolucao(data).save()).toObject({ versionKey: false });
  }

  async findPlain(chave: string): Promise<IDevolucao | null> {
    return Devolucao.findOne({ chave }).select('-__v').lean<IDevolucao>();
  }

  async updateOne(chave: string, data: Partial<IDevolucao>): Promise<IDevolucao | null> {
    return Devolucao.findOneAndUpdate({ chave }, { $set: data }, { new: true, runValidators: true })
      .select('-__v')
      .lean<IDevolucao>();
  }

  async deleteByChave(chave: string) {
    return Devolucao.deleteOne({ chave });
  }
}
