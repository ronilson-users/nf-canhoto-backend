import { Schema, model } from 'mongoose';

import { CATEGORIAS, SUBCATEGORIAS, type Categoria, type Subcategoria } from './receiving.perishable';

/** O NCM não diz se o produto é congelado: guardamos a categoria na primeira conferência. */
export interface IProductProfile {
  /** empresa do usuário (ou "user:<id>" enquanto não existir o módulo companies) */
  owner: string;
  emitenteCnpj: string;
  codigo: string;
  descricao: string;
  categoria: Categoria;
  subcategoria?: Subcategoria;
  updatedAt: Date;
}

const schema = new Schema<IProductProfile>({
  owner: { type: String, required: true },
  emitenteCnpj: { type: String, required: true },
  codigo: { type: String, required: true },
  descricao: { type: String, required: true },
  categoria: { type: String, enum: CATEGORIAS, required: true },
  subcategoria: { type: String, enum: SUBCATEGORIAS },
  updatedAt: { type: Date, required: true },
});
schema.index({ owner: 1, emitenteCnpj: 1, codigo: 1 }, { unique: true });

export const ProductProfile = model<IProductProfile>('ProductProfile', schema);

export class ProductProfileRepository {
  async findMany(owner: string, emitenteCnpj: string, codigos: string[]): Promise<IProductProfile[]> {
    return ProductProfile.find({ owner, emitenteCnpj, codigo: { $in: codigos } }).lean<IProductProfile[]>();
  }

  async upsert(p: Omit<IProductProfile, 'updatedAt'>): Promise<void> {
    const set: Record<string, unknown> = {
      descricao: p.descricao,
      categoria: p.categoria,
      updatedAt: new Date(),
    };
    if (p.subcategoria) set.subcategoria = p.subcategoria;
    await ProductProfile.updateOne(
      { owner: p.owner, emitenteCnpj: p.emitenteCnpj, codigo: p.codigo },
      p.subcategoria ? { $set: set } : { $set: set, $unset: { subcategoria: 1 } },
      { upsert: true },
    );
  }
}
