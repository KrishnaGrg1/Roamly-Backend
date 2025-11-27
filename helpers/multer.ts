import multer, { type StorageEngine } from 'multer';
import cloudinary from '../config/cloudnary';
import type { Request } from 'express';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Interfaces
interface ICloudinaryStorageParams {
  folder: string;
  allowed_formats?: string[];
  transformation?: Array<{
    width?: number;
    height?: number;
    crop?: string;
  }>;
  resource_type?: 'image' | 'video' | 'raw' | 'auto';
}

interface IFileFilter {
  (
    req: Request,
    file: Express.Multer.File,
    callback: multer.FileFilterCallback
  ): void;
}

interface IUploadOptions {
  folder: string;
  allowedFormats?: string[];
  allowedMimeTypes?: string[];
  maxFileSize?: number;
  maxFiles?: number;
  transformation?: Array<{
    width?: number;
    height?: number;
    crop?: string;
  }>;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
}

// File type constants
export const FILE_TYPES = {
  IMAGE: {
    mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  VIDEO: {
    mimes: [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
    ],
    formats: ['mp4', 'mpeg', 'mov', 'avi', 'webm'],
    maxSize: 100 * 1024 * 1024, // 100MB
  },
  DOCUMENT: {
    mimes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    formats: ['pdf', 'doc', 'docx'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  ALL: {
    mimes: [] as string[],
    formats: [] as string[],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
};

// Create storage
const createStorage = (options: IUploadOptions): StorageEngine => {
  const params: any = {
    folder: options.folder,
    resource_type: options.resourceType || 'auto',
  };

  if (options.allowedFormats && options.allowedFormats.length > 0) {
    params.allowed_formats = options.allowedFormats;
  }

  if (options.transformation && options.transformation.length > 0) {
    params.transformation = options.transformation;
  }

  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: params,
  });
};

// Create file filter
const createFileFilter = (
  allowedMimeTypes?: string[],
  errorMessage?: string
): IFileFilter => {
  return (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    if (!allowedMimeTypes || allowedMimeTypes.length === 0) {
      cb(null, true);
      return;
    }

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          errorMessage ||
            `Invalid file type. Only ${allowedMimeTypes.join(', ')} are allowed.`
        )
      );
    }
  };
};

// Main upload function
export const uploadFile = (options: IUploadOptions) => {
  const storage = createStorage(options);
  const fileFilter = createFileFilter(
    options.allowedMimeTypes,
    `Invalid file type. Only ${options.allowedFormats?.join(', ')} files are allowed.`
  );

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: options.maxFileSize,
      files: options.maxFiles,
    },
  });
};

// Preset configurations
export const uploadProfilePicture = uploadFile({
  folder: 'roamly/profiles',
  allowedFormats: FILE_TYPES.IMAGE.formats,
  allowedMimeTypes: FILE_TYPES.IMAGE.mimes,
  maxFileSize: FILE_TYPES.IMAGE.maxSize,
  transformation: [{ width: 500, height: 500, crop: 'limit' }],
  resourceType: 'image',
});

export const uploadPostImage = uploadFile({
  folder: 'roamly/posts',
  allowedFormats: FILE_TYPES.IMAGE.formats,
  allowedMimeTypes: FILE_TYPES.IMAGE.mimes,
  maxFileSize: FILE_TYPES.IMAGE.maxSize,
  maxFiles: 10,
  resourceType: 'image',
});

export const uploadVideo = uploadFile({
  folder: 'roamly/videos',
  allowedFormats: FILE_TYPES.VIDEO.formats,
  allowedMimeTypes: FILE_TYPES.VIDEO.mimes,
  maxFileSize: FILE_TYPES.VIDEO.maxSize,
  resourceType: 'video',
});

export const uploadDocument = uploadFile({
  folder: 'roamly/documents',
  allowedFormats: FILE_TYPES.DOCUMENT.formats,
  allowedMimeTypes: FILE_TYPES.DOCUMENT.mimes,
  maxFileSize: FILE_TYPES.DOCUMENT.maxSize,
  resourceType: 'raw',
});

// Helper function to delete files from Cloudinary
export const deleteFile = async (publicId: string) => {
  try {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
  }
};
