// Express 5 repassa erros de handlers async para o errorHandler: não precisa de try/catch.
//
// A validação (body e :id) acontece no router via validateBody/validateParams, que já
// substituem req.body pelo dado validado. Aqui só tipamos esse dado.
import type { Request, Response } from 'express';

import { AppError, ForbiddenError } from '@/shared/utils/error';

import { UserService } from './user.service';
import type {
  CreateUserInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
  UpdateUserInput,
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

const idParam = (req: Request) => req.params.id as string;

// ---- públicas ----
export const register = async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body as RegisterInput);
  send(res, 201, user, 'Usuário criado com sucesso');
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginInput;
  send(res, 200, await userService.login(email, password), 'Login realizado com sucesso');
};

// ---- próprio usuário ----
export const profile = async (req: Request, res: Response) => {
  send(res, 200, await userService.getUserById(authUser(req).id));
};

export const updateProfile = async (req: Request, res: Response) => {
  const data = req.body as UpdateProfileInput;
  send(res, 200, await userService.updateProfile(authUser(req).id, data), 'Perfil atualizado com sucesso');
};

// ---- admin ----
export const create = async (req: Request, res: Response) => {
  send(res, 201, await userService.createUser(req.body as CreateUserInput), 'Usuário criado com sucesso');
};

export const list = async (req: Request, res: Response) => {
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 100);
  send(res, 200, await userService.getUsers(page, limit));
};

export const getById = async (req: Request, res: Response) => {
  send(res, 200, await userService.getUserById(idParam(req)));
};

export const update = async (req: Request, res: Response) => {
  const id = idParam(req);
  const data = req.body as UpdateUserInput;

  // Evita o admin se trancar para fora do sistema.
  const demotes = data.isActive === false || (data.role !== undefined && data.role !== 'admin');
  if (id === authUser(req).id && demotes) {
    throw new ForbiddenError('Você não pode rebaixar ou desativar a própria conta');
  }

  send(res, 200, await userService.updateUser(id, data), 'Usuário atualizado com sucesso');
};

export const remove = async (req: Request, res: Response) => {
  const id = idParam(req);
  if (id === authUser(req).id) {
    throw new ForbiddenError('Você não pode desativar a própria conta');
  }
  await userService.deleteUser(id);
  res.status(204).send();
};
