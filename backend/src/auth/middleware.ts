import type { NextFunction, Request, Response } from 'express';
import { verifyToken, type TokenPayload } from './tokens';

export interface AuthedRequest extends Request {
  auth?: TokenPayload;
}

/** Extract a Bearer token from the Authorization header. */
export function bearerFrom(header: string | undefined): string {
  if (!header) return '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

/** Express middleware: require a valid JWT, attaching it as req.auth. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const payload = verifyToken(bearerFrom(req.headers.authorization));
  if (!payload) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  req.auth = payload;
  next();
}
