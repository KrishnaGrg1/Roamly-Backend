import { Socket } from 'socket.io';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import env from '../config/env';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
): Promise<void> => {
  try {
    console.log('hello ther socket middleware');
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization ||
      (socket.handshake.query?.token as string);

    if (!token) {
      return next(new Error('Authorization token required'));
    }

    const secret = env.JWT_SECRET as string;
    if (!secret) {
      return next(new Error('JWT secret key is missing'));
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;

    if (typeof decoded === 'string' || !decoded.userId) {
      return next(new Error('Invalid token payload'));
    }
    console.log('socket middleware ');
    socket.userId = decoded.userId;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new Error('Token expired'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new Error('Invalid token'));
    }
    next(new Error('Authentication failed'));
  }
};
