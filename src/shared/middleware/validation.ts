// src/shared/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

// ============================================================
// 1. VALIDATE BODY
// ============================================================
export function validateBody<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = await schema.parseAsync(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      // ✅ VERIFICAR se é ZodError antes de acessar errors
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Erro de validação',
          errors: error.issues.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        });
        return;
      }
      
      // ✅ Se não for ZodError, repassar para o próximo handler
      console.error('❌ [validateBody] Erro não-Zod:', error);
      next(error);
    }
  };
}

// ============================================================
// 2. VALIDATE QUERY
// ============================================================
export function validateQuery<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = await schema.parseAsync(req.query);
      (req as any).validatedQuery = validatedData;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Erro de validação nos parâmetros da query',
          errors: error.issues.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        });
        return;
      }
      console.error('❌ [validateQuery] Erro não-Zod:', error);
      next(error);
    }
  };
}

// ============================================================
// 3. VALIDATE PARAMS
// ============================================================
export function validateParams<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = await schema.parseAsync(req.params);
      Object.assign(req.params, validatedData);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Erro de validação nos parâmetros da URL',
          errors: error.issues.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        });
        return;
      }
      console.error('❌ [validateParams] Erro não-Zod:', error);
      next(error);
    }
  };
}

// ============================================================
// 4. VALIDATE REQUEST (combina body, query, params)
// ============================================================
interface ValidateRequestOptions<TBody = any, TQuery = any, TParams = any> {
  body?: ZodSchema<TBody>;
  query?: ZodSchema<TQuery>;
  params?: ZodSchema<TParams>;
}

export function validateRequest<TBody = any, TQuery = any, TParams = any>({
  body: bodySchema,
  query: querySchema,
  params: paramsSchema,
}: ValidateRequestOptions<TBody, TQuery, TParams>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors: any[] = [];

      // Validar body
      if (bodySchema) {
        try {
          const validated = await bodySchema.parseAsync(req.body);
          req.body = validated;
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...error.issues.map(e => ({
              location: 'body',
              path: e.path.join('.'),
              message: e.message,
              code: e.code,
            })));
          } else {
            console.error('❌ [validateRequest] Erro não-Zod no body:', error);
            throw error;
          }
        }
      }

      // Validar query
      if (querySchema) {
        try {
          const validated = await querySchema.parseAsync(req.query);
          (req as any).validatedQuery = validated;
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...error.issues.map(e => ({
              location: 'query',
              path: e.path.join('.'),
              message: e.message,
              code: e.code,
            })));
          } else {
            console.error('❌ [validateRequest] Erro não-Zod na query:', error);
            throw error;
          }
        }
      }

      // Validar params
      if (paramsSchema) {
        try {
          const validated = await paramsSchema.parseAsync(req.params);
          Object.assign(req.params, validated);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...error.issues.map(e => ({
              location: 'params',
              path: e.path.join('.'),
              message: e.message,
              code: e.code,
            })));
          } else {
            console.error('❌ [validateRequest] Erro não-Zod nos params:', error);
            throw error;
          }
        }
      }

      // Se houver erros, retornar
      if (errors.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Erro de validação',
          errors,
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// ============================================================
// 5. TIPOS ESTENDIDOS
// ============================================================
declare global {
  namespace Express {
    interface Request {
      validatedQuery?: any;
    }
  }
}