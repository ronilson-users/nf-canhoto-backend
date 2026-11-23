// src/shared/utils/validateEnv.ts
import {
  env
} from '../config/env'; // ← CORRIGIDO: caminho relativo correto
import {
  logger
} from './logger';

export const validateEnv = (): void => {
  try {
    // O env já está validado pelo Zod no arquivo env.ts
    // Mas podemos adicionar verificações adicionais aqui

    if (env.NODE_ENV === 'production' && env.CORS_ORIGIN === '*') {
      logger.warn('⚠️ CORS is configured with wildcard (*) in production');
    }

    if (env.NODE_ENV === 'production' && env.JWT_SECRET.length < 32) {
      logger.warn('⚠️ JWT_SECRET should be at least 32 characters long in production');
    }

    logger.info(`✅ Environment validated: ${env.NODE_ENV} mode`);
    logger.info(`   Port: ${env.PORT}`);
    logger.info(`   MongoDB: ${env.MONGODB_URI ? '✅ Configured': '❌ Not configured'}`);

  } catch (error) {
logger.error({ err: error }, '❌ Environment validation failed:');    throw error;
  }
};