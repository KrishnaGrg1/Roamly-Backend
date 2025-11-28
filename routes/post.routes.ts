import { Router } from 'express';
import PostController from '../controllers/post.controller';
import fileUpload from 'express-fileupload';
import postController from '../controllers/post.controller';
import postValidation from '../validation/post.validation';
import validate from '../middlewares/validation.middleware';

const postRoutes = Router();

postRoutes.use(
  fileUpload({
    useTempFiles: false,
    limits: { fileSize: 10 * 1024 * 1024 },
    abortOnLimit: true,
    responseOnLimit: 'File size limit exceeded (max 5MB)',
    parseNested: true,
  })
);

postRoutes.get(
  '/feed',
  validate(postValidation.feedQuery),
  postController.getFeed
);
postRoutes.get(
  '/bookmarks',
  validate(postValidation.bookmarksQuery),
  postController.getBookmarkedPosts
);

postRoutes.post(
  '/',
  validate(postValidation.createPost),
  PostController.createPost
);
postRoutes.get(
  '/:id',
  validate(postValidation.postIdParam),
  PostController.getPostById
);
postRoutes.delete(
  '/:id',
  validate(postValidation.postIdParam),
  PostController.deletePostById
);

// Like/Unlike
postRoutes.post(
  '/:id/like',
  validate(postValidation.postIdParam),
  PostController.likePost
);
postRoutes.delete(
  '/:id/like',
  validate(postValidation.postIdParam),
  PostController.unlikePost
);

// Bookmark/Unbookmark
postRoutes.post(
  '/:id/bookmark',
  validate(postValidation.postIdParam),
  PostController.bookmarkPost
);
postRoutes.delete(
  '/:id/bookmark',
  validate(postValidation.postIdParam),
  PostController.unbookmarkPost
);

export default postRoutes;
