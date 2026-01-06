import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/db';
import env from '../config/env';
import {
  HttpErrors,
  HttpSuccess,
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import type { PrismaClient } from '../generated/prisma/client';
import type { AuthRequest } from '../middlewares/auth.middleware';

class AuthController {
  private readonly SALT_ROUNDS = Number(env.BCRYPT_SALT_ROUNDS);
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 7;
  constructor(private readonly prisma: PrismaClient) {}

  private generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  public registerUser = async (req: Request, res: Response): Promise<void> => {
    const { email, name, password, role } = req.body;

    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        HttpErrors.notFound(res, 'User');
        return;
      }

      const hashed = await bcrypt.hash(password, this.SALT_ROUNDS);

      const newUser = await this.prisma.user.create({
        data: {
          email,
          name,
          password: hashed,
          role,
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      });

      HttpSuccess.created(res, newUser, 'User registered successfully');
      return;
    } catch (err) {
      HttpErrors.serverError(res, err, 'Registered failed');
    }
  };

  public loginUser = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          password: true,
          role: true,
        },
      });

      if (!user) {
        res
          .status(401)
          .json(
            makeErrorResponse(
              new Error('Invalid credentials'),
              'Invalid email or password',
              401
            )
          );
        return;
      }

      const valid = await bcrypt.compare(password, user.password);

      if (!valid) {
        res
          .status(401)
          .json(
            makeErrorResponse(
              new Error('Invalid credentials'),
              'Invalid email or password',
              401
            )
          );
        return;
      }

      const secret = env.JWT_SECRET as string;
      if (!secret) {
        throw new Error('JWT secret is not configured');
      }

      const accessToken = jwt.sign({ id: user.id, role: user.role }, secret, {
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
      });

      const refreshToken = this.generateRefreshToken();
      const expiresAt = new Date(
        Date.now() + this.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
      );

      await this.prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt,
        },
      });
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/auth/refresh',
      });
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
      });
      res.status(200).json(
        makeSuccessResponse(
          {
            accessToken,
            refreshToken,
          },
          'Login successful',
          200
        )
      );
    } catch (err) {
      HttpErrors.serverError(res, err, 'Login error');
    }
  };

  public getMe = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: {
          id: req?.userId,
        },
      });
      if (!existingUser) {
        res
          .status(404)
          .json(
            makeErrorResponse(
              new Error('User not found'),
              'User not found',
              404
            )
          );
        return;
      }
      res
        .status(200)
        .json(
          makeSuccessResponse(
            existingUser,
            'Successfully retrieved user data',
            200
          )
        );
    } catch (err) {
      HttpErrors.serverError(res, err, 'Get me failed');
    }
  };

  public refreshToken = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies?.refresh_token || req.body.refreshToken;
    try {
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: { select: { id: true } } },
      });

      if (!storedToken) {
        res
          .status(401)
          .json(
            makeErrorResponse(
              new Error('Invalid token'),
              'Invalid refresh token',
              401
            )
          );
        return;
      }

      if (storedToken.expiresAt < new Date()) {
        await this.prisma.refreshToken.delete({
          where: { id: storedToken.id },
        });
        res
          .status(401)
          .json(
            makeErrorResponse(
              new Error('Token expired'),
              'Refresh token has expired, please login again',
              401
            )
          );
        return;
      }

      const secret = env.JWT_SECRET as string;
      if (!secret) {
        throw new Error('JWT secret is not configured');
      }

      const newAccessToken = jwt.sign({ id: storedToken.user.id }, secret, {
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
      });
      const newRefreshToken = this.generateRefreshToken();
      const expiresAt = new Date(
        Date.now() + this.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
      );
      await this.prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: storedToken.user.id,
          expiresAt,
        },
      });
      res.cookie('refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/auth/refresh',
      });
      res
        .status(200)
        .json(
          makeSuccessResponse(
            { accessToken: newAccessToken },
            'Token refreshed successfully',
            200
          )
        );
    } catch (err) {
      HttpErrors.serverError(res, err, 'Token refresh failed');
    }
  };

  public logout = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies?.refresh_token || req.body.refreshToken;

    try {
      if (refreshToken) {
        await this.prisma.refreshToken.deleteMany({
          where: { token: refreshToken },
        });
      }
      res.clearCookie('refresh_token', { path: '/auth/refresh' });
      res
        .status(200)
        .json(makeSuccessResponse(null, 'Logged out successfully', 200));
    } catch (err) {
      HttpErrors.serverError(res, err, 'Logout error');
    }
  };
}

export default new AuthController(prisma);
