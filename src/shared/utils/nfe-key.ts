/**
 * Utilitários da chave de acesso da NF-e (modelo 55) — sem dependências.
 *
 * Layout (44 posições):
 *   cUF(2) AAMM(4) CNPJ(14) mod(2) série(3) nNF(9) tpEmis(1) cNF(8) cDV(1)
 *
 * NT Conjunta 2025.001: as 12 primeiras posições do CNPJ podem ter letras (A-Z)
 * (regex da chave: [0-9]{6}[A-Z0-9]{12}[0-9]{26}). O DV da chave e o do CNPJ
 * usam módulo 11 sobre (código ASCII - 48) de cada caractere.
 */

export class NfeKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NfeKeyError';
  }
}

export interface NfeKeyData {
  chave: string;
  ufCodigo: string;
  uf: string;
  ano: number;
  mes: number;
  cnpjEmitente: string;
  modelo: string;
  serie: number;
  numero: number;
  tipoEmissao: number;
  codigoNumerico: string;
  dv: number;
}

const UF_BY_CODE: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
  '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR',
  '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};

const KEY_REGEX = /^[0-9]{6}[A-Z0-9]{12}[0-9]{26}$/;
const CNPJ_REGEX = /^[A-Z0-9]{12}[0-9]{2}$/;

/** Remove espaços, pontos, hifens e o prefixo "NFe" do atributo Id do XML. */
export const normalizeNfeKey = (raw: string): string =>
  raw.toUpperCase().replace(/[\s.\-]/g, '').replace(/^NFE/, '');

/** Mantém só letras e números (aceita CNPJ formatado: 11.906.445/0001-51). */
export const normalizeCnpj = (raw: string): string => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Módulo 11, pesos 2..9 da direita para a esquerda, valor = ASCII - 48. */
export const calcMod11Dv = (value: string): number => {
  let weight = 2;
  let sum = 0;
  for (let i = value.length - 1; i >= 0; i--) {
    sum += (value.charCodeAt(i) - 48) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
};

export const isValidCnpj = (raw: string): boolean => {
  const cnpj = normalizeCnpj(raw);
  if (!CNPJ_REGEX.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false;
  const base = cnpj.slice(0, 12);
  const d1 = calcMod11Dv(base);
  const d2 = calcMod11Dv(`${base}${d1}`);
  return cnpj.slice(12) === `${d1}${d2}`;
};

export const parseNfeKey = (raw: string): NfeKeyData => {
  const chave = normalizeNfeKey(raw);

  if (chave.length !== 44) {
    throw new NfeKeyError(`Chave de acesso deve ter 44 caracteres (recebido: ${chave.length})`);
  }
  if (!KEY_REGEX.test(chave)) {
    throw new NfeKeyError('Chave de acesso contém caracteres inválidos');
  }

  const dv = Number(chave[43]);
  if (calcMod11Dv(chave.slice(0, 43)) !== dv) {
    throw new NfeKeyError('Dígito verificador da chave de acesso inválido');
  }

  const ufCodigo = chave.slice(0, 2);
  const uf = UF_BY_CODE[ufCodigo];
  if (!uf) throw new NfeKeyError(`Código de UF inválido na chave: ${ufCodigo}`);

  const mes = Number(chave.slice(4, 6));
  if (mes < 1 || mes > 12) throw new NfeKeyError(`Mês inválido na chave: ${chave.slice(4, 6)}`);

  const cnpjEmitente = chave.slice(6, 20);
  if (!isValidCnpj(cnpjEmitente)) throw new NfeKeyError('CNPJ do emitente na chave é inválido');

  const modelo = chave.slice(20, 22);
  if (modelo !== '55') {
    throw new NfeKeyError(`Modelo ${modelo} não suportado (apenas NF-e modelo 55)`);
  }

  return {
    chave,
    ufCodigo,
    uf,
    ano: 2000 + Number(chave.slice(2, 4)),
    mes,
    cnpjEmitente,
    modelo,
    serie: Number(chave.slice(22, 25)),
    numero: Number(chave.slice(25, 34)),
    tipoEmissao: Number(chave[34]),
    codigoNumerico: chave.slice(35, 43),
    dv,
  };
};

/** "3526 1011 9064 ..." — formato de exibição igual ao do DANFE. */
export const formatNfeKey = (chave: string): string => chave.replace(/(.{4})/g, '$1 ').trim();
