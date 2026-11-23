// src/shared/middleware/auth.ts
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { User, type IUser } from '@/api/v1/users/user.model';
import { env } from '@/shared/config/env';
import { ForbiddenError, UnauthorizedError } from '@/shared/utils/error';
import { logger } from '@/shared/utils/logger';

type AuthUserDoc = Pick<IUser, '_id' | 'email' | 'role' | 'isActive' | 'companyId'>;

// =========================================
// Helpers
// =========================================

function extractToken(req: Request): string {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedError('Token não fornecido ou formato inválido');
  }
  return token;
}

function verifyToken(token: string): { id: string } {
  try {
    // algorithms fixo: evita aceitar "none"/algoritmo inesperado
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || typeof decoded.id !== 'string') {
      throw new UnauthorizedError('Token inválido');
    }
    return { id: decoded.id };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    // TokenExpiredError herda de JsonWebTokenError: precisa ser checado ANTES
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token expirado. Faça login novamente.');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Token inválido');
    }
    throw error;
  }
}

async function findUser(id: string): Promise<AuthUserDoc> {
  const user = await User.findById(id)
    .select('email role isActive companyId')
    .lean<AuthUserDoc>();
  if (!user) throw new UnauthorizedError('Usuário não encontrado');
  return user;
}

/** Dados do usuário (sempre do banco, não do token) que vão para req.user. */
const toReqUser = (user: AuthUserDoc) => ({
  id: user._id.toString(),
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  companyId: user.companyId?.toString(),
});

async function authenticate(req: Request, { requireActive }: { requireActive: boolean }) {
  const { id } = verifyToken(extractToken(req));
  const user = await findUser(id);

  if (requireActive && !user.isActive) {
    throw new UnauthorizedError('Conta inativa. Entre em contato com o suporte.');
  }

  req.user = toReqUser(user);
}

// =========================================
// 1. Token + usuário ativo
// =========================================
export const authMiddleware = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    await authenticate(req, { requireActive: true });
    next();
  } catch (error) {
    // AppError (401/403) segue como está; falha inesperada (ex.: banco fora) vira 500, não 401
    if (!(error instanceof UnauthorizedError || error instanceof ForbiddenError)) {
      logger.error({ err: error }, 'Falha inesperada na autenticação');
    }
    next(error);
  }
};

// =========================================
// 2. Só token (não exige usuário ativo)
// =========================================
export const authMiddlewareBasic = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    await authenticate(req, { requireActive: false });
    next();
  } catch (error) {
    next(error);
  }
};

// =========================================
// 3. Roles
// =========================================
export const requireRole = (roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError('Usuário não autenticado');
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError('Acesso negado para o seu perfil');
    }
    next();
  };
};

// =========================================
// 4. Dono do recurso ou admin
// =========================================
export const isOwnerOrAdmin = (resourceIdParam: string = 'id') => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError('Usuário não autenticado');
    if (req.user.role === 'admin' || req.user.id === req.params[resourceIdParam]) {
      return next();
    }
    throw new ForbiddenError('Você não tem permissão para acessar este recurso');
  };
};

// =========================================
// 5. Auth opcional (segue anônimo se o token faltar/for inválido)
// =========================================
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    try {
      await authenticate(req, { requireActive: true });
    } catch {
      // token inválido/usuário inativo: continua como anônimo
    }
  }
  next();
};

export { authMiddleware as auth };
