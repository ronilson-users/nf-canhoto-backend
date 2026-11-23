import { createHash } from 'node:crypto';
import { Types } from 'mongoose';

import { storage } from '@/infra/storage/local.storage';
import { AppError, NotFoundError } from '@/shared/utils/error';
import { detectImageType } from '@/shared/utils/image-type';

import { EventService } from '../events/event.service';
import { InvoiceService } from '../invoices/invoice.service';
import { ReturnsRepository } from '../returns/returns.repository';
import type { JwtPayload } from '../users/user.types';
import type { IEvidence } from './evidence.model';
import { EvidenceRepository } from './evidence.repository';
import type { EvidenceBody } from './evidence.validation';

/** Remove o caminho interno de armazenamento das respostas. */
const toPublic = (e: IEvidence) => {
  const { storageKey: _key, ...arquivo } = e.arquivo;
  return { ...e, arquivo };
};

export class EvidenceService {
  private repo = new EvidenceRepository();
  private invoices = new InvoiceService();
  private returns = new ReturnsRepository();
  private events = new EventService();

  async register(chave: string, file: { buffer: Buffer }, meta: EvidenceBody, user: JwtPayload) {
    const invoice = await this.invoices.getByChave(chave, user); // 404 se o usuário não enxerga a nota

    const image = detectImageType(file.buffer);
    if (!image) throw new AppError('O arquivo não é uma imagem válida (aceitos: JPEG, PNG e WebP)', 400);

    const alvo: IEvidence['alvo'] = { tipo: meta.alvo };
    if (meta.alvo === 'item') {
      const existe = invoice.itens.some((it, i) => (it.numeroItem ?? i + 1) === meta.numeroItem);
      if (!existe) throw new NotFoundError(`Item ${meta.numeroItem} não existe nesta nota`);
      alvo.numeroItem = meta.numeroItem;
    }
    if (meta.alvo === 'devolucao') {
      const devolucao = await this.returns.findPlain(chave);
      if (!devolucao) throw new AppError('Nenhuma devolução aberta para esta nota', 422);
      alvo.devolucaoId = devolucao._id;
    }

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const storageKey = `evidence/${chave}/${sha256}.${image.ext}`; // chave já validada (44 caracteres A-Z0-9)
    await storage.save(storageKey, file.buffer);

    const evidence = await this.repo.create({
      chave,
      invoiceId: invoice._id,
      tipo: meta.tipo,
      alvo,
      arquivo: { mimeType: image.mime, tamanhoBytes: file.buffer.length, sha256, storageKey },
      signatario: meta.nome && meta.papel ? { nome: meta.nome, documento: meta.documento, papel: meta.papel } : undefined,
      legenda: meta.legenda,
      capturadoEm: meta.capturadoEm ? new Date(meta.capturadoEm) : undefined,
      registradaPor: new Types.ObjectId(user.id),
      registradaEm: new Date(),
    });

    // a trilha guarda só ids e o hash do arquivo — nada de dados pessoais
    await this.events.record({
      chave,
      type: 'evidencia_registrada',
      user,
      payload: {
        evidenciaId: evidence._id.toString(),
        tipo: meta.tipo,
        alvo: alvo.tipo,
        numeroItem: alvo.numeroItem,
        papel: meta.papel,
        sha256,
        tamanhoBytes: file.buffer.length,
      },
    });
    return toPublic(evidence);
  }

  async list(chave: string, user: JwtPayload) {
    await this.invoices.getByChave(chave, user);
    return (await this.repo.listByChave(chave)).map(toPublic);
  }

  async file(chave: string, id: string, user: JwtPayload) {
    await this.invoices.getByChave(chave, user);
    const evidence = await this.repo.findById(id);
    if (!evidence || evidence.chave !== chave) throw new NotFoundError('Evidência não encontrada');
    try {
      const buffer = await storage.read(evidence.arquivo.storageKey);
      return { buffer, mimeType: evidence.arquivo.mimeType, sha256: evidence.arquivo.sha256 };
    } catch {
      throw new NotFoundError('Arquivo da evidência não encontrado no armazenamento');
    }
  }
}
