// shared/middleware/performance.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn(`Slow request: ${req.method} ${req.originalUrl} - ${duration}ms`);
    }
  });
  
  next();
};