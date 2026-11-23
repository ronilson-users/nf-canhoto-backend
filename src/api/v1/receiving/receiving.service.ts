import { Types } from 'mongoose';

import { AppError, ConflictError, NotFoundError } from '@/shared/utils/error';

import { EventService } from '../events/event.service';
import type { InvoiceStatus } from '../invoices/invoice.model';
import { InvoiceRepository } from '../invoices/invoice.repository';
import { InvoiceService } from '../invoices/invoice.service';
import type { IDevolucaoItem } from '../returns/returns.model';
import { ReturnsService } from '../returns/returns.service';
import type { JwtPayload } from '../users/user.types';
import { evaluateItem, resultStatus, summarize } from './receiving.calc';
import type { IPerecivel, IReceiving } from './receiving.model';
import { evaluatePerishable, todayBR } from './receiving.perishable';
import { ProductProfileRepository } from './receiving.profile';
import { ReceivingRepository } from './receiving.repository';
import type { ConferItemInput, FinishInput } from './receiving.validation';

const toId = (id: string) => new Types.ObjectId(id);
/** Dono do catálogo de produtos: a empresa do usuário (ou o próprio usuário, sem empresa). */
const ownerKey = (user: JwtPayload) => user.companyId ?? `user:${user.id}`;

export class ReceivingService {
  private repo = new ReceivingRepository();
  private invoices = new InvoiceService();
  private invoiceRepo = new InvoiceRepository();
  private events = new EventService();
  private returns = new ReturnsService();
  private profiles = new ProductProfileRepository();

  /** Abre a conferência a partir dos itens da NF-e (exige XML importado). */
  async start(chave: string, user: JwtPayload): Promise<IReceiving> {
    const invoice = await this.invoices.getByChave(chave, user);

    if (!invoice.itens?.length) {
      throw new AppError('Importe o XML da NF-e antes de iniciar a conferência', 422);
    }
    if (await this.repo.findPlain(chave)) {
      throw new ConflictError('Conferência já iniciada para esta nota');
    }

    const profiles = await this.profiles.findMany(
      ownerKey(user),
      invoice.emitenteCnpj,
      invoice.itens.map((i) => i.codigo),
    );
    const byCode = new Map(profiles.map((p) => [p.codigo, p]));

    try {
      const created = await this.repo.create({
        chave,
        invoiceId: invoice._id,
        companyId: user.companyId ? toId(user.companyId) : undefined,
        status: 'em_conferencia',
        startedBy: toId(user.id),
        startedAt: new Date(),
        volumesEsperados: invoice.volumes,
        itens: invoice.itens.map((it, i) => {
          const perfil = byCode.get(it.codigo);
          return {
            numeroItem: it.numeroItem ?? i + 1,
            codigo: it.codigo,
            descricao: it.descricao,
            unidade: it.unidade,
            quantidadeEsperada: it.quantidade,
            valorUnitario: it.valorUnitario,
            categoriaSugerida: perfil?.categoria,
            subcategoriaSugerida: perfil?.subcategoria,
            conferido: false,
          };
        }),
      });
      await this.invoiceRepo.updateOne({ chave }, { status: 'na_doca' as InvoiceStatus });
      await this.events.record({
        chave,
        type: 'conferencia_iniciada',
        user,
        payload: { itens: created.itens.length, volumesEsperados: invoice.volumes },
      });
      return created.toObject({ versionKey: false });
    } catch (error) {
      if ((error as { code?: unknown })?.code === 11000) throw new ConflictError('Conferência já iniciada para esta nota');
      throw error;
    }
  }

  async get(chave: string, user: JwtPayload): Promise<IReceiving> {
    await this.invoices.getByChave(chave, user);
    const receiving = await this.repo.findPlain(chave);
    if (!receiving) throw new NotFoundError('Conferência não iniciada para esta nota');
    return receiving;
  }

