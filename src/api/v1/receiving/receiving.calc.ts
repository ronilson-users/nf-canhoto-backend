/**
 * Regras de conferência no recebimento — funções puras (sem banco).
 * Valores monetários em CENTAVOS (inteiros); quantidades com até 4 casas.
 */
export const WEIGHT_UNITS = ['KG', 'G', 'L', 'LT', 'ML'] as const;
/** Tolerância para itens vendidos a peso/volume variável. */
export const WEIGHT_TOLERANCE = 0.02;

export type DivergenciaTipo = 'ok' | 'falta' | 'sobra' | 'avaria' | 'recusa';
export type ConferenciaResultado = 'conferida' | 'com_divergencia' | 'recebida_parcial' | 'recusada';

export interface ItemBase {
  unidade: string;
  quantidadeEsperada: number;
  valorUnitario: number;
}

export interface ItemInput {
  quantidadeRecebida: number;
  quantidadeAvariada: number;
  recusado: boolean;
}

export interface ItemResult {
  tipo: DivergenciaTipo;
  quantidadeAceita: number;
  /** esperada − aceita: positivo = falta, negativo = sobra */
  diferenca: number;
  dentroDaTolerancia: boolean;
  valorAbaterCentavos: number;
  valorSobraCentavos: number;
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const cents = (qty: number, unit: number) => Math.round(qty * unit * 100);
const EPS = 1e-9;

export const isWeightUnit = (unidade: string) =>
  (WEIGHT_UNITS as readonly string[]).includes(unidade.trim().toUpperCase());

export const evaluateItem = (base: ItemBase, input: ItemInput): ItemResult => {
  const { quantidadeEsperada: esperada, valorUnitario } = base;

  if (input.recusado) {
    return {
      tipo: 'recusa',
      quantidadeAceita: 0,
      diferenca: r4(esperada),
      dentroDaTolerancia: false,
      valorAbaterCentavos: cents(esperada, valorUnitario),
      valorSobraCentavos: 0,
    };
  }

  const aceita = r4(input.quantidadeRecebida - input.quantidadeAvariada);
  const diferenca = r4(esperada - aceita);
  const falta = Math.max(0, diferenca);
  const sobra = Math.max(0, -diferenca);

  // avaria nunca entra na tolerância
  if (input.quantidadeAvariada > 0) {
    return {
      tipo: 'avaria',
      quantidadeAceita: aceita,
      diferenca,
      dentroDaTolerancia: false,
      valorAbaterCentavos: cents(falta, valorUnitario),
      valorSobraCentavos: cents(sobra, valorUnitario),
    };
  }

  if (diferenca === 0) {
    return { tipo: 'ok', quantidadeAceita: aceita, diferenca, dentroDaTolerancia: false, valorAbaterCentavos: 0, valorSobraCentavos: 0 };
  }

  const dentro =
    isWeightUnit(base.unidade) && esperada > 0 && Math.abs(diferenca) / esperada <= WEIGHT_TOLERANCE + EPS;
  if (dentro) {
    return { tipo: 'ok', quantidadeAceita: aceita, diferenca, dentroDaTolerancia: true, valorAbaterCentavos: 0, valorSobraCentavos: 0 };
  }

  return {
    tipo: diferenca > 0 ? 'falta' : 'sobra',
    quantidadeAceita: aceita,
    diferenca,
    dentroDaTolerancia: false,
    valorAbaterCentavos: cents(falta, valorUnitario),
    valorSobraCentavos: cents(sobra, valorUnitario),
  };
};

export interface ItemSummaryInput {
  tipo?: DivergenciaTipo;
  valorAbaterCentavos?: number;
  valorSobraCentavos?: number;
}

export const summarize = (itens: ItemSummaryInput[], valorNotaCentavos: number) => {
  const valorAbaterCentavos = itens.reduce((s, i) => s + (i.valorAbaterCentavos ?? 0), 0);
  const valorSobraCentavos = itens.reduce((s, i) => s + (i.valorSobraCentavos ?? 0), 0);
  return {
    valorNotaCentavos,
    valorAbaterCentavos,
    valorSobraCentavos,
    valorLiquidoCentavos: valorNotaCentavos - valorAbaterCentavos,
    itensComDivergencia: itens.filter((i) => i.tipo && i.tipo !== 'ok').length,
  };
};

/**
 * Resultado da conferência:
 * - recusada: todos os itens recusados
 * - recebida_parcial: pelo menos um item recusado (devolvido) e pelo menos um aceito
 * - com_divergencia: falta, sobra, avaria ou volumes diferentes
 * - conferida: tudo certo
 */
export const resultStatus = (itens: ItemSummaryInput[], volumesDivergentes: boolean): ConferenciaResultado => {
  const recusas = itens.filter((i) => i.tipo === 'recusa').length;
  if (itens.length > 0 && recusas === itens.length) return 'recusada';
  if (recusas > 0) return 'recebida_parcial';
  if (volumesDivergentes || itens.some((i) => i.tipo && i.tipo !== 'ok')) return 'com_divergencia';
  return 'conferida';
};
