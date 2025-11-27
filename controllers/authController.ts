import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import env from '../config/env';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import type { PrismaClient } from '../generated/prisma/client';

class AuthController {
  private readonly SALT_ROUNDS = Number(env.BCRYPT_SALT_ROUNDS);
  private readonly TOKEN_EXPIRY = '7d';

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Register a new user
   */
  public registerUser = async (req: Request, res: Response): Promise<void> => {
    const { email, name, password } = req.body;

    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        res
          .status(409)
          .json(
            makeErrorResponse(
              new Error('User already exists'),
              'A user with this email already exists',
              409
            )
          );
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

      res
        .status(201)
        .json(
          makeSuccessResponse(newUser, 'User registered successfully', 201)
        );
    } catch (err) {
      console.error('Registration error:', err);
      res
        .status(500)
        .json(
          makeErrorResponse(
            err instanceof Error ? err : new Error('Registration failed'),
            'Registration failed',
            500
          )
        );
    }
  };

  /**
   * Login a user
   */
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

      const secret = env.JWT_SECRET_KEY as string;
      if (!secret) {
        throw new Error('JWT secret is not configured');
      }

      const token = jwt.sign({ id: user.id, email: user.email }, secret, {
        expiresIn: this.TOKEN_EXPIRY,
      });

      res.status(200).json(makeSuccessResponse(token, 'Login successful', 200));
    } catch (err) {
      console.error('Login error:', err);
      res
        .status(500)
        .json(
          makeErrorResponse(
            err instanceof Error ? err : new Error('Login failed'),
            'Login failed',
            500
          )
        );
    }
  };
}

export default new AuthController(prisma);
