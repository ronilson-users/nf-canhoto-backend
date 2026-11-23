import { Types } from 'mongoose';

import { Evidence, type IEvidence } from './evidence.model';

export class EvidenceRepository {
  async create(data: Partial<IEvidence>): Promise<IEvidence> {
    return (await new Evidence(data).save()).toObject({ versionKey: false });
  }

  async findById(id: string): Promise<IEvidence | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return Evidence.findById(id).select('-__v').lean<IEvidence>();
  }

  async listByChave(chave: string): Promise<IEvidence[]> {
    return Evidence.find({ chave }).select('-__v').sort({ registradaEm: 1 }).lean<IEvidence[]>();
  }
}
