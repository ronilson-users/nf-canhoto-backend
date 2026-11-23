/**
 * Copyright (c) [2025] [RSj-roni]
 * Filename: error.ts
 * Centralized custom error definitions for RESTful APIs
 */

// ============================================
// 1. CLASSE BASE - Deve vir primeiro
// ============================================
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode: number = 400,
    code?: string,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ============================================
// 2. ERROS ESPECÍFICOS - Depois da classe base
// ============================================

/**
 * 400 – Requisição inválida
 */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

/**
 * 401 – Não autenticado
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

/**
 * 403 – Sem permissão
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

/**
 * 404 – Recurso não encontrado
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

/**
 * 409 – Conflito de estado (ex: duplicado)
 */
export class ConflictError extends AppError {
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

/**
 * 422 – Erro de validação semântico
 */
export class ValidationError extends AppError {
  public readonly details?: any;

  constructor(message = 'Validation failed', details?: any) {
    super(message, 422, 'VALIDATION_ERROR');
    this.details = details;
  }
}

/**
 * 500 – Erro interno
 */
export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', code = 'INTERNAL_SERVER_ERROR') {
    super(message, 500, code, false);
  }
}

// ============================================
// 3. (Opcional) Exportação conveniente
// ============================================
export const ErrorTypes = {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  InternalServerError,
};