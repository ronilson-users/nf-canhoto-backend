import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NfeXmlError } from '../shared/utils/nfe-xml';
import { parseNfeXml } from '../shared/utils/nfe-xml-parser';

const xml = readFileSync(fileURLToPath(new URL('./fixtures/nfe-exemplo.xml', import.meta.url)), 'utf8');

describe('parseNfeXml', () => {
  it('lê itens, totais, transporte, duplicata e protocolo', () => {
    const nfe = parseNfeXml(xml);
    expect(nfe.chave).toBe('35261011906445000151550010008832041101671813');
    expect(nfe.itens).toHaveLength(5);
    expect(nfe.totais).toMatchObject({ produtos: 464.46, nota: 464.46, baseIcms: 297.59, icms: 48.51 });
    expect(nfe.transporte).toMatchObject({ placa: 'FEF2G31', volumes: 22, pesoLiquido: 30.4 });
    expect(nfe.duplicatas).toEqual([{ numero: '001', vencimento: '2026-11-04', valor: 464.46 }]);
    expect(nfe.extras).toEqual({ pedido: '114588', roteiro: '8073', motorista: 'DIEGO DE OLIVEIRA' });
    expect(nfe.autorizada).toBe(true);
    expect(nfe.avisos).toEqual([]);
  });

  it('mantém zeros à esquerda do CNPJ do destinatário', () => {
    expect(parseNfeXml(xml).destinatario.documento).toBe('07247975000168');
  });

  it('rejeita NF-e cancelada (cStat 101) com status 422', () => {
    const cancelada = xml.replace('<cStat>100</cStat>', '<cStat>101</cStat>');
    expect(() => parseNfeXml(cancelada)).toThrow(NfeXmlError);
    try { parseNfeXml(cancelada); } catch (e) { expect((e as NfeXmlError).statusCode).toBe(422); }
  });

  it('rejeita DOCTYPE/ENTITY e XML que não é NF-e', () => {
    expect(() => parseNfeXml('<!DOCTYPE x [<!ENTITY a "b">]><x/>')).toThrow(/DOCTYPE/);
    expect(() => parseNfeXml('<foo><bar/></foo>')).toThrow(/infNFe/);
  });
});
