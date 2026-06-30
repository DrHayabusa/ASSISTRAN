import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface TokenPayload {
  sub: string; // user id
  username: string;
}

/** Sign a JWT for a user. */
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresInSec });
}

/** Verify a JWT and return its payload, or null if invalid/expired. */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    if (typeof decoded.sub === 'string' && typeof decoded.username === 'string') {
      return { sub: decoded.sub, username: decoded.username };
    }
    return null;
  } catch {
    return null;
  }
}
