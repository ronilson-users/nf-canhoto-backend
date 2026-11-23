import type { UserRole } from './user.types';

export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  companyId?: string;
}

/** Edição pelo próprio usuário: só nome e e-mail. */
export interface UpdateProfileDTO {
  name?: string;
  email?: string;
}

/** Edição por admin. */
export interface UpdateUserDTO extends UpdateProfileDTO {
  role?: UserRole;
  isActive?: boolean;
  companyId?: string;
}

export interface UserResponseDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId?: string;
  isActive: boolean;
}

export interface LoginResponseDTO {
  token: string;
  user: UserResponseDTO;
}
