//src/shared/utils/logger.ts
import pino from 'pino';
import pinoHttp from 'pino-http';
import { Request, Response } from 'express';  

/**
 * 🧭 Configuração principal do logger Pino
 */
export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
  level: 'info',
});

/**
 * 🚦 Middleware para logar requisições HTTP
 */
export const httpLogger = pinoHttp({
  logger,
  customSuccessMessage: function (req: Request, res: Response) {
    // ✅ CORRIGIDO - template string completa
    return `✅ ${req.method} ${req.url} → ${res.statusCode}`;
  },
  customErrorMessage: function (req: Request, res: Response, err: Error) {
    // ✅ CORRIGIDO - template string completa  
    return `❌ ${req.method} ${req.url} → ${res.statusCode} | ${err.message}`;
  },
  autoLogging: true,
});