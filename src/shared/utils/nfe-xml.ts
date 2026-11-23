/**
 * Extração dos dados de uma NF-e (modelo 55, layout 4.00) a partir do objeto
 * produzido pelo parser de XML. Função pura, sem dependências: o parser fica em
 * nfe-xml-parser.ts.
 */
import { isValidCnpj, normalizeCnpj, parseNfeKey, type NfeKeyData } from './nfe-key';

export class NfeXmlError extends Error {
  constructor(message: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = 'NfeXmlError';
  }
}

export interface NfeXmlItem {
  numeroItem: number;
  codigo: string;
  descricao: string;
  ncm?: string;
  cfop?: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface NfeXmlData {
  chave: string;
  key: NfeKeyData;
  naturezaOperacao?: string;
  emitidaEm?: string;
  saidaEm?: string;
  emitente: { cnpj: string; nome: string };
  destinatario: { documento?: string; nome?: string };
  itens: NfeXmlItem[];
  totais: { produtos: number; nota: number; baseIcms: number; icms: number; frete: number; desconto: number };
  transporte: {
    modalidadeFrete?: number;
    placa?: string;
    volumes?: number;
    marca?: string;
    numeracao?: string;
    pesoLiquido?: number;
    pesoBruto?: number;
  };
  duplicatas: { numero: string; vencimento?: string; valor: number }[];
  infoComplementar?: string;
  /** Extraído do texto livre (infCpl) — formato depende do ERP do emitente. */
  extras: { pedido?: string; roteiro?: string; motorista?: string };
  protocolo?: { numero: string; recebidoEm?: string; status: number; motivo?: string };
  autorizada: boolean;
  avisos: string[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const asArray = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const str = (v: unknown): string | undefined => (v == null || v === '' ? undefined : String(v).trim());

const num = (v: unknown, campo: string): number => {
  const n = Number(v);
  if (v == null || v === '' || !Number.isFinite(n)) throw new NfeXmlError(`Campo numérico inválido no XML: ${campo}`);
  return n;
};
const numOpt = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const cents = (n: number) => Math.round(n * 100);

const extractExtras = (infCpl?: string) => {
  if (!infCpl) return {};
  const pick = (re: RegExp) => infCpl.match(re)?.[1]?.trim();
  return {
    pedido: pick(/PEDIDO:\s*([A-Za-z0-9\-/]+)/i),
    roteiro: pick(/ROTEIRO:\s*([A-Za-z0-9\-/]+)/i),
    // vai até o próximo "RÓTULO:" ou "VAL APROX"
    motorista: pick(/MOTORISTA:\s*(.+?)(?=\s+[A-ZÇÃ.]+:|\s+VAL APROX|$)/i),
  };
};

export const extractNfe = (obj: any): NfeXmlData => {
  const root = obj?.nfeProc ?? obj;
  const inf = root?.NFe?.infNFe;
  if (!inf) throw new NfeXmlError('XML não parece uma NF-e (infNFe ausente)');

  const key = parseNfeKey(String(inf['@_Id'] ?? '')); // valida DV, UF, CNPJ, modelo 55
  const avisos: string[] = [];

  // --- coerência XML × chave ---
  const emitCnpj = normalizeCnpj(String(inf.emit?.CNPJ ?? ''));
  if (emitCnpj !== key.cnpjEmitente) throw new NfeXmlError('CNPJ do emitente no XML difere da chave de acesso');
  if (Number(inf.ide?.nNF) !== key.numero) throw new NfeXmlError('Número da nota no XML difere da chave de acesso');
  if (Number(inf.ide?.serie) !== key.serie) throw new NfeXmlError('Série no XML difere da chave de acesso');

  // --- protocolo de autorização ---
  const prot = root?.protNFe?.infProt;
  let protocolo: NfeXmlData['protocolo'];
  let autorizada = false;
  if (prot) {
    if (str(prot.chNFe) && str(prot.chNFe) !== key.chave) {
      throw new NfeXmlError('Chave do protocolo difere da chave da NF-e');
    }
    const status = Number(prot.cStat);
    protocolo = {
      numero: String(prot.nProt ?? ''),
      recebidoEm: str(prot.dhRecbto),
      status,
      motivo: str(prot.xMotivo),
    };
    if (status !== 100 && status !== 150) {
      throw new NfeXmlError(`NF-e não autorizada (cStat ${status}: ${protocolo.motivo ?? 'sem motivo'})`, 422);
    }
    autorizada = true;
  } else {
    avisos.push('XML sem protocolo de autorização (protNFe): não é possível confirmar que a NF-e foi autorizada.');
  }

  // --- itens ---
  const itens: NfeXmlItem[] = asArray<any>(inf.det).map((d, i) => {
    const p = d.prod ?? {};
    const item: NfeXmlItem = {
      numeroItem: Number(d['@_nItem'] ?? i + 1),
      codigo: String(p.cProd ?? ''),
      descricao: String(p.xProd ?? ''),
      ncm: str(p.NCM),
      cfop: str(p.CFOP),
      unidade: String(p.uCom ?? ''),
      quantidade: num(p.qCom, `det[${i + 1}].qCom`),
      valorUnitario: num(p.vUnCom, `det[${i + 1}].vUnCom`),
      valorTotal: num(p.vProd, `det[${i + 1}].vProd`),
    };
    // tolerância de 2 centavos: qCom × vUnCom é arredondado no vProd
    if (Math.abs(cents(item.quantidade * item.valorUnitario) - cents(item.valorTotal)) > 2) {
      avisos.push(`Item ${item.numeroItem}: quantidade × valor unitário não fecha com o valor total.`);
    }
    return item;
  });
  if (itens.length === 0) throw new NfeXmlError('NF-e sem itens (det ausente)');

  // --- totais ---
  const t = inf.total?.ICMSTot ?? {};
  const totais = {
    produtos: num(t.vProd, 'total.vProd'),
    nota: num(t.vNF, 'total.vNF'),
    baseIcms: numOpt(t.vBC) ?? 0,
    icms: numOpt(t.vICMS) ?? 0,
    frete: numOpt(t.vFrete) ?? 0,
    desconto: numOpt(t.vDesc) ?? 0,
  };
  const somaItens = itens.reduce((s, it) => s + cents(it.valorTotal), 0);
  if (Math.abs(somaItens - cents(totais.produtos)) > 1) {
    avisos.push('A soma dos itens não fecha com o total de produtos da nota.');
  }

  // --- transporte (vol pode ser um ou vários) ---
  const transp = inf.transp ?? {};
  const vols = asArray<any>(transp.vol);
  const somaVol = (campo: string) => {
    const vals = vols.map((v) => numOpt(v[campo])).filter((n): n is number => n !== undefined);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : undefined;
  };
  const transporte = {
    modalidadeFrete: numOpt(transp.modFrete),
    placa: str(transp.veicTransp?.placa)?.toUpperCase(),
    volumes: somaVol('qVol'),
    marca: str(vols[0]?.marca),
    numeracao: str(vols[0]?.nVol),
    pesoLiquido: somaVol('pesoL'),
    pesoBruto: somaVol('pesoB'),
  };

  // --- cobrança ---
  const duplicatas = asArray<any>(inf.cobr?.dup).map((d) => ({
    numero: String(d.nDup ?? ''),
    vencimento: str(d.dVenc),
    valor: num(d.vDup, 'cobr.dup.vDup'),
  }));
  if (duplicatas.length) {
    const somaDup = duplicatas.reduce((s, d) => s + cents(d.valor), 0);
    if (Math.abs(somaDup - cents(totais.nota)) > 1) {
      avisos.push('A soma das duplicatas não fecha com o valor total da nota.');
    }
  }

  // --- destinatário (CNPJ ou CPF) ---
  const destDoc = str(inf.dest?.CNPJ) ?? str(inf.dest?.CPF);
  if (inf.dest?.CNPJ && !isValidCnpj(String(inf.dest.CNPJ))) {
    avisos.push('CNPJ do destinatário inválido no XML.');
  }

  const infoComplementar = str(inf.infAdic?.infCpl);

  return {
    chave: key.chave,
    key,
    naturezaOperacao: str(inf.ide?.natOp),
    emitidaEm: str(inf.ide?.dhEmi),
    saidaEm: str(inf.ide?.dhSaiEnt),
    emitente: { cnpj: emitCnpj, nome: String(inf.emit?.xNome ?? '') },
    destinatario: { documento: destDoc ? normalizeCnpj(destDoc) : undefined, nome: str(inf.dest?.xNome) },
    itens,
    totais,
    transporte,
    duplicatas,
    infoComplementar,
    extras: extractExtras(infoComplementar),
    protocolo,
    autorizada,
    avisos,
  };
};
