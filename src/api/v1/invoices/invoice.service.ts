import { createHash } from 'node:crypto';
import { Types, type FilterQuery } from 'mongoose';

import { AppError, ConflictError, NotFoundError } from '@/shared/utils/error';
import { NfeKeyError, parseNfeKey, type NfeKeyData } from '@/shared/utils/nfe-key';
import { NfeXmlError, type NfeXmlData } from '@/shared/utils/nfe-xml';
import { parseNfeXml } from '@/shared/utils/nfe-xml-parser';

import type { IInvoice, InvoiceStatus } from './invoice.model';
import type { JwtPayload } from '../users/user.types';
import { InvoiceRepository } from './invoice.repository';
import type { CreateInvoiceInput } from './invoice.validation';

const compact = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

const toDate = (s?: string) => (s ? new Date(s) : undefined);

/** Dados da nota a partir do XML. O XML é a fonte oficial: sobrescreve o que foi digitado antes. */
const fromXml = (p: NfeXmlData, xml: string): Partial<IInvoice> =>
  compact({
    chave: p.chave,
    uf: p.key.uf,
    ano: p.key.ano,
    mes: p.key.mes,
    emitenteCnpj: p.key.cnpjEmitente,
    emitenteNome: p.emitente.nome,
    modelo: p.key.modelo,
    serie: p.key.serie,
    numero: p.key.numero,
    destinatarioCnpj: p.destinatario.documento,
    destinatarioNome: p.destinatario.nome,
    pedido: p.extras.pedido,
    roteiro: p.extras.roteiro,
    motorista: p.extras.motorista,
    placa: p.transporte.placa,
    volumes: p.transporte.volumes,
    pesoLiquido: p.transporte.pesoLiquido,
    pesoBruto: p.transporte.pesoBruto,
    modalidadeFrete: p.transporte.modalidadeFrete,
    valorTotal: p.totais.nota,
    itens: p.itens,
    duplicatas: p.duplicatas,
    emitidaEm: toDate(p.emitidaEm),
    saidaEm: toDate(p.saidaEm),
    autorizada: p.autorizada,
    protocolo: p.protocolo
      ? { ...p.protocolo, recebidoEm: toDate(p.protocolo.recebidoEm) }
      : undefined,
    xml,
    xmlHash: createHash('sha256').update(xml).digest('hex'),
    xmlImportadoEm: new Date(),
  });

export class InvoiceService {
  private repo = new InvoiceRepository();

  /** Lê e valida a chave (sem gravar nada). Útil para o app preencher a tela após escanear. */
  parseKey(chave: string): NfeKeyData {
    try {
      return parseNfeKey(chave);
    } catch (error) {
      if (error instanceof NfeKeyError) throw new AppError(error.message, 400);
      throw error;
    }
  }

  /**
   * Visibilidade provisória: admin vê tudo; os demais veem o que a própria empresa
   * (ou o próprio usuário) registrou. Quando existir o módulo companies, trocar por
   * "emitente OU destinatário OU transportadora da entrega = CNPJ da empresa".
   */
  private scope(user: JwtPayload): FilterQuery<IInvoice> {
    if (user.role === 'admin') return {};
    const or: FilterQuery<IInvoice>[] = [{ createdBy: new Types.ObjectId(user.id) }];
    if (user.companyId) or.push({ companyId: new Types.ObjectId(user.companyId) });
    return { $or: or };
  }

  async register(input: CreateInvoiceInput, user: JwtPayload): Promise<IInvoice> {
    const key = this.parseKey(input.chave);

    if (await this.repo.findOne({ chave: key.chave })) {
      throw new ConflictError('Nota fiscal já registrada');
    }

    try {
      return await this.repo.create({
        chave: key.chave,
        uf: key.uf,
        ano: key.ano,
        mes: key.mes,
        emitenteCnpj: key.cnpjEmitente,
        modelo: key.modelo,
        serie: key.serie,
        numero: key.numero,
        destinatarioCnpj: input.destinatarioCnpj,
        pedido: input.pedido,
        roteiro: input.roteiro,
        motorista: input.motorista,
        placa: input.placa,
        volumes: input.volumes,
        status: 'registrada' as InvoiceStatus,
        companyId: user.companyId ? new Types.ObjectId(user.companyId) : undefined,
        createdBy: new Types.ObjectId(user.id),
      });
    } catch (error) {
      // corrida entre dois registros da mesma chave
      if ((error as { code?: unknown })?.code === 11000) throw new ConflictError('Nota fiscal já registrada');
      throw error;
    }
  }

  /**
   * Importa o XML da NF-e: valida, extrai itens/valores e grava.
   * Se a nota já existe e é visível ao usuário, atualiza; se existe de outra empresa, 409.
   */
  async importXml(buffer: Buffer, user: JwtPayload) {
    const xml = buffer.toString('utf8');

    let parsed: NfeXmlData;
    try {
      parsed = parseNfeXml(xml);
    } catch (error) {
      if (error instanceof NfeXmlError) throw new AppError(error.message, error.statusCode);
      if (error instanceof NfeKeyError) throw new AppError(error.message, 400);
      throw error;
    }

    const data = fromXml(parsed, xml);
    const own = await this.repo.findOne({ chave: parsed.chave, ...this.scope(user) });

    if (own) {
      const invoice = await this.repo.updateOne({ chave: parsed.chave }, data);
      if (!invoice) throw new NotFoundError('Nota fiscal não encontrada');
      return { invoice, created: false, avisos: parsed.avisos };
    }

    if (await this.repo.findOne({ chave: parsed.chave })) {
      throw new ConflictError('Nota fiscal já registrada por outra empresa');
    }

    try {
      const invoice = await this.repo.create({
        ...data,
        status: 'registrada' as InvoiceStatus,
        companyId: user.companyId ? new Types.ObjectId(user.companyId) : undefined,
        createdBy: new Types.ObjectId(user.id),
      });
      return { invoice, created: true, avisos: parsed.avisos };
    } catch (error) {
      if ((error as { code?: unknown })?.code === 11000) throw new ConflictError('Nota fiscal já registrada');
      throw error;
    }
  }

  async getByChave(chave: string, user: JwtPayload): Promise<IInvoice> {
    const invoice = await this.repo.findOne({ chave, ...this.scope(user) });
    if (!invoice) throw new NotFoundError('Nota fiscal não encontrada');
    return invoice;
  }

  async list(user: JwtPayload, page: number, limit: number, status?: InvoiceStatus) {
    const filter: FilterQuery<IInvoice> = { ...this.scope(user), ...(status ? { status } : {}) };
    return this.repo.findPage(filter, page, limit);
  }
}
