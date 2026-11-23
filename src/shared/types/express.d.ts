import type { JwtPayload } from '@/api/v1/users/user.types';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { isActive: boolean };
      validatedQuery?: any;
    }
  }
}

export {};