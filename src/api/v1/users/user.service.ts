import jwt, { type SignOptions } from 'jsonwebtoken';
import { Types } from 'mongoose';

import { env } from '@/shared/config/env';
import { AppError, ConflictError, NotFoundError } from '@/shared/utils/error';

import type { IUser } from './user.model';
import type { CreateUserDTO, LoginResponseDTO, UpdateProfileDTO, UpdateUserDTO } from './user.dto';
import { UserRepository } from './user.repository';
import type { JwtPayload } from './user.types';

const isDuplicateKeyError = (e: unknown): e is { code: number; keyPattern?: Record<string, unknown> } =>
  typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 11000;

/** Remove chaves undefined (evita sobrescrever campos sem querer). */
const compact = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

/** DTO (companyId string) -> dados do model (companyId ObjectId). */
const toUserData = (dto: CreateUserDTO | UpdateUserDTO): Partial<IUser> => {
  const { companyId, ...rest } = dto;
  return compact({ ...rest, companyId: companyId ? new Types.ObjectId(companyId) : undefined }) as Partial<IUser>;
};

export class UserService {
  private userRepository = new UserRepository();

  async createUser(data: CreateUserDTO): Promise<IUser> {
    if (await this.userRepository.findByEmail(data.email)) {
      throw new ConflictError('Email já cadastrado');
    }

    try {
      const created = await this.userRepository.create(toUserData(data));
      // relê sem o campo password (não depende do toJSON do model)
      return await this.getUserById(created._id.toString());
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const field = Object.keys(error.keyPattern ?? {})[0] ?? 'campo';
        throw new ConflictError(`${field} já cadastrado`);
      }
      throw error;
    }
  }

  async getUsers(page = 1, limit = 10) {
    return this.userRepository.findAll(page, limit);
  }

  async getUserById(id: string): Promise<IUser> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundError('Usuário não encontrado');
    return user;
  }

  /** Edição administrativa. */
  async updateUser(id: string, data: UpdateUserDTO): Promise<IUser> {
    const user = await this.getUserById(id);

    if (data.email && data.email !== user.email) {
      if (await this.userRepository.findByEmail(data.email)) {
        throw new ConflictError('Email já cadastrado por outro usuário');
      }
    }

    const updated = await this.userRepository.update(id, toUserData(data));
    if (!updated) throw new AppError('Erro ao atualizar usuário', 500);
    return updated;
  }

  /** Auto-edição: só nome e e-mail, mesmo que o chamador envie mais campos. */
  async updateProfile(id: string, data: UpdateProfileDTO): Promise<IUser> {
    return this.updateUser(id, compact({ name: data.name, email: data.email }));
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.userRepository.delete(id);
    if (!user) throw new NotFoundError('Usuário não encontrado');
  }

  async login(email: string, password: string): Promise<LoginResponseDTO> {
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

    return {
      token,
      user: {
        id: payload.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: payload.companyId,
        isActive: user.isActive,
      },
    };
  }
}
