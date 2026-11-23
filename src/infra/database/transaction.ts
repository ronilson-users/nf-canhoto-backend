// src/infra/database/transaction.ts
import mongoose from 'mongoose';

import { env } from '@/shared/config/env';
import { logger } from '@/shared/utils/logger';

// Com isso, todas as operações do Mongoose feitas dentro do callback de withTransaction
// usam a mesma sessão automaticamente (não é preciso repassar `session` nos repositórios).
// Requer Mongoose >= 8.4. Idempotente: pode ser chamado também em connection.ts, antes de conectar.
mongoose.set('transactionAsyncLocalStorage', true);

const unsupported = (error: unknown) =>
  /Transaction numbers are only allowed on a replica set/i.test((error as Error)?.message ?? '');

/**
 * Executa `fn` em transação. Conflitos transitórios (write conflict) são repetidos
 * automaticamente pelo driver, então `fn` deve poder rodar mais de uma vez
 * (nada de efeitos externos, como e-mail, dentro dela).
 *
 * Mongo standalone (comum em dev) não suporta transações: fora de produção roda sem
 * transação, com aviso. Em produção falha, para não perder a garantia sem ninguém notar.
 */
export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await mongoose.connection.transaction(fn);
  } catch (error) {
    if (unsupported(error) && env.NODE_ENV !== 'production') {
      logger.warn('MongoDB sem suporte a transações (precisa de replica set): executando sem transação');
      return fn();
    }
    throw error;
  }
}
