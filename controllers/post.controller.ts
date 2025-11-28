import type { Response } from 'express';
import type { UploadedFile } from 'express-fileupload';
import type { AuthRequest } from '../middlewares/auth.middleware';
import type { PrismaClient } from '../generated/prisma/client';
import {
  makeSuccessResponse,
  makeErrorResponse,
} from '../helpers/standardResponse';
import {
  validateFile,
  validateFiles,
  fileToDataUri,
  FILE_CONSTRAINTS,
} from '../helpers/fileValidator';
import cloudinary from '../config/cloudnary';
import { prisma } from '../config/db';
import { success } from 'zod';

class PostController {
  constructor(private readonly prisma: PrismaClient) {}

  public createPost = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      const filesObj = req.files?.images;

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
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error(validation.error),
              validation.error || 'Invalid files',
              400
            )
          );
        return;
      }

      // Normalize to array
      const files = Array.isArray(filesObj) ? filesObj : [filesObj!];

      // Upload all images to Cloudinary in parallel
      const uploadPromises = files.map(async (file, index) => {
        const dataUri = fileToDataUri(file);

        const cloudResult = await cloudinary.uploader.upload(dataUri, {
          folder: 'roamly/posts',
          transformation: [
            {
              width: 1200,
              height: 1200,
              crop: 'limit',
              quality: 'auto:good',
              fetch_format: 'auto',
            },
          ],
          public_id: `post_${userId}_${Date.now()}_${index}`,
        });

        return {
          url: cloudResult.secure_url,
          publicId: cloudResult.public_id,
          originalName: file.name,
          size: file.size,
        };
      });

      const uploadedImages = await Promise.all(uploadPromises);

      // Save to database - create a post for each image
      const caption = req.body.caption?.trim() || null;
      const locationId = req.body.locationId?.trim() || null;

      const dbPromises = uploadedImages.map((image) =>
        this.prisma.post.create({
          data: {
            userId: userId,
            mediaUrl: image.url,
            mediaType: 'PHOTO',
            caption: caption,
            locationId: locationId,
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
      console.error('Post images upload error:', err);
      res
        .status(500)
        .json(
          makeErrorResponse(
            err instanceof Error ? err : new Error('Upload failed'),
            'Failed to upload post images',
            500
          )
        );
    }
  };
  public extractPublicId(url: string): string | null {
    try {
      const parts = url.split('/');
      const uploadIndex = parts.findIndex((part) => part === 'upload');
      if (uploadIndex !== -1 && parts.length > uploadIndex + 1) {
        const pathAfterUpload = parts.slice(uploadIndex + 2).join('/');
        return pathAfterUpload.replace(/\.[^/.]+$/, '');
      }
      return null;
    } catch (error) {
      console.error('Error extracting public_id:', error);
      return null;
    }
  }
  public getPostById = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const existingPost = await this.prisma.post.findUnique({
        where: {
          id: req.params.id,
        },
      });
      if (!existingPost) {
        res
          .status(404)
          .json(
            makeErrorResponse(
              new Error('Post not found!'),
              'Post not found',
              404
            )
          );
        return;
      }
      res
        .status(200)
        .json(
          makeSuccessResponse(existingPost, 'Post retrieved successfully', 200)
        );
      return;
    } catch (err) {
      console.error('Post images upload error:', err);
      res
        .status(500)
        .json(
          makeErrorResponse(
            err instanceof Error ? err : new Error('Upload failed'),
            'Failed to upload post images',
            500
          )
        );
    }
  };

  public deletePostById = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const existingPost = await this.prisma.post.findUnique({
        where: {
          id: req.params.id,
          userId: req?.userId,
        },
      });
      if (!existingPost) {
        res
          .status(404)
          .json(
            makeErrorResponse(
              new Error('Post not found!'),
              'Post not found',
              404
            )
          );
        return;
      }
      await this.prisma.post.delete({
        where: {
          id: req.params.id,
          userId: req?.userId,
        },
      });
      res.status(200).json(
        makeSuccessResponse(
          {
            success: true,
            id: req?.params.id,
          },
          'Post deleted successfully',
          200
        )
      );
      return;
    } catch (err) {
      console.error('Post images upload error:', err);
      res
        .status(500)
        .json(
          makeErrorResponse(
            err instanceof Error ? err : new Error('Upload failed'),
            'Failed to upload post images',
            500
          )
        );
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

      if (!postId) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('Post ID required'),
              'Post ID is required',
              400
            )
          );
        return;
      }

      // Check if post exists
      const existingPost = await this.prisma.post.findUnique({
        where: { id: postId },
      });

      if (!existingPost) {
        res
          .status(404)
          .json(
            makeErrorResponse(
              new Error('Post not found!'),
              'Post not found',
              404
            )
          );
        return;
      }

      // Check if user already liked this post
      const existingLike = await this.prisma.like.findFirst({
        where: {
          postId: postId,
          userId: userId,
        },
      });

      if (existingLike) {
        res
          .status(409)
          .json(
            makeErrorResponse(
              new Error('Already liked'),
              'You have already liked this post',
              409
            )
          );
        return;
      }

      // Create like
      await this.prisma.like.create({
        data: {
          postId: postId,
          userId: userId,
        },
      });

      // Get updated like count
      const likeCount = await this.prisma.like.count({
        where: { postId: postId },
      });

      res.status(201).json(
        makeSuccessResponse(
          {
            liked: true,
            postId: postId,
            likeCount: likeCount,
          },
          'Post liked successfully',
          201
        )
      );
    } catch (err) {
      console.error('Like post error:', err);
      res
        .status(500)
        .json(
          makeErrorResponse(
            err instanceof Error ? err : new Error('Like failed'),
            'Failed to like post',
            500
          )
        );
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

      if (!postId) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('Post ID required'),
              'Post ID is required',
              400
            )
          );
        return;
      }

      // Check if post exists
      const existingPost = await this.prisma.post.findUnique({
        where: { id: postId },
      });

      if (!existingPost) {
        res
          .status(404)
          .json(
            makeErrorResponse(
              new Error('Post not found!'),
              'Post not found',
              404
            )
          );
        return;
      }

      // Check if user has liked this post
      const existingLike = await this.prisma.like.findFirst({
        where: {
          postId: postId,
          userId: userId,
        },
      });

      if (!existingLike) {
        res
          .status(404)
          .json(
            makeErrorResponse(
              new Error('Like not found'),
              'You have not liked this post',
              404
            )
          );
        return;
      }

      // Delete like
      await this.prisma.like.delete({
        where: { id: existingLike.id },
      });

      // Get updated like count
      const likeCount = await this.prisma.like.count({
        where: { postId: postId },
      });

      res.status(200).json(
        makeSuccessResponse(
          {
            liked: false,
            postId: postId,
            likeCount: likeCount,
          },
          'Post unliked successfully',
          200
        )
      );
    } catch (err) {
      console.error('Unlike post error:', err);
      res
        .status(500)
        .json(
          makeErrorResponse(
            err instanceof Error ? err : new Error('Unlike failed'),
            'Failed to unlike post',
            500
          )
        );
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

      if (!postId) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('Post ID required'),
              'Post ID is required',
              400
            )
          );
        return;
      }

      // Check if post exists
      const existingPost = await this.prisma.post.findUnique({
        where: { id: postId },
      });

      if (!existingPost) {
        res
          .status(404)
          .json(
            makeErrorResponse(
              new Error('Post not found!'),
              'Post not found',
              404
            )
          );
        return;
      }

      // Check if user already bookmarked this post
      const existingBookmark = await this.prisma.bookmark.findFirst({
        where: {
          postId: postId,
          userId: userId,
        },
      });

      if (existingBookmark) {
        res
          .status(409)
          .json(
            makeErrorResponse(
              new Error('Already bookmarked'),
              'You have already bookmarked this post',
              409
            )
          );
        return;
      }

      // Create bookmark
      const bookmark = await this.prisma.bookmark.create({
        data: {
          postId: postId,
          userId: userId,
        },
        select: {
          id: true,
          postId: true,
          userId: true,
          createdAt: true,
        },
      });

      res.status(201).json(
        makeSuccessResponse(
          {
            bookmarked: true,
            bookmark: bookmark,
          },
          'Post bookmarked successfully',
          201
        )
      );
    } catch (err) {
      console.error('Bookmark post error:', err);
      res
        .status(500)
        .json(
          makeErrorResponse(
            err instanceof Error ? err : new Error('Bookmark failed'),
            'Failed to bookmark post',
            500
          )
        );
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

      if (!postId) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('Post ID required'),
              'Post ID is required',
              400
            )
          );
        return;
      }

      // Check if post exists
      const existingPost = await this.prisma.post.findUnique({
        where: { id: postId },
      });

      if (!existingPost) {
        res
          .status(404)
          .json(
            makeErrorResponse(
              new Error('Post not found!'),
              'Post not found',
              404
            )
          );
        return;
      }

      // Check if user has bookmarked this post
      const existingBookmark = await this.prisma.bookmark.findFirst({
        where: {
          postId: postId,
          userId: userId,
        },
      });

      if (!existingBookmark) {
        res
          .status(404)
          .json(
            makeErrorResponse(
              new Error('Bookmark not found'),
              'You have not bookmarked this post',
              404
            )
          );
        return;
      }

      // Delete bookmark
      await this.prisma.bookmark.delete({
        where: { id: existingBookmark.id },
      });

      res.status(200).json(
        makeSuccessResponse(
          {
            bookmarked: false,
            postId: postId,
          },
          'Bookmark removed successfully',
          200
        )
      );
    } catch (err) {
      console.error('Unbookmark post error:', err);
      res
        .status(500)
        .json(
          makeErrorResponse(
            err instanceof Error ? err : new Error('Unbookmark failed'),
            'Failed to remove bookmark',
            500
          )
        );
    }
  };

  /**
   * Get posts feed with cursor pagination
   * GET /posts/feed?limit=10&cursor=postId
   * Best for reels/infinite scroll - smooth scrolling experience
   */
  public getFeed = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      const limit = Math.min(Number(req.query.limit) || 10, 50); // Max 50 per request
      const cursor = req.query.cursor as string | undefined;

      // Build cursor query
      const cursorQuery = cursor ? { id: cursor } : undefined;

      const posts = await this.prisma.post.findMany({
        take: limit,
        skip: cursor ? 1 : 0, // Skip the cursor post itself
        cursor: cursorQuery,
        orderBy: {
          createdAt: 'desc',
        },
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

      // Check if current user liked/bookmarked each post
      let postsWithUserInteraction = posts;

      if (userId) {
        const postIds = posts.map((post) => post.id);

        // Get user's likes and bookmarks for these posts
        const [userLikes, userBookmarks] = await Promise.all([
          this.prisma.like.findMany({
            where: {
              userId: userId,
              postId: { in: postIds },
            },
            select: { postId: true },
          }),
          this.prisma.bookmark.findMany({
            where: {
              userId: userId,
              postId: { in: postIds },
            },
            select: { postId: true },
          }),
        ]);

        const likedPostIds = new Set(userLikes.map((l) => l.postId));
        const bookmarkedPostIds = new Set(userBookmarks.map((b) => b.postId));

        postsWithUserInteraction = posts.map((post) => ({
          ...post,
          isLiked: likedPostIds.has(post.id),
          isBookmarked: bookmarkedPostIds.has(post.id),
        }));
      }

      // Calculate next cursor
      const nextCursor =
        posts.length === limit ? posts[posts.length - 1]?.id : null;
      const hasMore = posts.length === limit;

      res.status(200).json(
        makeSuccessResponse(
          {
            posts: postsWithUserInteraction,
            pagination: {
              nextCursor,
              hasMore,
              count: posts.length,
            },
          },
          'Feed retrieved successfully',
          200
        )
      );
    } catch (err) {
      console.error('Get feed error:', err);
      res
        .status(500)
        .json(
          makeErrorResponse(
            err instanceof Error ? err : new Error('Feed failed'),
            'Failed to retrieve feed',
            500
          )
        );
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
      const limit = Math.min(Number(req.query.limit) || 10, 50);
      const cursor = req.query.cursor as string | undefined;

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

      const bookmarks = await this.prisma.bookmark.findMany({
        where: { userId: userId },
        take: limit,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
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

      const nextCursor =
        bookmarks.length === limit ? bookmarks[bookmarks.length - 1]?.id : null;
      const hasMore = bookmarks.length === limit;

      res.status(200).json(
        makeSuccessResponse(
          {
            posts,
            pagination: {
              nextCursor,
              hasMore,
              count: posts.length,
            },
          },
          'Bookmarked posts retrieved successfully',
          200
        )
      );
    } catch (err) {
      console.error('Get bookmarks error:', err);
      res
        .status(500)
        .json(
          makeErrorResponse(
            err instanceof Error ? err : new Error('Bookmarks failed'),
            'Failed to retrieve bookmarked posts',
            500
          )
        );
    }
  };
}

export default new PostController(prisma);