  async conferItem(chave: string, numeroItem: number, input: ConferItemInput, user: JwtPayload): Promise<IReceiving> {
    const invoice = await this.invoices.getByChave(chave, user);
    const doc = await this.repo.findDoc(chave);
    if (!doc) throw new NotFoundError('Conferência não iniciada para esta nota');
    if (doc.status === 'finalizada') throw new ConflictError('Conferência já finalizada');

    const item = doc.itens.find((i) => i.numeroItem === numeroItem);
    if (!item) throw new NotFoundError(`Item ${numeroItem} não existe nesta nota`);

    // recusa: o que chegou fisicamente (e volta com o motorista) é o informado, ou o esperado
    const recebida = input.recusado
      ? (input.quantidadeRecebida ?? item.quantidadeEsperada)
      : (input.quantidadeRecebida ?? 0);
    const avariada = input.recusado ? 0 : input.quantidadeAvariada;

    const r = evaluateItem(
      { unidade: item.unidade, quantidadeEsperada: item.quantidadeEsperada, valorUnitario: item.valorUnitario },
      { quantidadeRecebida: recebida, quantidadeAvariada: avariada, recusado: input.recusado },
    );

    // --- perecíveis (FT-19) ---
    let perecivel: IPerecivel | undefined;
    let motivo = input.motivo;
    if (input.perecivel) {
      const { ressalva, ...dados } = input.perecivel;
      const ev = evaluatePerishable(dados, todayBR());

      if (ev.conformidade === 'nao_conforme' && !input.recusado && !ressalva) {
        throw new AppError(
          `Item não conforme: ${ev.motivos.join('; ')}. Recuse o item (recusado: true) ou informe a ressalva do responsável técnico.`,
          422,
        );
      }
      perecivel = {
        categoria: dados.categoria,
        subcategoria: dados.subcategoria,
        temperaturaC: dados.temperaturaC,
        limiteC: ev.limiteC,
        lote: dados.lote,
        sif: dados.sif,
        fabricacao: dados.fabricacao,
        validade: dados.validade,
        condicoes: dados.condicoes,
        conformidade: ev.conformidade,
        motivosNaoConformidade: ev.motivos,
        ressalva,
      };
      if (input.recusado && !motivo && ev.motivos.length) motivo = ev.motivos.join('; ');
    }

    const quantidadeDevolver = r.tipo === 'recusa' ? recebida : r.tipo === 'avaria' ? avariada : 0;

    item.conferido = true;
    item.quantidadeRecebida = recebida;
    item.quantidadeAvariada = avariada;
    item.recusado = input.recusado;
    item.motivo = motivo;
    item.tipo = r.tipo;
    item.quantidadeAceita = r.quantidadeAceita;
    item.quantidadeDevolver = quantidadeDevolver;
    item.diferenca = r.diferenca;
    item.dentroDaTolerancia = r.dentroDaTolerancia;
    item.valorAbaterCentavos = r.valorAbaterCentavos;
    item.valorSobraCentavos = r.valorSobraCentavos;
    item.perecivel = perecivel;
    item.conferidoPor = toId(user.id);
    item.conferidoEm = new Date();
    await doc.save();

    if (input.perecivel) {
      await this.profiles.upsert({
        owner: ownerKey(user),
        emitenteCnpj: invoice.emitenteCnpj,
        codigo: item.codigo,
        descricao: item.descricao,
        categoria: input.perecivel.categoria,
        subcategoria: input.perecivel.subcategoria,
      });
    }

    await this.events.record({
      chave,
      type: 'item_conferido',
      user,
      payload: {
        numeroItem,
        tipo: r.tipo,
        quantidadeRecebida: recebida,
        quantidadeAvariada: avariada,
        quantidadeDevolver,
        recusado: input.recusado,
        motivo,
        valorAbaterCentavos: r.valorAbaterCentavos,
        perecivel: perecivel
          ? {
              categoria: perecivel.categoria,
              temperaturaC: perecivel.temperaturaC,
              conformidade: perecivel.conformidade,
              comRessalva: Boolean(perecivel.ressalva),
            }
          : undefined,
      },
    });
    return doc.toObject({ versionKey: false });
  }

