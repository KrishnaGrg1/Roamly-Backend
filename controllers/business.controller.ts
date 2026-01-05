import type { Response } from 'express';
import { prisma } from '../config/db';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { HttpErrors, makeSuccessResponse } from '../helpers/standardResponse';
import type { PrismaClient } from '../generated/prisma/client';
import { FILE_CONSTRAINTS, validateFiles } from '../helpers/fileValidator';
import {
  CLOUDINARY_PRESETS,
  uploadMultipleToCloudinary,
  uploadToCloudinary,
} from '../helpers/cloudinary';

class BusinessController {
  constructor(private readonly prisma: PrismaClient) {}
  public registerBusiness = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { type, tier, locations } = req.body;

      if (!req.userId) {
        HttpErrors.unauthorized(res, 'User not authenticated');
        return;
      }

      const existingUser = await this.prisma.user.findUnique({
        where: {
          id: req.userId,
        },
      });

      if (!existingUser) {
        HttpErrors.notFound(res, 'User');
        return;
      }
      const business = await this.prisma.business.create({
        data: {
          ownerId: req.userId,
          type,
          tier,
          locations: {
            create: locations.map((loc: any) => ({
              name: loc.name,
              category: loc.category,
              description: loc.description,
              latitude: loc.latitude,
              longitude: loc.longitude,
              address: loc.address,
              priceRange: loc.priceRange,
              verified: loc.verified ?? false,
            })),
          },
        },
        include: { locations: true },
      });
      if (existingUser.role === 'USER') {
        await prisma.user.update({
          where: { id: req.userId },
          data: { role: 'BUSINESS' },
        });
      }
      res.status(201).json(
        makeSuccessResponse(
          {
            business,
          },
          'Business registered successfully',
          201
        )
      );
    } catch (e) {
      HttpErrors.serverError(res, e, 'Suggest places');
    }
  };

  public getBusinessOfUser = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: {
          id: req.userId,
        },
      });
      if (!existingUser) {
        HttpErrors.notFound(res, 'User');
        return;
      }
      const existingBusiness = await this.prisma.business.findFirst({
        where: {
          ownerId: req.userId,
        },
        include: { profile: true, locations: true, bookings: true },
      });
      res.status(201).json(
        makeSuccessResponse(
          {
            existingBusiness,
          },
          'Successfully list all business of user',
          201
        )
      );
    } catch (e) {
      HttpErrors.serverError(res, e, 'Failed to get all business of users');
    }
  };

  public updateBusiness = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.userId) {
        HttpErrors.unauthorized(res, 'User not authenticated');
        return;
      }
      const exsitingBusiness = await this.prisma.business.findFirst({
        where: {
          ownerId: req.userId,
        },
      });
      if (!exsitingBusiness) {
        HttpErrors.notFound(res, 'Business');
        return;
      }
      const { name, description, establishedAt, website, phone, email } =
        req.body;

      // Verify business exists and belongs to user
      const existingBusiness = await this.prisma.business.findFirst({
        where: {
          id: exsitingBusiness.id,
          ownerId: req.userId,
        },
        include: { profile: true },
      });

      if (!existingBusiness) {
        HttpErrors.notFound(res, 'Business');
        return;
      }

      let logoUrl: string | undefined;

      // Handle logo upload if provided
      const logoFile = req.files?.logo;
      if (logoFile && !Array.isArray(logoFile)) {
        const validation = validateFiles(
          logoFile,
          {
            allowedMimeTypes: FILE_CONSTRAINTS.PROFILE_PICTURE.allowedMimeTypes,
            maxSizeBytes: FILE_CONSTRAINTS.PROFILE_PICTURE.maxSizeBytes,
            fieldName: 'logo',
          },
          1
        );

        if (!validation.isValid) {
          HttpErrors.badRequest(res, validation.error || 'Invalid logo file');
          return;
        }

        // Upload logo to Cloudinary
        const uploadedLogo = await uploadToCloudinary(
          logoFile,
          CLOUDINARY_PRESETS.BUSINESS
        );
        logoUrl = uploadedLogo.url;
      }

      // Create or update business profile
      const profileData = {
        name: name || existingBusiness.profile?.name || '',
        description,
        establishedAt: establishedAt ? parseInt(establishedAt, 10) : undefined,
        website,
        phone,
        email,
        ...(logoUrl && { logoUrl }),
      };

      let updatedProfile;
      if (existingBusiness.profile) {
        // Update existing profile
        updatedProfile = await this.prisma.businessProfile.update({
          where: { id: exsitingBusiness.id },
          data: profileData,
        });
      } else {
        // Create new profile
        updatedProfile = await this.prisma.businessProfile.create({
          data: {
            businessId: existingBusiness.id,
            ...profileData,
            name: profileData.name || 'Unnamed Business',
          },
        });
      }

      res
        .status(200)
        .json(
          makeSuccessResponse(
            { profile: updatedProfile },
            'Business profile updated successfully',
            200
          )
        );
    } catch (e) {
      HttpErrors.serverError(res, e, 'Update Business failed');
    }
  };

  public submitBusinessVerification = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const existingBusiness = await this.prisma.business.findFirst({
        where: {
          ownerId: req.userId,
        },
      });
      if (!existingBusiness) {
        HttpErrors.notFound(res, 'Business');
        return;
      }
      await this.prisma.business.update({
        where: {
          id: existingBusiness.id,
        },
        data: {
          status: 'PENDING',
        },
      });
      res
        .status(201)
        .json(
          makeSuccessResponse(
            existingBusiness,
            'Sucessfully submitted business verification',
            201
          )
        );
    } catch (e) {
      HttpErrors.serverError(res, e, 'Failed to submit Business verification');
    }
  };
}

export default new BusinessController(prisma);
