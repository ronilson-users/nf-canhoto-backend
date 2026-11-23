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
