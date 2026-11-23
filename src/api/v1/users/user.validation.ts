import { z } from 'zod';
import { PUBLIC_ROLES, USER_ROLES } from './user.types';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID inválido');

const name = z
  .string()
  .trim()
  .min(3, 'Nome deve ter pelo menos 3 caracteres')
  .max(100, 'Nome deve ter no máximo 100 caracteres');

const email = z.string().trim().email('Email inválido').toLowerCase();

// 72 = limite do bcrypt (bytes além disso são ignorados)
const password = z
  .string()
  .min(8, 'Senha deve ter pelo menos 8 caracteres')
  .max(72, 'Senha deve ter no máximo 72 caracteres');

/** Cadastro público: o papel nunca pode ser admin. */
export const registerSchema = z.object({
  name,
  email,
  password,
  role: z.enum(PUBLIC_ROLES).default('recebedor'),
});

/** Criação por admin (pode definir qualquer papel e a empresa). */
export const createUserSchema = z.object({
  name,
  email,
  password,
  role: z.enum(USER_ROLES).default('recebedor'),
  companyId: objectId.optional(),
});

/** Auto-edição: SEM role, isActive ou companyId. */
export const updateProfileSchema = z.object({
  name: name.optional(),
  email: email.optional(),
});

/** Edição por admin. */
export const updateUserSchema = updateProfileSchema.extend({
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
  companyId: objectId.optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Senha é obrigatória'),
});

export const idSchema = z.object({ id: objectId });

// Tipos derivados dos schemas (substituem o antigo user.dto.ts)
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
