export const USER_ROLES = ['admin', 'fornecedor', 'motorista', 'recebedor'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Papéis que podem ser escolhidos no cadastro público. "admin" nunca. */
export const PUBLIC_ROLES = ['fornecedor', 'motorista', 'recebedor'] as const;

/** Conteúdo do JWT (e de req.user). */
export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  companyId?: string;
}

/** Formato único de usuário em TODAS as respostas da API (sempre `id`, nunca `_id`). */
export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginResponse {
  token: string;
  user: UserResponse;
}

export interface PaginatedUsers {
  users: UserResponse[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
