import { Types } from 'mongoose';

import { AppError, ConflictError, NotFoundError } from '@/shared/utils/error';
import { NfeKeyError, parseNfeKey } from '@/shared/utils/nfe-key';

import { EventService } from '../events/event.service';
import { EvidenceRepository } from '../evidence/evidence.repository';
import { InvoiceService } from '../invoices/invoice.service';
import type { JwtPayload } from '../users/user.types';
import type { IDevolucao, IDevolucaoItem } from './returns.model';
import { ReturnsRepository } from './returns.repository';
import type { CollectInput, NfDevolucaoInput } from './returns.validation';

export class ReturnsService {
  private repo = new ReturnsRepository();
  private invoices = new InvoiceService();
  private evidences = new EvidenceRepository();
  private events = new EventService();

  /** Chamado ao finalizar a conferência quando há item recusado ou avariado. */
  async createFromReceiving(
    input: { chave: string; invoiceId: Types.ObjectId; companyId?: Types.ObjectId; itens: IDevolucaoItem[] },
    user: JwtPayload,
  ): Promise<IDevolucao> {
    const totalCentavos = input.itens.reduce((s, i) => s + i.valorCentavos, 0);
    try {
      const devolucao = await this.repo.create({
        chave: input.chave,
        invoiceId: input.invoiceId,
        companyId: input.companyId,
        status: 'pendente_coleta',
        itens: input.itens,
        totalCentavos,
        criadaPor: new Types.ObjectId(user.id),
        criadaEm: new Date(),
      });
      await this.events.record({
        chave: input.chave,
        type: 'devolucao_criada',
        user,
        payload: { devolucaoId: devolucao._id.toString(), itens: input.itens.length, totalCentavos },
      });
      return devolucao;
    } catch (error) {
      if ((error as { code?: unknown })?.code === 11000) throw new ConflictError('Já existe devolução para esta nota');
      throw error;
    }
  }

  async get(chave: string, user: JwtPayload): Promise<IDevolucao> {
    await this.invoices.getByChave(chave, user);
    const devolucao = await this.repo.findPlain(chave);
    if (!devolucao) throw new NotFoundError('Nenhuma devolução para esta nota');
    return devolucao;
  }

  /** O recebedor registra que o motorista levou a mercadoria de volta, com a assinatura dele. */
  async collect(chave: string, input: CollectInput, user: JwtPayload): Promise<IDevolucao> {
    const devolucao = await this.get(chave, user);
    if (devolucao.status !== 'pendente_coleta') throw new ConflictError('Devolução já coletada');

    const assinatura = await this.evidences.findById(input.assinaturaId);
    const valida =
      assinatura &&
      assinatura.chave === chave &&
      assinatura.tipo === 'assinatura' &&
      assinatura.signatario?.papel === 'motorista' &&
      assinatura.alvo.tipo === 'devolucao' &&
      assinatura.alvo.devolucaoId?.toString() === devolucao._id.toString();
    if (!valida) {
      throw new AppError(
        'assinaturaId deve ser uma evidência do tipo "assinatura", papel "motorista", com alvo "devolucao" desta nota',
        422,
      );
    }

    const updated = await this.repo.updateOne(chave, {
      status: 'coletada',
      coletadaEm: new Date(),
      coletadoPor: { nome: input.motoristaNome, documento: input.motoristaDocumento, placa: input.placa },
      assinaturaId: assinatura._id,
    });
    if (!updated) throw new NotFoundError('Devolução não encontrada');

    // nome e documento do motorista não entram na trilha imutável (LGPD)
    await this.events.record({
      chave,
      type: 'devolucao_coletada',
      user,
      payload: { devolucaoId: devolucao._id.toString(), assinaturaSha256: assinatura.arquivo.sha256, placa: input.placa },
    });
    return updated;
  }

  /** Registra a chave da NF de devolução (emitida pelo comprador ou pelo fornecedor). */
  async registerNf(chave: string, input: NfDevolucaoInput, user: JwtPayload): Promise<IDevolucao> {
    const invoice = await this.invoices.getByChave(chave, user);
    await this.get(chave, user);

    let key;
    try {
      key = parseNfeKey(input.chaveNfDevolucao);
    } catch (error) {
      if (error instanceof NfeKeyError) throw new AppError(error.message, 400);
      throw error;
    }
    if (key.chave === chave) {
      throw new AppError('A NF de devolução não pode ter a mesma chave da nota original', 422);
    }
    const partes = [invoice.destinatarioCnpj, invoice.emitenteCnpj].filter(Boolean);
    if (!partes.includes(key.cnpjEmitente)) {
      throw new AppError('O emitente da NF de devolução deve ser o destinatário ou o emitente da nota original', 422);
    }

    const updated = await this.repo.updateOne(chave, { nfDevolucaoChave: key.chave, nfRegistradaEm: new Date() });
    if (!updated) throw new NotFoundError('Devolução não encontrada');

    await this.events.record({ chave, type: 'nf_devolucao_registrada', user, payload: { chaveNfDevolucao: key.chave } });
    return updated;
  }

  /** Usado pelo reset do admin. Devolução já coletada só sai com force=true (somente testes). */
  async discardForReset(chave: string, force: boolean): Promise<void> {
    const devolucao = await this.repo.findPlain(chave);
    if (!devolucao) return;
    if (devolucao.status === 'coletada' && !force) {
      throw new ConflictError('Devolução já coletada: não é possível reiniciar a conferência (use force=true só em testes)');
    }
    await this.repo.deleteByChave(chave);
  }
}
