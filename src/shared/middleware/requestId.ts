import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

export function requestId(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const generateRequestId = randomUUID();

  request.headers['x-request-id'] = generateRequestId;
  response.setHeader('x-request-id', generateRequestId);

  next();
}