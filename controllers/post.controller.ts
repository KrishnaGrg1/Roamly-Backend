import type { Response } from 'express';
import type { UploadedFile } from 'express-fileupload';
import type { AuthRequest } from '../middlewares/auth.middleware';
import type { PrismaClient } from '../generated/prisma/client';
import {
  makeSuccessResponse,
  HttpErrors,
  HttpSuccess,
} from '../helpers/standardResponse';
import { validateFiles, FILE_CONSTRAINTS } from '../helpers/fileValidator';
import {
  parsePaginationParams,
  buildCursorQuery,
  buildPaginationResponse,
} from '../helpers/pagination';
import {
  uploadMultipleToCloudinary,
  deleteFromCloudinary,
  CLOUDINARY_PRESETS,
} from '../helpers/cloudinary';
import { prisma } from '../config/db';
import {
  rankPosts,
  type FeedMode,
  type UserContext,
} from '../helpers/feedRanking';

class PostController {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new post from a completed trip
   * POST /posts
   */
  public createPost = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;

      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      const { tripId, caption } = req.body;

      // Validate tripId is provided
      if (!tripId) {
        HttpErrors.badRequest(res, 'Trip ID is required to create a post');
        return;
      }

      // Check if trip exists and belongs to user
      const trip = await this.prisma.trip.findUnique({
        where: { id: tripId },
        include: {
          post: true, // Check if post already exists
        },
      });

      if (!trip) {
        HttpErrors.notFound(res, 'Trip not found');
        return;
      }

      if (trip.userId !== userId) {
        HttpErrors.badRequest(
          res,
          'You can only create posts from your own trips'
        );
        return;
      }

      // BUSINESS RULE: Only completed trips can create posts
      if (trip.status !== 'COMPLETED') {
        HttpErrors.badRequest(
          res,
          'Only completed trips can be posted. Complete the trip first using POST /trip/:id/complete'
        );
        return;
      }

      // BUSINESS RULE: One post per trip (unique constraint enforced)
      if (trip.post) {
        HttpErrors.badRequest(
          res,
          'This trip already has a post. Each trip can only have one post.'
        );
        return;
      }

      // Create post from trip
      const post = await this.prisma.post.create({
        data: {
          userId,
          tripId,
          caption: caption?.trim() || null,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          trip: {
            select: {
              id: true,
              source: true,
              destination: true,
              days: true,
              travelStyle: true,
              itinerary: true,
              costBreakdown: true,
              createdAt: true,
              completedAt: true,
            },
          },
        },
      });

