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

class PostController {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new post with images
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

      const filesObj = req.files?.images;
      const validation = validateFiles(
        filesObj,
        {
          allowedMimeTypes: FILE_CONSTRAINTS.POST_IMAGE.allowedMimeTypes,
          maxSizeBytes: FILE_CONSTRAINTS.POST_IMAGE.maxSizeBytes,
          fieldName: 'images',
        },
        10 // Max 10 images
      );

      if (!validation.isValid) {
        HttpErrors.badRequest(res, validation.error || 'Invalid files');
        return;
      }

      // Normalize to array
      const files = Array.isArray(filesObj) ? filesObj : [filesObj!];

      // Upload all images to Cloudinary in parallel
      const uploadedImages = await uploadMultipleToCloudinary(
        files,
        CLOUDINARY_PRESETS.POST,
        (index) => `post_${userId}_${Date.now()}_${index}`
      );

      // Save to database
      const caption = req.body?.caption?.trim() || null;
      const locationId = req.body?.locationId?.trim() || null;

      const dbPromises = uploadedImages.map((image) =>
        this.prisma.post.create({
          data: {
            userId,
            mediaUrl: image.url,
            mediaType: 'PHOTO',
            caption,
            locationId,
          },
          select: {
            id: true,
            userId: true,
            mediaUrl: true,
            mediaType: true,
            caption: true,
            locationId: true,
            createdAt: true,
          },
        })
      );

      const posts = await Promise.all(dbPromises);

      res.status(201).json(
        makeSuccessResponse(
          {
            posts,
            count: posts.length,
            uploadedImages: uploadedImages.map((img) => ({
              url: img.url,
              originalName: img.originalName,
            })),
          },
          `${posts.length} image${posts.length > 1 ? 's' : ''} uploaded successfully`,
          201
        )
      );
    } catch (err) {
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
          location: {
            select: {
              id: true,
              name: true,
              category: true,
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

      // Delete image from Cloudinary
      if (post.mediaUrl) {
        await deleteFromCloudinary(post.mediaUrl);
      }

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
   * Get posts feed with cursor pagination
   * GET /posts/feed?limit=10&cursor=postId
   */
  public getFeed = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      const { limit, cursor } = parsePaginationParams(req.query as any);
      const cursorQuery = buildCursorQuery({ limit, cursor });

      const posts = await this.prisma.post.findMany({
        ...cursorQuery,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
              category: true,
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

      // Add user interaction flags if authenticated
      let postsWithInteraction = posts.map((post) => ({
        ...post,
        isLiked: false,
        isBookmarked: false,
      }));

      if (userId && posts.length > 0) {
        const postIds = posts.map((post) => post.id);

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

        postsWithInteraction = posts.map((post) => ({
          ...post,
          isLiked: likedPostIds.has(post.id),
          isBookmarked: bookmarkedPostIds.has(post.id),
        }));
      }

      HttpSuccess.ok(
        res,
        {
          posts: postsWithInteraction,
          pagination: buildPaginationResponse(posts, limit),
        },
        'Feed retrieved successfully'
      );
    } catch (err) {
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
