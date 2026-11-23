// Express 5 repassa erros de handlers async para o errorHandler: não precisa de try/catch.
import type { Request, Response } from 'express';

import { AppError } from '@/shared/utils/error';

import { UserService } from './user.service';
import {
  createUserSchema,
  idSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
  updateUserSchema,
} from './user.validation';

const userService = new UserService();

const send = (res: Response, status: number, data?: unknown, message?: string) =>
  res.status(status).json({
    success: true,
    ...(message ? { message } : {}),
    ...(data !== undefined ? { data } : {}),
    timestamp: new Date().toISOString(),
  });

const authUser = (req: Request) => {
  if (!req.user) throw new AppError('Usuário não autenticado', 401);
  return req.user;
};

// ---- públicas ----
export const register = async (req: Request, res: Response) => {
  const user = await userService.createUser(registerSchema.parse(req.body));
  send(res, 201, user, 'Usuário criado com sucesso');
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);
  send(res, 200, await userService.login(email, password), 'Login realizado com sucesso');
};

// ---- próprio usuário ----
export const profile = async (req: Request, res: Response) => {
  send(res, 200, await userService.getUserById(authUser(req).id));
};

export const updateProfile = async (req: Request, res: Response) => {
  const data = updateProfileSchema.parse(req.body);
  send(res, 200, await userService.updateProfile(authUser(req).id, data), 'Perfil atualizado com sucesso');
};

// ---- admin ----
export const create = async (req: Request, res: Response) => {
  send(res, 201, await userService.createUser(createUserSchema.parse(req.body)), 'Usuário criado com sucesso');
};

export const list = async (req: Request, res: Response) => {
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 100);
  send(res, 200, await userService.getUsers(page, limit));
};

export const getById = async (req: Request, res: Response) => {
  const { id } = idSchema.parse(req.params);
  send(res, 200, await userService.getUserById(id));
};

export const update = async (req: Request, res: Response) => {
  const { id } = idSchema.parse(req.params);
  const data = updateUserSchema.parse(req.body);
  send(res, 200, await userService.updateUser(id, data), 'Usuário atualizado com sucesso');
};

export const remove = async (req: Request, res: Response) => {
  const { id } = idSchema.parse(req.params);
  await userService.deleteUser(id);
  res.status(204).send();
};