      HttpSuccess.created(
        res,
        makeSuccessResponse(
          post,
          'Post created successfully from completed trip'
        )
      );
    } catch (err) {
      console.error('Error creating post:', err);
      HttpErrors.serverError(res, err, 'Create post');
    }
  };

  /**
   * Get post by ID
   * GET /posts/:id
   */
  public getPostById = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const postId = req.params.id;

      if (!postId) {
        HttpErrors.badRequest(res, 'Post ID is required');
        return;
      }

      const post = await this.prisma.post.findUnique({
        where: { id: postId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          trip: {
            select: {
              id: true,
              source: true,
              destination: true,
              days: true,
              travelStyle: true,
              itinerary: true,
              costBreakdown: true,
              completedAt: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              bookmarks: true,
            },
          },
        },
      });

      if (!post) {
        HttpErrors.notFound(res, 'Post');
        return;
      }

      // Check if current user liked/bookmarked this post
      let isLiked = false;
      let isBookmarked = false;

      if (req.userId) {
        const [like, bookmark] = await Promise.all([
          this.prisma.like.findFirst({
            where: { postId, userId: req.userId },
          }),
          this.prisma.bookmark.findFirst({
            where: { postId, userId: req.userId },
          }),
        ]);
        isLiked = !!like;
        isBookmarked = !!bookmark;
      }

      HttpSuccess.ok(
        res,
        { ...post, isLiked, isBookmarked },
        'Post retrieved successfully'
      );
    } catch (err) {
      HttpErrors.serverError(res, err, 'Get post');
    }
  };

  /**
   * Delete post by ID
   * DELETE /posts/:id
   */
  public deletePostById = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      const postId = req.params.id;

      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      if (!postId) {
        HttpErrors.badRequest(res, 'Post ID is required');
        return;
      }

      const post = await this.prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        HttpErrors.notFound(res, 'Post');
        return;
      }

      // Check ownership
      if (post.userId !== userId) {
        HttpErrors.unauthorized(res, 'You can only delete your own posts');
        return;
      }

      // Delete from database
      await this.prisma.post.delete({
        where: { id: postId },
      });

      HttpSuccess.ok(
        res,
        { success: true, id: postId },
        'Post deleted successfully'
      );
    } catch (err) {
      HttpErrors.serverError(res, err, 'Delete post');
    }
  };

  /**
   * Like a post
   * POST /posts/:id/like
   */
  public likePost = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      const postId = req.params.id;

      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      if (!postId) {
        HttpErrors.badRequest(res, 'Post ID is required');
        return;
      }

      // Check if post exists
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        HttpErrors.notFound(res, 'Post');
        return;
      }

      // Check if already liked
      const existingLike = await this.prisma.like.findFirst({
        where: { postId, userId },
      });

      if (existingLike) {
        HttpErrors.conflict(res, 'You have already liked this post');
        return;
      }

      // Create like
      await this.prisma.like.create({
        data: { postId, userId },
      });

      // Get updated count
      const likeCount = await this.prisma.like.count({
        where: { postId },
      });

      HttpSuccess.created(
        res,
        { liked: true, postId, likeCount },
        'Post liked successfully'
      );
    } catch (err) {
      HttpErrors.serverError(res, err, 'Like post');
    }
  };

  /**
   * Unlike a post
   * DELETE /posts/:id/like
   */
  public unlikePost = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      const postId = req.params.id;

      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      if (!postId) {
        HttpErrors.badRequest(res, 'Post ID is required');
        return;
      }

      // Check if post exists
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        HttpErrors.notFound(res, 'Post');
        return;
      }

      // Check if liked
      const existingLike = await this.prisma.like.findFirst({
        where: { postId, userId },
      });

      if (!existingLike) {
        HttpErrors.notFound(res, 'Like');
        return;
      }

      // Delete like
      await this.prisma.like.delete({
        where: { id: existingLike.id },
      });

      // Get updated count
      const likeCount = await this.prisma.like.count({
        where: { postId },
      });

      HttpSuccess.ok(
        res,
        { liked: false, postId, likeCount },
        'Post unliked successfully'
      );
    } catch (err) {
      HttpErrors.serverError(res, err, 'Unlike post');
    }
  };

  /**
   * Bookmark a post
   * POST /posts/:id/bookmark
   */
  public bookmarkPost = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      const postId = req.params.id;

      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      if (!postId) {
        HttpErrors.badRequest(res, 'Post ID is required');
        return;
      }

      // Check if post exists
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        HttpErrors.notFound(res, 'Post');
        return;
      }

      // Check if already bookmarked
      const existingBookmark = await this.prisma.bookmark.findFirst({
        where: { postId, userId },
      });

      if (existingBookmark) {
        HttpErrors.conflict(res, 'You have already bookmarked this post');
        return;
      }

      // Create bookmark
      const bookmark = await this.prisma.bookmark.create({
        data: { postId, userId },
        select: {
          id: true,
          postId: true,
          userId: true,
          createdAt: true,
        },
      });

      HttpSuccess.created(
        res,
        { bookmarked: true, bookmark },
        'Post bookmarked successfully'
      );
    } catch (err) {
      HttpErrors.serverError(res, err, 'Bookmark post');
    }
  };

  /**
   * Remove bookmark from a post
   * DELETE /posts/:id/bookmark
   */
  public unbookmarkPost = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      const postId = req.params.id;

      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      if (!postId) {
        HttpErrors.badRequest(res, 'Post ID is required');
        return;
      }

      // Check if post exists
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        HttpErrors.notFound(res, 'Post');
        return;
      }

      // Check if bookmarked
      const existingBookmark = await this.prisma.bookmark.findFirst({
        where: { postId, userId },
      });

      if (!existingBookmark) {
        HttpErrors.notFound(res, 'Bookmark');
        return;
      }

      // Delete bookmark
      await this.prisma.bookmark.delete({
        where: { id: existingBookmark.id },
      });

      HttpSuccess.ok(
        res,
        { bookmarked: false, postId },
        'Bookmark removed successfully'
      );
    } catch (err) {
      HttpErrors.serverError(res, err, 'Remove bookmark');
    }
  };

  /**
   * Get posts feed with intelligent ranking
   * GET /posts/feed?limit=10&cursor=postId&mode=balanced
   *
   * Feed Modes:
   * - balanced (default): Standard ranking algorithm
   * - nearby: Prioritize location relevance
   * - trek: Boost trek/adventure content with trust
   * - budget: Focus on budget matching
   */
  public getFeed = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      const { limit, cursor } = parsePaginationParams(req.query as any);
      const mode = (req.query.mode as FeedMode) || 'balanced';

      // Validate mode
      const validModes: FeedMode[] = ['balanced', 'nearby', 'trek', 'budget'];
      if (!validModes.includes(mode)) {
        HttpErrors.badRequest(
          res,
          `Invalid feed mode. Must be one of: ${validModes.join(', ')}`
        );
        return;
      }

      // Fetch more posts than needed for ranking
      // We'll rank then paginate
      const fetchLimit = Number(limit) * 3; // Fetch 3x to allow for good ranking

      const posts = await this.prisma.post.findMany({
        take: fetchLimit,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
        orderBy: { createdAt: 'desc' }, // Initial fetch by recency
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          trip: {
            select: {
              id: true,
              userId: true,
              source: true,
              destination: true,
              days: true,
              budgetMin: true,
              budgetMax: true,
              travelStyle: true,
              itinerary: true,
              costBreakdown: true,
              completedAt: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              bookmarks: true,
            },
          },
        },
      });

      // Filter out posts without trips (safety check)
      const validPosts = posts.filter((post) => post.tripId !== null);

      if (validPosts.length === 0) {
        HttpSuccess.ok(
          res,
          {
            posts: [],
            pagination: { hasNextPage: false, nextCursor: null },
          },
          'Feed retrieved successfully'
        );
        return;
      }

      // Fetch completed trips count for all unique post authors (for trust score)
      const uniqueUserIds = [...new Set(validPosts.map((post) => post.tripId))];
      const userCompletedTripsMap = new Map<string, number>();

      await Promise.all(
        uniqueUserIds.map(async (authorId) => {
          const count = await this.prisma.trip.count({
            where: { userId: authorId, status: 'COMPLETED' },
          });
          userCompletedTripsMap.set(authorId, count);
        })
      );

      // Build user context for personalization
      let userContext: UserContext = {};

      if (userId) {
        // Get user preferences from their profile or past trips
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            preferences: true,
            trips: {
              where: { status: 'COMPLETED' },
              select: {
                travelStyle: true,
                budgetMin: true,
                budgetMax: true,
              },
              take: 5,
              orderBy: { completedAt: 'desc' },
            },
            _count: {
              select: {
                trips: {
                  where: { status: 'COMPLETED' },
                },
              },
            },
          },
        });

        if (user) {
          // Extract preferences
          const preferences = (user.preferences as any) || {};

          // Calculate average budget from past trips
          const completedTrips = user.trips;
          if (completedTrips.length > 0) {
            const budgets = completedTrips
              .filter((t) => t.budgetMin && t.budgetMax)
              .map((t) => ({ min: t.budgetMin!, max: t.budgetMax! }));

            if (budgets.length > 0) {
              userContext.preferredBudgetMin =
                budgets.reduce((sum, b) => sum + b.min, 0) / budgets.length;
              userContext.preferredBudgetMax =
                budgets.reduce((sum, b) => sum + b.max, 0) / budgets.length;
            }
          }

          // Extract preferred travel styles
          const styleMap = new Map<string, number>();
          completedTrips.forEach((trip) => {
            trip.travelStyle.forEach((style) => {
              styleMap.set(style, (styleMap.get(style) || 0) + 1);
            });
          });

          if (styleMap.size > 0) {
            userContext.preferredStyles = Array.from(styleMap.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([style]) => style as any);
          }

          userContext.userId = userId;
          userContext.latitude = preferences.latitude;
          userContext.longitude = preferences.longitude;
          userContext.completedTripsCount = user._count.trips;
        }
      }

      // Apply intelligent ranking with user completed trips map
      const rankedPosts = rankPosts(
        validPosts,
        userContext,
        mode,
        userCompletedTripsMap
      );

      // Take only the requested limit after ranking
      const topPosts = rankedPosts.slice(0, Number(limit));

      // Add user interaction flags if authenticated
      let postsWithInteraction = topPosts.map((ranked) => ({
        ...ranked.post,
        _feedScore: ranked.score,
        _scoreBreakdown: ranked.breakdown,
        isLiked: false,
        isBookmarked: false,
      }));

      if (userId && topPosts.length > 0) {
        const postIds = topPosts.map((ranked) => ranked.post.id);

        const [userLikes, userBookmarks] = await Promise.all([
          this.prisma.like.findMany({
            where: { userId, postId: { in: postIds } },
            select: { postId: true },
          }),
          this.prisma.bookmark.findMany({
            where: { userId, postId: { in: postIds } },
            select: { postId: true },
          }),
        ]);

        const likedPostIds = new Set(userLikes.map((l) => l.postId));
        const bookmarkedPostIds = new Set(userBookmarks.map((b) => b.postId));

        postsWithInteraction = topPosts.map((ranked) => ({
          ...ranked.post,
          _feedScore: ranked.score,
          _scoreBreakdown: ranked.breakdown,
          isLiked: likedPostIds.has(ranked.post.id),
          isBookmarked: bookmarkedPostIds.has(ranked.post.id),
        }));
      }

      // Determine if there are more posts available
      const hasNextPage = rankedPosts.length > Number(limit);
      const nextCursor =
        hasNextPage && topPosts.length > 0
          ? topPosts[topPosts.length - 1]!.post.id
          : null;

      HttpSuccess.ok(
        res,
        {
          posts: postsWithInteraction,
          pagination: {
            hasNextPage,
            nextCursor,
            mode,
          },
        },
        'Feed retrieved successfully'
      );
    } catch (err) {
      console.error('Feed error:', err);
      HttpErrors.serverError(res, err, 'Get feed');
    }
  };

  /**
   * Get user's bookmarked posts
   * GET /posts/bookmarks?limit=10&cursor=postId
   */
  public getBookmarkedPosts = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;

      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      const { limit, cursor } = parsePaginationParams(req.query as any);

      const bookmarks = await this.prisma.bookmark.findMany({
        where: { userId },
        ...buildCursorQuery({ limit, cursor }),
        orderBy: { createdAt: 'desc' },
        include: {
          post: {
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
        },
      });

      const posts = bookmarks
        .filter((b) => b.post !== null)
        .map((b) => ({
          ...b.post,
          isBookmarked: true,
          bookmarkedAt: b.createdAt,
        }));

      HttpSuccess.ok(
        res,
        {
          posts,
          pagination: buildPaginationResponse(bookmarks, limit),
        },
        'Bookmarked posts retrieved successfully'
      );
    } catch (err) {
      HttpErrors.serverError(res, err, 'Get bookmarks');
    }
  };
}

export default new PostController(prisma);
