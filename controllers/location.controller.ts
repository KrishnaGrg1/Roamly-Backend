import type { Response } from 'express';
import { prisma } from '../config/db';
import type { PrismaClient } from '../generated/prisma/client';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { HttpErrors, HttpSuccess } from '../helpers/standardResponse';

class LocationController {
  constructor(private readonly prisma: PrismaClient) {}

  public addLocation = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      const {
        name,
        category,
        description,
        latitude,
        longitude,
        address,
        priceRange,
        rating,
      } = req.body;

      const location = await this.prisma.location.create({
        data: {
          name,
          category,
          description,
          latitude,
          longitude,
          address,
          priceRange,
          rating,
        },
      });

      HttpSuccess.created(res, location, 'Location added successfully');
    } catch (e: unknown) {
      HttpErrors.serverError(res, e, 'Add location');
    }
  };

  public getAllLocations = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req?.userId;
      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      const locations = await this.prisma.location.findMany({
        orderBy: { createdAt: 'desc' },
      });

      HttpSuccess.ok(res, locations, 'Retrieved all locations successfully');
    } catch (e: unknown) {
      HttpErrors.serverError(res, e, 'Get all locations');
    }
  };

  public getLocationById = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req?.userId;
      const locationId = req.params.id;

      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      if (!locationId) {
        HttpErrors.badRequest(res, 'Location ID is required');
        return;
      }

      const location = await this.prisma.location.findUnique({
        where: { id: locationId },
        include: {
          posts: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                },
              },
              _count: {
                select: {
                  likes: true,
                  comments: true,
                },
              },
            },
          },
          _count: {
            select: {
              posts: true,
              reviews: true,
            },
          },
        },
      });

      if (!location) {
        HttpErrors.notFound(res, 'Location');
        return;
      }

      HttpSuccess.ok(res, location, 'Location retrieved successfully');
    } catch (e) {
      HttpErrors.serverError(res, e, 'Get location');
    }
  };

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in kilometers
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get nearby locations using Haversine formula
   * GET /locations/nearby?lat=27.7172&lng=85.3240&radius=5
   * radius is in kilometers (default: 5km)
   */
  public getNearbyLocations = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { lat, lng, radius = '5' } = req.query;

      if (!lat || !lng) {
        HttpErrors.badRequest(res, 'Latitude and longitude are required');
        return;
      }

      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);
      const radiusKm = parseFloat(radius as string);

      if (isNaN(userLat) || isNaN(userLng) || isNaN(radiusKm)) {
        HttpErrors.badRequest(res, 'Invalid coordinates or radius');
        return;
      }

      // Fetch all locations using Prisma ORM
      const allLocations = await this.prisma.location.findMany({
        select: {
          id: true,
          name: true,
          category: true,
          description: true,
          latitude: true,
          longitude: true,
          address: true,
          priceRange: true,
          rating: true,
          createdAt: true,
        },
      });

      // Filter and calculate distance for each location
      const nearbyLocations = allLocations
        .map((location) => {
          const distance = this.calculateDistance(
            userLat,
            userLng,
            location.latitude,
            location.longitude
          );
          return {
            ...location,
            distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
          };
        })
        .filter((location) => location.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 50); // Limit to 50 results

      HttpSuccess.ok(
        res,
        nearbyLocations,
        'Nearby locations retrieved successfully'
      );
    } catch (e) {
      HttpErrors.serverError(res, e, 'Get nearby locations');
    }
  };

  /**
   * Search locations by name or category
   * GET /locations/search?q=hotel&category=HOTEL
   */
  public searchLocations = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { q, category } = req.query;

      const locations = await this.prisma.location.findMany({
        where: {
          AND: [
            q
              ? {
                  OR: [
                    { name: { contains: q as string, mode: 'insensitive' } },
                    {
                      description: {
                        contains: q as string,
                        mode: 'insensitive',
                      },
                    },
                    { address: { contains: q as string, mode: 'insensitive' } },
                  ],
                }
              : {},
            category ? { category: category as any } : {},
          ],
        },
        orderBy: { rating: 'desc' },
        take: 50,
      });

      HttpSuccess.ok(res, locations, 'Locations search completed');
    } catch (e) {
      HttpErrors.serverError(res, e, 'Search locations');
    }
  };
}

export default new LocationController(prisma);
