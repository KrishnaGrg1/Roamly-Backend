import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import {
  uploadProfilePicture,
  uploadPostImage,
  uploadVideo,
} from '../helpers/multer';
import uploadController from '../controllers/uploadController';
import { makeErrorResponse } from '../helpers/standardResponse';

const UploadRoutes = Router();

class UploadErrorHandler {
  static handle(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    if (!err) {
      next();
      return;
    }

    console.error('Upload error:', err);

    const errorMap: Record<string, { message: string; status: number }> = {
      LIMIT_FILE_SIZE: {
        message: 'File size exceeds the maximum allowed limit',
        status: 400,
      },
      LIMIT_FILE_COUNT: {
        message: 'Too many files uploaded',
        status: 400,
      },
      LIMIT_UNEXPECTED_FILE: {
        message: 'Unexpected field in upload',
        status: 400,
      },
    };

    const errorInfo = errorMap[err.code];

    if (errorInfo) {
      res
        .status(errorInfo.status)
        .json(makeErrorResponse(err, errorInfo.message, errorInfo.status));
      return;
    }

    if (err.message?.includes('Invalid file type')) {
      res.status(400).json(makeErrorResponse(err, err.message, 400));
      return;
    }

    res
      .status(500)
      .json(makeErrorResponse(err, err.message || 'File upload failed', 500));
  }
}

// Helper to wrap multer middleware with error handling
const wrapUpload = (uploadMiddleware: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    uploadMiddleware(req, res, (err: any) => {
      UploadErrorHandler.handle(err, req, res, next);
    });
  };
};

// Routes
UploadRoutes.post(
  '/profile',
  wrapUpload(uploadProfilePicture.single('avatar')),
  uploadController.uploadFile
);

UploadRoutes.post(
  '/post',
  wrapUpload(uploadPostImage.array('images', 10)),
  uploadController.uploadMultiple
);

UploadRoutes.post(
  '/video',
  wrapUpload(uploadVideo.single('video')),
  uploadController.uploadFile
);

export default UploadRoutes;
