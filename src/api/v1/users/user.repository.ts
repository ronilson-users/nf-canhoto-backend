import { AppError } from '@/shared/utils/error';

import { User, type IUser } from './user.model';

const SAFE_FIELDS = '-password -__v';

export class UserRepository {
  async create(userData: Partial<IUser>): Promise<IUser> {
    return new User(userData).save();
  }

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({ isActive: true })
        .select(SAFE_FIELDS)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      User.countDocuments({ isActive: true }),
    ]);

    return {
      users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<IUser | null> {
    if (!id) throw new AppError('ID do usuário é obrigatório', 400);
    return User.findById(id).select(SAFE_FIELDS).lean();
  }

  /** Retorna o hash da senha: use só no login. */
  async findByEmail(email: string): Promise<IUser | null> {
    if (!email) throw new AppError('Email é obrigatório', 400);
    return User.findOne({ email }).select('+password -__v');
  }

  /** Checagem leve de duplicidade (não carrega o usuário nem a senha). */
  async existsByEmail(email: string): Promise<boolean> {
    return (await User.exists({ email })) !== null;
  }

  async update(id: string, data: Partial<IUser>): Promise<IUser | null> {
    if (!id) throw new AppError('ID do usuário é obrigatório', 400);

    // Senha nunca é alterada por aqui. updatedAt é automático (timestamps: true).
    const { password: _password, ...updateData } = data;

    return User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .select(SAFE_FIELDS)
      .lean();
  }

  /** Soft delete. */
  async delete(id: string): Promise<IUser | null> {
    if (!id) throw new AppError('ID do usuário é obrigatório', 400);
    return User.findByIdAndUpdate(id, { isActive: false }, { new: true })
      .select(SAFE_FIELDS)
      .lean();
  }

  async hardDelete(id: string): Promise<IUser | null> {
    if (!id) throw new AppError('ID do usuário é obrigatório', 400);
    return User.findByIdAndDelete(id);
  }

  async restore(id: string): Promise<IUser | null> {
    return User.findByIdAndUpdate(id, { isActive: true }, { new: true })
      .select(SAFE_FIELDS)
      .lean();
  }
}
