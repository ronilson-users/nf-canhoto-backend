// src/shared/exceptions/NotFoundError.ts

export class NotFoundError extends Error {
  constructor(message: string = 'Recurso não encontrado') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }

  statusCode: number;
}