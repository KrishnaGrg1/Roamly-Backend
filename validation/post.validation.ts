import { z } from 'zod';

class PostValidation {
  /**
   * Validate post creation
   * POST /posts
   */
  createPost = {
    body: z.object({
      caption: z
        .string()
        .max(2000, { message: 'Caption must not exceed 2000 characters' })
        .trim()
        .optional(),
      locationId: z
        .string()
        .uuid({ message: 'Location ID must be a valid UUID' })
        .optional(),
    }),
  };

  /**
   * Validate post ID parameter
   * Used for: GET, DELETE, like, unlike, bookmark, unbookmark
   */
  postIdParam = {
    params: z.object({
      id: z
        .string({ message: 'Post ID is required' })
        .uuid({ message: 'Post ID must be a valid UUID' }),
    }),
  };

  /**
   * Validate feed query parameters
   * GET /posts/feed?limit=10&cursor=uuid
   */
  feedQuery = {
    query: z.object({
      limit: z
        .string()
        .transform((val) => parseInt(val, 10))
        .pipe(
          z
            .number()
            .min(1, { message: 'Limit must be at least 1' })
            .max(50, { message: 'Limit must not exceed 50' })
        )
        .optional(),
      cursor: z
        .string()
        .uuid({ message: 'Cursor must be a valid UUID' })
        .optional(),
    }),
  };

  /**
   * Validate bookmarks query parameters
   * GET /posts/bookmarks?limit=10&cursor=uuid
   */
  bookmarksQuery = {
    query: z.object({
      limit: z
        .string()
        .transform((val) => parseInt(val, 10))
        .pipe(
          z
            .number()
            .min(1, { message: 'Limit must be at least 1' })
            .max(50, { message: 'Limit must not exceed 50' })
        )
        .optional(),
      cursor: z
        .string()
        .uuid({ message: 'Cursor must be a valid UUID' })
        .optional(),
    }),
  };
}

export default new PostValidation();
