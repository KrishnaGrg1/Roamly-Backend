import { prisma } from '../config/db';
import type { Response } from 'express';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import type { AuthRequest } from '../middlewares/auth.middleware';
import type { PrismaClient } from '../generated/prisma/client';
import type { UploadedFile } from 'express-fileupload';
import {
  FILE_CONSTRAINTS,
  fileToDataUri,
  validateFile,
} from '../helpers/fileValidator';
import cloudinary from '../config/cloudnary';
import postController from './post.controller';
class userController {
  constructor(private prisma: PrismaClient) {}

  public getUserById = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.params.id;
      if (!userId) {
        res
          .status(404)
          .json(
            makeErrorResponse(
              new Error('UserId requried'),
              'UserId required!',
              404
            )
          );
        return;
      }
      const existingUser = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });
      if (!existingUser) {
        res
          .status(404)
          .json(
            makeErrorResponse(
              new Error('User not found'),
              'User not found',
              400
            )
          );
        return;
      }
      res
        .status(200)
        .json(
          makeSuccessResponse(existingUser, 'User retrieved successfully ', 200)
        );
      return;
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

  public editUser = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req?.userId;
      console.log('request:', req.body);
      if (!userId) {
        res
          .status(401)
          .json(
            makeErrorResponse(
              new Error('Unauthorized'),
              'Authentication required',
              401
            )
          );
        return;
      }

      const existingUser = await this.prisma.user.findUnique({
        where: { id: userId },
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
          res
            .status(400)
            .json(
              makeErrorResponse(
                new Error(validation.error),
                validation.error || 'Invalid file',
                400
              )
            );
          return;
        }

        const dataUri = fileToDataUri(file);
        const cloudResult = await cloudinary.uploader.upload(dataUri, {
          folder: 'roamly/profiles',
          transformation: [
            {
              width: 500,
              height: 500,
              crop: 'limit',
              quality: 'auto:good',
              fetch_format: 'auto',
            },
          ],
          public_id: `profile_${userId}`,
          overwrite: true,
          invalidate: true,
        });

        updateData.avatar = cloudResult.secure_url;

        // Delete old avatar from Cloudinary
        if (
          existingUser.avatar &&
          existingUser.avatar !== cloudResult.secure_url
        ) {
          try {
            const publicId = postController.extractPublicId(
              existingUser.avatar
            );
            if (publicId) {
              await cloudinary.uploader.destroy(publicId);
            }
          } catch (deleteError) {
            console.warn('Failed to delete old avatar:', deleteError);
          }
        }
      }

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('No data provided'),
              'At least name or avatar must be provided',
              400
            )
          );
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

      res
        .status(200)
        .json(
          makeSuccessResponse(updatedUser, 'User updated successfully', 200)
        );
    } catch (err) {
      console.error('Edit user error:', err);
      res
        .status(500)
        .json(
          makeErrorResponse(
            err instanceof Error ? err : new Error('Update failed'),
            'Failed to update user',
            500
          )
        );
    }
  };
}

export default new userController(prisma);
