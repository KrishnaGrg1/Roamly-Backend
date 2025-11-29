import { prisma } from '../config/db';
import type { Response } from 'express';
import {
  makeSuccessResponse,
  HttpErrors,
  HttpSuccess,
} from '../helpers/standardResponse';
import type { AuthRequest } from '../middlewares/auth.middleware';
import type { PrismaClient } from '../generated/prisma/client';
import type { UploadedFile } from 'express-fileupload';
import { FILE_CONSTRAINTS, validateFile } from '../helpers/fileValidator';
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  CLOUDINARY_PRESETS,
} from '../helpers/cloudinary';

class UserController {
  constructor(private prisma: PrismaClient) {}

  public getUserById = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.params.id;

      if (!userId) {
        HttpErrors.badRequest(res, 'User ID is required');
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        HttpErrors.notFound(res, 'User');
        return;
      }

      HttpSuccess.ok(res, user, 'User retrieved successfully');
    } catch (err) {
      HttpErrors.serverError(res, err, 'Get user');
    }
  };

  public editUser = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req?.userId;

      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      const existingUser = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        HttpErrors.notFound(res, 'User');
        return;
      }

      // Prepare update data
      const updateData: { name?: string; avatar?: string } = {};

      // Handle name update
      if (req.body?.name) {
        updateData.name = req.body.name.trim();
      }

      // Handle avatar upload (optional)
      const file = req.files?.avatar as UploadedFile | undefined;

      if (file) {
        const validation = validateFile(file, {
          allowedMimeTypes: FILE_CONSTRAINTS.PROFILE_PICTURE.allowedMimeTypes,
          maxSizeBytes: FILE_CONSTRAINTS.PROFILE_PICTURE.maxSizeBytes,
          fieldName: 'avatar',
        });

        if (!validation.isValid) {
          HttpErrors.badRequest(res, validation.error || 'Invalid file');
          return;
        }

        const uploadResult = await uploadToCloudinary(file, {
          ...CLOUDINARY_PRESETS.PROFILE,
          publicId: `profile_${userId}`,
          overwrite: true,
        });

        updateData.avatar = uploadResult.url;

        // Delete old avatar from Cloudinary
        if (existingUser.avatar && existingUser.avatar !== uploadResult.url) {
          await deleteFromCloudinary(existingUser.avatar);
        }
      }

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        HttpErrors.badRequest(res, 'At least name or avatar must be provided');
        return;
      }

      // Update user
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      HttpSuccess.ok(res, updatedUser, 'User updated successfully');
    } catch (err) {
      HttpErrors.serverError(res, err, 'Edit user');
    }
  };
}

export default new UserController(prisma);
