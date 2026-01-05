import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import { makeErrorResponse } from '../helpers/standardResponse';

export interface AuthRequest extends Request {
  userId?: string;
  role?: string;
}

interface JWTPayload {
  id: string;
  role: string;
}

class AuthMiddleware {
  /**
   * Verify JWT token and attach user info to request
   */
  public verifyToken = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        throw new Error('Authorization header requried!');
      }
      const token = authHeader.replace('Bearer ', '');
      if (!token) {
        res
          .status(401)
          .json(
            makeErrorResponse(
              new Error('Token required'),
              'Authorization token required',
              401
            )
          );
        return;
      }
      const secret = env.JWT_SECRET as string;
      if (!secret) {
        throw new Error('Jwt secret key is missing in .env file');
      }
      const decode = jwt.verify(token, secret) as JWTPayload;
      if (typeof decode === 'string') {
        res
          .status(403)
          .json(
            makeErrorResponse(
              new Error('You are not authorized'),
              'You are not authorized',
              403
            )
          );
        return;
      }
      req.userId = decode.id;
      req.role = decode.role;
      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        res.status(401).json(makeErrorResponse(err, 'Token has expired', 401));
      } else if (err instanceof jwt.JsonWebTokenError) {
        res.status(401).json(makeErrorResponse(err, 'Invalid token', 401));
      } else {
        res
          .status(500)
          .json(
            makeErrorResponse(
              err instanceof Error ? err : new Error('Authentication failed'),
              'Authentication failed',
              500
            )
          );
      }
    }
  };
}

export default new AuthMiddleware();
