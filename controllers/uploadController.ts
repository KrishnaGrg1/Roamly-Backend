// src/controllers/uploadController.ts
import type { Request, Response } from 'express';
import {
  makeSuccessResponse,
  makeErrorResponse,
} from '../helpers/standardResponse';

// Stronger typing for req.file returned by multer-storage-cloudinary
type MulterFileWithPath = Express.Multer.File & {
  path?: string;
  filename?: string;
  public_id?: string;
};

class UploadController {
  public uploadFile = async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file as MulterFileWithPath | undefined;

      if (!file) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('No file uploaded'),
              'File is required',
              400
            )
          );
        return;
      }

      // multer-storage-cloudinary sets `path` to the uploaded URL
      const url = file.path ?? (file as any).secure_url ?? null;

      if (!url) {
        // Defensive check — Cloudinary storage should provide a URL
        res
          .status(500)
          .json(
            makeErrorResponse(
              new Error('Upload did not return a URL'),
              'Upload failed',
              500
            )
          );
        return;
      }

      res
        .status(200)
        .json(
          makeSuccessResponse(
            { url, originalname: file.originalname, mimetype: file.mimetype },
            'Uploaded',
            200
          )
        );
    } catch (err) {
      console.error('UploadController.uploadFile error:', err);
      res
        .status(500)
        .json(
          makeErrorResponse(
            err instanceof Error ? err : new Error('Upload failed'),
            'Upload failed',
            500
          )
        );
    }
  };

  // Optional: multiple files
  public uploadMultiple = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const files = (req.files as MulterFileWithPath[] | undefined) ?? [];
      if (!files.length) {
        res
          .status(400)
          .json(
            makeErrorResponse(new Error('No files'), 'Files are required', 400)
          );
        return;
      }

      const items = files.map((f) => ({
        url: f.path ?? (f as any).secure_url ?? null,
        originalname: f.originalname,
        mimetype: f.mimetype,
      }));

      res.status(200).json(makeSuccessResponse(items, 'Files uploaded', 200));
    } catch (err) {
      console.error('UploadController.uploadMultiple error:', err);
      res
        .status(500)
        .json(
          makeErrorResponse(
            err instanceof Error ? err : new Error('Upload failed'),
            'Upload failed',
            500
          )
        );
    }
  };
}

export default new UploadController();
