import { describe, expect, it } from 'vitest';
import { detectImageType } from '../shared/utils/image-type';
import { evaluatePerishable, limiteFor } from '../api/v1/receiving/receiving.perishable';
import { resultStatus } from '../api/v1/receiving/receiving.calc';

const HOJE = '2026-10-22';
const ok = { rotulo: 'C', produto: 'C', transporte: 'C', entregador: 'C' } as const;

describe('evaluatePerishable (limites do FT-19)', () => {
  it('congelado: -12 °C ou menos é conforme', () => {
    expect(evaluatePerishable({ categoria: 'congelado', temperaturaC: -15, condicoes: ok }, HOJE).conformidade).toBe('conforme');
    expect(evaluatePerishable({ categoria: 'congelado', temperaturaC: -12, condicoes: ok }, HOJE).conformidade).toBe('conforme');
  });

  it('congelado acima de -12 °C não é conforme', () => {
    const r = evaluatePerishable({ categoria: 'congelado', temperaturaC: -8, condicoes: ok }, HOJE);
    expect(r.conformidade).toBe('nao_conforme');
    expect(r.motivos[0]).toContain('-8 °C acima do limite de -12 °C');
  });

  it('resfriado: carne 7, pescado 3, outros 10', () => {
    expect(limiteFor({ categoria: 'resfriado', subcategoria: 'carne' })).toBe(7);
    expect(limiteFor({ categoria: 'resfriado', subcategoria: 'pescado' })).toBe(3);
    expect(limiteFor({ categoria: 'resfriado', subcategoria: 'outros' })).toBe(10);
    expect(evaluatePerishable({ categoria: 'resfriado', subcategoria: 'carne', temperaturaC: 7, condicoes: ok }, HOJE).conformidade).toBe('conforme');
    expect(evaluatePerishable({ categoria: 'resfriado', subcategoria: 'carne', temperaturaC: 7.1, condicoes: ok }, HOJE).conformidade).toBe('nao_conforme');
  });

  it('limite do fornecedor sobrescreve o padrão', () => {
    expect(evaluatePerishable({ categoria: 'congelado', temperaturaC: -9, limiteMaxC: -8, condicoes: ok }, HOJE).conformidade).toBe('conforme');
  });

  it('condição NC torna o item não conforme', () => {
    const r = evaluatePerishable({ categoria: 'congelado', temperaturaC: -15, condicoes: { ...ok, transporte: 'NC' } }, HOJE);
    expect(r.conformidade).toBe('nao_conforme');
    expect(r.motivos).toEqual(['Condição não conforme: transporte']);
  });

  it('vencido não é conforme; validade de hoje é', () => {
    expect(evaluatePerishable({ categoria: 'seco', validade: '2026-10-21' }, HOJE).conformidade).toBe('nao_conforme');
    expect(evaluatePerishable({ categoria: 'seco', validade: '2026-10-22' }, HOJE).conformidade).toBe('conforme');
  });

  it('seco não exige temperatura; perecível sem lote gera aviso', () => {
    expect(evaluatePerishable({ categoria: 'seco' }, HOJE).conformidade).toBe('conforme');
    expect(evaluatePerishable({ categoria: 'congelado', temperaturaC: -15, condicoes: ok }, HOJE).avisos).toEqual(['Lote não informado', 'Validade não informada']);
  });
});

describe('resultStatus com devolução parcial', () => {
  it('um item recusado entre aceitos = recebida_parcial', () => {
    expect(resultStatus([{ tipo: 'ok' }, { tipo: 'recusa' }], false)).toBe('recebida_parcial');
    expect(resultStatus([{ tipo: 'falta' }, { tipo: 'recusa' }, { tipo: 'avaria' }], false)).toBe('recebida_parcial');
  });
  it('todos recusados = recusada; avaria sem recusa = com_divergencia', () => {
    expect(resultStatus([{ tipo: 'recusa' }, { tipo: 'recusa' }], false)).toBe('recusada');
    expect(resultStatus([{ tipo: 'ok' }, { tipo: 'avaria' }], false)).toBe('com_divergencia');
    expect(resultStatus([{ tipo: 'ok' }], false)).toBe('conferida');
  });
});

describe('detectImageType', () => {
  const pad = (bytes: number[]) => Uint8Array.from([...bytes, ...new Array(16).fill(0)]);
  it('reconhece JPEG, PNG e WebP pelos bytes', () => {
    expect(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe('jpg');
    expect(detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe('png');
    const webp = pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(detectImageType(webp)?.mime).toBe('image/webp');
  });
  it('rejeita texto com extensão .jpg e arquivos curtos', () => {
    expect(detectImageType(new TextEncoder().encode('isso nao e uma imagem de verdade'))).toBe(null);
    expect(detectImageType(Uint8Array.from([0xff, 0xd8]))).toBe(null);
  });
});