  async finish(chave: string, input: FinishInput, user: JwtPayload): Promise<IReceiving> {
    const invoice = await this.invoices.getByChave(chave, user);
    const doc = await this.repo.findDoc(chave);
    if (!doc) throw new NotFoundError('Conferência não iniciada para esta nota');
    if (doc.status === 'finalizada') throw new ConflictError('Conferência já finalizada');

    const pendentes = doc.itens.filter((i) => !i.conferido).map((i) => i.numeroItem);
    if (pendentes.length) {
      throw new AppError(`Itens ainda não conferidos: ${pendentes.join(', ')}`, 422);
    }

    const volumesDivergentes =
      input.volumesRecebidos !== undefined &&
      doc.volumesEsperados !== undefined &&
      doc.volumesEsperados !== null &&
      input.volumesRecebidos !== doc.volumesEsperados;

    const valorNotaCentavos = Math.round((invoice.valorTotal ?? 0) * 100);
    const resumo = summarize(doc.itens, valorNotaCentavos);
    const resultado = resultStatus(doc.itens, volumesDivergentes);

    // devolução: o que volta com o motorista (itens recusados e unidades avariadas)
    const devolucaoItens: IDevolucaoItem[] = doc.itens
      .filter((i) => (i.quantidadeDevolver ?? 0) > 0)
      .map((i) => {
        const quantidade = i.quantidadeDevolver as number;
        return {
          numeroItem: i.numeroItem,
          codigo: i.codigo,
          descricao: i.descricao,
          unidade: i.unidade,
          quantidade,
          valorUnitario: i.valorUnitario,
          valorCentavos: Math.round(quantidade * i.valorUnitario * 100),
          tipo: i.tipo === 'recusa' ? ('recusa' as const) : ('avaria' as const),
          motivo: i.motivo,
        };
      });

    if (devolucaoItens.length) {
      const devolucao = await this.returns.createFromReceiving(
        { chave, invoiceId: doc.invoiceId, companyId: doc.companyId, itens: devolucaoItens },
        user,
      );
      doc.devolucaoId = devolucao._id;
    }

    doc.status = 'finalizada';
    doc.finishedBy = toId(user.id);
    doc.finishedAt = new Date();
    doc.volumesRecebidos = input.volumesRecebidos;
    doc.volumesDivergentes = volumesDivergentes;
    doc.observacao = input.observacao;
    doc.resumo = resumo;
    doc.resultado = resultado;
    await doc.save();

    await this.invoiceRepo.updateOne({ chave }, { status: resultado as InvoiceStatus });
    await this.events.record({
      chave,
      type: 'conferencia_finalizada',
      user,
      payload: {
        resultado,
        volumesRecebidos: input.volumesRecebidos,
        volumesDivergentes,
        observacao: input.observacao,
        devolucaoItens: devolucaoItens.length,
        ...resumo,
      },
    });
    return doc.toObject({ versionKey: false });
  }

  /** Só admin (rota protegida). A trilha de eventos e as evidências são preservadas. */
  async reset(chave: string, user: JwtPayload, force = false): Promise<void> {
    await this.invoices.getByChave(chave, user);
    if (!(await this.repo.findPlain(chave))) throw new NotFoundError('Conferência não iniciada para esta nota');

    await this.returns.discardForReset(chave, force); // 409 se a devolução já foi coletada
    await this.repo.deleteByChave(chave);

    await this.invoiceRepo.updateOne({ chave }, { status: 'registrada' as InvoiceStatus });
    await this.events.record({ chave, type: 'conferencia_reiniciada', user, payload: { force } });
  }
}
