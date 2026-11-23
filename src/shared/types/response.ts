// // src/shared/types/response.ts
// export interface ApiResponse<T = any> {
//   success: boolean;
//   message?: string;
//   data?: T;
//   error?: string;
//   code?: string;
//   timestamp?: string;
// }

// export interface PaginatedResponse<T> {
//   data: T[];
//   pagination: {
//     page: number;
//     limit: number;
//     total: number;
//     totalPages: number;
//   };
// }

// export class ResponseFormatter {
//   static success<T>(data: T, message = 'Operação realizada com sucesso'): ApiResponse<T> {
//     return {
//       success: true,
//       message,
//       data,
//       timestamp: new Date().toISOString(),
//     };
//   }

//   static paginated<T>(data: T[], pagination: any, message = 'Dados listados com sucesso'): ApiResponse<PaginatedResponse<T>> {
//     return {
//       success: true,
//       message,
//       data: {
//         data,
//         pagination,
//       },
//       timestamp: new Date().toISOString(),
//     };
//   }

//   static error(error: string, code = 'ERROR', details?: any): ApiResponse {
//     return {
//       success: false,
//       error,
//       code,
//       ...(details && { details }),
//       timestamp: new Date().toISOString(),
//     };
//   }
// }

// src/shared/types/response.ts
import { Response } from 'express';

export interface ApiResponseData<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode?: number;
  timestamp?: string;
  path?: string;
}

export class ApiResponse {
  /**
   * Resposta de sucesso
   */
  static success<T>(
    res: Response,
    data: T,
    statusCode: number = 200,
    message?: string
  ): Response {
    const response: ApiResponseData<T> = {
      success: true,
      data,
      message: message || 'Operação realizada com sucesso',
      statusCode,
      timestamp: new Date().toISOString(),
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Resposta de sucesso com paginação
   */
  static successWithPagination<T>(
    res: Response,
    data: T,
    pagination: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    },
    statusCode: number = 200
  ): Response {
    const response = {
      success: true,
      data,
      pagination,
      statusCode,
      timestamp: new Date().toISOString(),
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Resposta de erro
   */
  static error(
    res: Response,
    error: string | Error,
    statusCode: number = 400,
    details?: any
  ): Response {
    const message = typeof error === 'string' ? error : error.message;
    
    const response: ApiResponseData = {
      success: false,
      error: message,
      statusCode,
      timestamp: new Date().toISOString(),
    };

    if (details) {
      (response as any).details = details;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Resposta de criação (201)
   */
  static created<T>(
    res: Response,
    data: T,
    message: string = 'Recurso criado com sucesso'
  ): Response {
    return this.success(res, data, 201, message);
  }

  /**
   * Resposta de atualização (200)
   */
  static updated<T>(
    res: Response,
    data: T,
    message: string = 'Recurso atualizado com sucesso'
  ): Response {
    return this.success(res, data, 200, message);
  }

  /**
   * Resposta de exclusão (204 - sem conteúdo)
   */
  static deleted(
    res: Response,
    message: string = 'Recurso deletado com sucesso'
  ): Response {
    return res.status(204).json({
      success: true,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Resposta de não autorizado (401)
   */
  static unauthorized(
    res: Response,
    message: string = 'Não autorizado'
  ): Response {
    return this.error(res, message, 401);
  }

  /**
   * Resposta de proibido (403)
   */
  static forbidden(
    res: Response,
    message: string = 'Acesso negado'
  ): Response {
    return this.error(res, message, 403);
  }

  /**
   * Resposta de não encontrado (404)
   */
  static notFound(
    res: Response,
    message: string = 'Recurso não encontrado'
  ): Response {
    return this.error(res, message, 404);
  }

  /**
   * Resposta de conflito (409)
   */
  static conflict(
    res: Response,
    message: string = 'Conflito de dados'
  ): Response {
    return this.error(res, message, 409);
  }

  /**
   * Resposta de validação (422)
   */
  static validationError(
    res: Response,
    message: string = 'Erro de validação',
    details?: any
  ): Response {
    return this.error(res, message, 422, details);
  }
}

// Também exportamos uma função helper para uso mais simples
export const response = {
  success: ApiResponse.success.bind(ApiResponse),
  successWithPagination: ApiResponse.successWithPagination.bind(ApiResponse),
  error: ApiResponse.error.bind(ApiResponse),
  created: ApiResponse.created.bind(ApiResponse),
  updated: ApiResponse.updated.bind(ApiResponse),
  deleted: ApiResponse.deleted.bind(ApiResponse),
  unauthorized: ApiResponse.unauthorized.bind(ApiResponse),
  forbidden: ApiResponse.forbidden.bind(ApiResponse),
  notFound: ApiResponse.notFound.bind(ApiResponse),
  conflict: ApiResponse.conflict.bind(ApiResponse),
  validationError: ApiResponse.validationError.bind(ApiResponse),
};