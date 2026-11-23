// src/shared/middleware/errorHandler.ts
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { env } from '@/shared/config/env';
import { AppError } from '@/shared/utils/error';
import { logger } from '@/shared/utils/logger';

/** Erros "soltos" que chegam aqui: mongoose, jsonwebtoken, body-parser, multer... */
interface RawError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  code?: string | number;
  keyValue?: Record<string, unknown>;
  errors?: Record<string, { path?: string; message?: string }>;
}

interface ErrorBody {
  statusCode: number;
  message: string;
  code: string;
  details: unknown;
}

const isClientStatus = (n: unknown): n is number => typeof n === 'number' && n >= 400 && n < 500;

function normalize(error: RawError): ErrorBody {
  // 1) Nossos erros
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
      code: error.code ?? 'APP_ERROR', // AppError "puro" não tem code
      details: (error as { details?: unknown }).details ?? null,
    };
  }

  // 2) Zod (funciona em zod 3 e 4: usa .issues)
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      message: 'Validation Failed',
      code: 'VALIDATION_ERROR',
      details: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    };
  }

  // 3) Mongoose
  if (error.name === 'ValidationError' && error.errors) {
    return {
      statusCode: 400,
      message: 'Validation Failed',
      code: 'VALIDATION_ERROR',
      details: Object.values(error.errors).map((e) => ({ field: e.path, message: e.message })),
    };
  }
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue ?? {})[0] ?? 'campo';
    return {
      statusCode: 409,
      message: 'Duplicate key error',
      code: 'DUPLICATE_KEY',
      details: [{ field, message: `${field} already exists` }],
    };
  }
  if (error.name === 'VersionError') {
    return {
      statusCode: 409,
      message: 'O registro foi alterado por outra requisição. Recarregue e tente novamente.',
      code: 'CONCURRENT_UPDATE',
      details: null,
    };
  }
  if (error.name === 'CastError') {
    return { statusCode: 400, message: 'Invalid ID format', code: 'INVALID_ID', details: null };
  }

  // 4) JWT (caso escape do middleware)
  if (error.name === 'TokenExpiredError') {
    return { statusCode: 401, message: 'Token expired', code: 'TOKEN_EXPIRED', details: null };
  }
  if (error.name === 'JsonWebTokenError') {
    return { statusCode: 401, message: 'Invalid token', code: 'INVALID_TOKEN', details: null };
  }

  // 5) Erros 4xx do próprio Express/body-parser (JSON malformado, payload grande...)
  if (error.type === 'entity.parse.failed') {
    return { statusCode: 400, message: 'JSON inválido no corpo da requisição', code: 'INVALID_JSON', details: null };
  }
  if (error.type === 'entity.too.large') {
    return { statusCode: 413, message: 'Corpo da requisição muito grande', code: 'PAYLOAD_TOO_LARGE', details: null };
  }
  const httpStatus = error.status ?? error.statusCode;
  if (isClientStatus(httpStatus)) {
    return { statusCode: httpStatus, message: 'Requisição inválida', code: 'BAD_REQUEST', details: null };
  }

  // 6) Qualquer outra coisa: 500 sem vazar detalhes
  return { statusCode: 500, message: 'Internal Server Error', code: 'INTERNAL_ERROR', details: null };
}

export const errorHandler = (error: RawError, req: Request, res: Response, next: NextFunction): void => {
  // resposta já começou (ex.: erro no meio de um stream): deixa o Express encerrar
  if (res.headersSent) return next(error);

  const { statusCode, message, code, details } = normalize(error);

  if (statusCode >= 500) {
    logger.error({ err: error, method: req.method, url: req.originalUrl }, 'Erro não tratado');
  } else {
    logger.warn({ code, statusCode, method: req.method, url: req.originalUrl }, message);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    code,
    ...(details ? { details } : {}),
    ...(env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
  });
};
