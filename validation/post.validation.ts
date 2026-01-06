import { z } from 'zod';

class PostValidation {
  /**
   * Validate post creation from completed trip
   * POST /posts
   */
  createPost = {
    body: z.object({
      tripId: z
        .string({ message: 'Trip ID is required' })
        .uuid({ message: 'Trip ID must be a valid UUID' }),
      caption: z
        .string()
        .max(2000, { message: 'Caption must not exceed 2000 characters' })
        .trim()
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
   * GET /posts/feed?limit=10&cursor=uuid&mode=balanced
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
      mode: z
        .enum(['balanced', 'nearby', 'trek', 'budget'], {
          message: 'Mode must be one of: balanced, nearby, trek, budget',
        })
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
