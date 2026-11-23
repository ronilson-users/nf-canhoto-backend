import { createHash } from 'node:crypto';
import { Types } from 'mongoose';

import { AppError } from '@/shared/utils/error';

import type { JwtPayload } from '../users/user.types';
import { InvoiceEvent, type IInvoiceEvent } from './event.model';

const GENESIS = 'GENESIS';

const computeHash = (e: Pick<IInvoiceEvent, 'chave' | 'seq' | 'type' | 'actorRole' | 'payload' | 'prevHash' | 'createdAt'> & { actorId: unknown }) =>
  createHash('sha256')
    .update(JSON.stringify([e.chave, e.seq, e.type, String(e.actorId), e.actorRole, e.payload, e.prevHash, e.createdAt.toISOString()]))
    .digest('hex');

export interface RecordEventInput {
  chave: string;
  type: string;
  user: JwtPayload;
  payload?: Record<string, unknown>;
}

export class EventService {
  /** Acrescenta um evento à cadeia da nota. Nunca atualiza nem apaga eventos. */
  async record({ chave, type, user, payload = {} }: RecordEventInput): Promise<IInvoiceEvent> {
    // normaliza: remove undefined e Date, para o hash bater depois de ler do banco
    const cleanPayload = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;

    for (let attempt = 0; attempt < 3; attempt++) {
      const last = await InvoiceEvent.findOne({ chave }).sort({ seq: -1 }).lean<IInvoiceEvent>();
      const seq = (last?.seq ?? 0) + 1;
      const prevHash = last?.hash ?? GENESIS;
      const createdAt = new Date();
      const actorId = new Types.ObjectId(user.id);

      const hash = computeHash({ chave, seq, type, actorId, actorRole: user.role, payload: cleanPayload, prevHash, createdAt });

      try {
        const created = await InvoiceEvent.create({ chave, seq, type, actorId, actorRole: user.role, payload: cleanPayload, prevHash, hash, createdAt });
        return created.toObject();
      } catch (error) {
        // outro evento da mesma nota entrou no mesmo seq: tenta de novo
        if ((error as { code?: unknown })?.code === 11000) continue;
        throw error;
      }
    }
    throw new AppError('Não foi possível registrar o evento da nota', 500);
  }

  /** Lista a trilha e confere a cadeia de hashes. */
  async list(chave: string) {
    const events = await InvoiceEvent.find({ chave }).select('-__v').sort({ seq: 1 }).lean<IInvoiceEvent[]>();

    let prev = GENESIS;
    let integridadeOk = true;
    for (const e of events) {
      if (e.prevHash !== prev || e.hash !== computeHash(e)) {
        integridadeOk = false;
        break;
      }
      prev = e.hash;
    }
    return { events, total: events.length, integridadeOk };
  }
}
