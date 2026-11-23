/**
 * Controle de perecíveis (formulário FT-19) — funções puras.
 * Limites de temperatura copiados do próprio formulário; o responsável técnico deve validá-los.
 */
export const CATEGORIAS = ['congelado', 'resfriado', 'seco'] as const;
export const SUBCATEGORIAS = ['carne', 'pescado', 'outros'] as const;
export type Categoria = (typeof CATEGORIAS)[number];
export type Subcategoria = (typeof SUBCATEGORIAS)[number];
export type Condicao = 'C' | 'NC';

export interface Condicoes {
  rotulo: Condicao;
  produto: Condicao;
  transporte: Condicao;
  entregador: Condicao;
}

/** Limites máximos em °C: resfriados até o limite da subcategoria; congelados até -12 °C. */
export const LIMITES_C = {
  congelado: -12,
  resfriado: { carne: 7, pescado: 3, outros: 10 } as Record<Subcategoria, number>,
};

const ROTULOS: Record<keyof Condicoes, string> = {
  rotulo: 'rótulo',
  produto: 'produto/embalagem',
  transporte: 'transporte',
  entregador: 'entregador',
};

export interface PerecivelDados {
  categoria: Categoria;
  subcategoria?: Subcategoria;
  temperaturaC?: number;
  /** sobrescreve o limite padrão (ex.: "conforme especificação do fornecedor") */
  limiteMaxC?: number;
  lote?: string;
  sif?: string;
  fabricacao?: string; // AAAA-MM-DD
  validade?: string; // AAAA-MM-DD
  condicoes?: Condicoes;
}

export interface PerecivelAvaliacao {
  limiteC?: number;
  conformidade: 'conforme' | 'nao_conforme';
  motivos: string[];
  avisos: string[];
}

export const limiteFor = (d: Pick<PerecivelDados, 'categoria' | 'subcategoria' | 'limiteMaxC'>): number | undefined => {
  if (d.limiteMaxC !== undefined) return d.limiteMaxC;
  if (d.categoria === 'congelado') return LIMITES_C.congelado;
  if (d.categoria === 'resfriado') return LIMITES_C.resfriado[d.subcategoria ?? 'outros'];
  return undefined;
};

/** Data de hoje (AAAA-MM-DD) no fuso de Brasília. */
export const todayBR = (): string => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

export const evaluatePerishable = (d: PerecivelDados, hoje: string): PerecivelAvaliacao => {
  const motivos: string[] = [];
  const avisos: string[] = [];
  const limiteC = limiteFor(d);

  if (limiteC !== undefined && d.temperaturaC !== undefined && d.temperaturaC > limiteC) {
    motivos.push(`Temperatura ${d.temperaturaC} °C acima do limite de ${limiteC} °C`);
  }

  if (d.condicoes) {
    (Object.keys(ROTULOS) as (keyof Condicoes)[]).forEach((k) => {
      if (d.condicoes![k] === 'NC') motivos.push(`Condição não conforme: ${ROTULOS[k]}`);
    });
  }

  if (d.validade && d.validade < hoje) motivos.push(`Produto vencido (validade ${d.validade})`);
  if (d.fabricacao && d.fabricacao > hoje) motivos.push(`Data de fabricação no futuro (${d.fabricacao})`);

  if (d.categoria !== 'seco') {
    if (!d.lote) avisos.push('Lote não informado');
    if (!d.validade) avisos.push('Validade não informada');
  }

  return { limiteC, conformidade: motivos.length ? 'nao_conforme' : 'conforme', motivos, avisos };
};
