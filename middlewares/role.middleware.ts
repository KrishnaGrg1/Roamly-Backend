import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { makeErrorResponse } from '../helpers/standardResponse';
import type { AuthRequest } from './auth.middleware';

class RoleMiddleware {
  /**
   * Verify JWT token and attach user info to request
   */
  public verifyBusiness = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      if (req.role !== 'BUSINESS') {
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

export default new RoleMiddleware();
