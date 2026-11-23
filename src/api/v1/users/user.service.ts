import jwt, { type SignOptions } from 'jsonwebtoken';
import { Types } from 'mongoose';

import { env } from '@/shared/config/env';
import { AppError, ConflictError, NotFoundError } from '@/shared/utils/error';

import type { IUser } from './user.model';
import { UserRepository } from './user.repository';
import type { JwtPayload, LoginResponse, PaginatedUsers, UserResponse } from './user.types';
import type { CreateUserInput, UpdateProfileInput, UpdateUserInput } from './user.validation';

type UserLike = Pick<
  IUser,
  '_id' | 'name' | 'email' | 'role' | 'companyId' | 'isActive' | 'createdAt' | 'updatedAt'
>;

/** Único ponto que decide o formato público do usuário (sempre `id`, nunca `password`). */
const toUserResponse = (u: UserLike): UserResponse => ({
  id: u._id.toString(),
  name: u.name,
  email: u.email,
  role: u.role,
  companyId: u.companyId?.toString(),
  isActive: u.isActive,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

const isDuplicateKeyError = (
  e: unknown,
): e is { code: number; keyPattern?: Record<string, unknown> } =>
  typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 11000;

/** Corrida entre dois cadastros com o mesmo e-mail: o índice único é a última defesa. */
const rethrowDuplicate = (error: unknown): never => {
  if (isDuplicateKeyError(error)) {
    const field = Object.keys(error.keyPattern ?? {})[0] ?? 'campo';
    throw new ConflictError(`${field} já cadastrado`);
  }
  throw error;
};

/** Remove chaves undefined (evita sobrescrever campos sem querer). */
const compact = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

/** Input (companyId string) -> dados do model (companyId ObjectId). */
const toUserData = (input: CreateUserInput | UpdateUserInput): Partial<IUser> => {
  const { companyId, ...rest } = input;
  return compact({
    ...rest,
    companyId: companyId ? new Types.ObjectId(companyId) : undefined,
  }) as Partial<IUser>;
};

export class UserService {
  private userRepository = new UserRepository();

  private async findOrFail(id: string): Promise<IUser> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundError('Usuário não encontrado');
    return user;
  }

  async createUser(data: CreateUserInput): Promise<UserResponse> {
    if (await this.userRepository.existsByEmail(data.email)) {
      throw new ConflictError('Email já cadastrado');
    }
    try {
      return toUserResponse(await this.userRepository.create(toUserData(data)));
    } catch (error) {
      return rethrowDuplicate(error);
    }
  }

  async getUsers(page = 1, limit = 10): Promise<PaginatedUsers> {
    const { users, pagination } = await this.userRepository.findAll(page, limit);
    return { users: users.map(toUserResponse), pagination };
  }

  async getUserById(id: string): Promise<UserResponse> {
    return toUserResponse(await this.findOrFail(id));
  }

  /** Edição administrativa. */
  async updateUser(id: string, data: UpdateUserInput): Promise<UserResponse> {
    const user = await this.findOrFail(id);

    if (
      data.email &&
      data.email !== user.email &&
      (await this.userRepository.existsByEmail(data.email))
    ) {
      throw new ConflictError('Email já cadastrado por outro usuário');
    }

    try {
      const updated = await this.userRepository.update(id, toUserData(data));
      if (!updated) throw new AppError('Erro ao atualizar usuário', 500);
      return toUserResponse(updated);
    } catch (error) {
      return rethrowDuplicate(error);
    }
  }

  /** Auto-edição: só nome e e-mail, mesmo que o chamador envie mais campos. */
  async updateProfile(id: string, data: UpdateProfileInput): Promise<UserResponse> {
    return this.updateUser(id, compact({ name: data.name, email: data.email }));
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.userRepository.delete(id);
    if (!user) throw new NotFoundError('Usuário não encontrado');
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.userRepository.findByEmail(email);
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Credenciais inválidas', 401);
    }
    if (!user.isActive) {
      throw new AppError('Usuário inativo. Entre em contato com o suporte.', 403);
    }

    const payload: JwtPayload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      companyId: user.companyId?.toString(),
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    });

    return { token, user: toUserResponse(user) };
  }
}
