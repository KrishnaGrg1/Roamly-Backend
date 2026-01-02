import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
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
  private readonly TOKEN_EXPIRY = '7d';
  constructor(private readonly prisma: PrismaClient) {}

  public registerUser = async (req: Request, res: Response): Promise<void> => {
    const { email, name, password } = req.body;

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

      const token = jwt.sign({ id: user.id }, secret, {
        expiresIn: this.TOKEN_EXPIRY,
      });
      // res.cookie('cookie', token);
      res.status(200).json(makeSuccessResponse(token, 'Login successful', 200));
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
}

export default new AuthController(prisma);
