import { describe, expect, it } from 'vitest';
import { evaluateItem, resultStatus, summarize } from '../api/v1/receiving/receiving.calc';

const kg = (esperada: number, unit: number) => ({ unidade: 'KG', quantidadeEsperada: esperada, valorUnitario: unit });
const un = (esperada: number, unit: number) => ({ unidade: 'UN', quantidadeEsperada: esperada, valorUnitario: unit });
const rec = (q: number, avariada = 0, recusado = false) => ({ quantidadeRecebida: q, quantidadeAvariada: avariada, recusado });

describe('evaluateItem (itens da NF 883204)', () => {
  it('KG dentro de 2% é ok, sem abatimento', () => {
    const r = evaluateItem(kg(3.5, 19.8), rec(3.45));
    expect(r).toMatchObject({ tipo: 'ok', dentroDaTolerancia: true, valorAbaterCentavos: 0 });
  });

  it('KG acima de 2% é falta e abate o valor', () => {
    expect(evaluateItem(kg(3.5, 19.8), rec(3.3))).toMatchObject({ tipo: 'falta', valorAbaterCentavos: 396 });
  });

  it('UN não tem tolerância: 1 a menos é falta', () => {
    expect(evaluateItem(un(6, 17.51), rec(5))).toMatchObject({ tipo: 'falta', valorAbaterCentavos: 1751 });
  });

  it('sobra não abate, só registra', () => {
    expect(evaluateItem(kg(4.5, 16.71), rec(4.8))).toMatchObject({ tipo: 'sobra', valorAbaterCentavos: 0, valorSobraCentavos: 501 });
  });

  it('avaria desconta o avariado', () => {
    expect(evaluateItem(un(6, 23.5), rec(6, 1))).toMatchObject({ tipo: 'avaria', quantidadeAceita: 5, valorAbaterCentavos: 2350 });
  });

  it('recusa abate o item inteiro', () => {
    expect(evaluateItem(kg(2, 36.95), rec(0, 0, true))).toMatchObject({ tipo: 'recusa', valorAbaterCentavos: 7390 });
  });
});

describe('summarize / resultStatus', () => {
  const itens = [
    { tipo: 'ok' as const },
    { tipo: 'sobra' as const, valorSobraCentavos: 501 },
    { tipo: 'falta' as const, valorAbaterCentavos: 1751 },
    { tipo: 'avaria' as const, valorAbaterCentavos: 2350 },
    { tipo: 'recusa' as const, valorAbaterCentavos: 7390 },
  ];

  it('totaliza em centavos', () => {
    expect(summarize(itens, 46446)).toEqual({
      valorNotaCentavos: 46446, valorAbaterCentavos: 11491, valorSobraCentavos: 501,
      valorLiquidoCentavos: 34955, itensComDivergencia: 4,
    });
  });

  it('define o resultado', () => {
    expect(resultStatus([{ tipo: 'ok' }], false)).toBe('conferida');
    expect(resultStatus([{ tipo: 'ok' }], true)).toBe('com_divergencia');
    expect(resultStatus(itens, false)).toBe('recebida_parcial');
    expect(resultStatus([{ tipo: 'recusa' }, { tipo: 'recusa' }], false)).toBe('recusada');
  });
});
