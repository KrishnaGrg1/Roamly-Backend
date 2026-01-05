/**
 * Cloudinary upload helper
 * Provides reusable utilities for image uploads
 */

import cloudinary from '../config/cloudnary';
import { fileToDataUri } from './fileValidator';
import type { UploadedFile } from 'express-fileupload';

export interface CloudinaryUploadOptions {
  folder: string;
  publicId?: string;
  width?: number;
  height?: number;
  crop?: string;
  overwrite?: boolean;
}

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  originalName?: string;
  size?: number;
}

/**
 * Default transformation options for different upload types
 */
export const CLOUDINARY_PRESETS = {
  PROFILE: {
    folder: 'roamly/profiles',
    width: 500,
    height: 500,
    crop: 'limit',
  },
  POST: {
    folder: 'roamly/posts',
    width: 1200,
    height: 1200,
    crop: 'limit',
  },
  BUSINESS: {
    folder: 'roamly/business',
    width: 500,
    height: 500,
    crop: 'limit',
  },
} as const;

/**
 * Upload a single image to Cloudinary
 */
export async function uploadToCloudinary(
  file: UploadedFile,
  options: CloudinaryUploadOptions
): Promise<CloudinaryUploadResult> {
  const dataUri = fileToDataUri(file);

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: options.folder,
    transformation: [
      {
        width: options.width || 1200,
        height: options.height || 1200,
        crop: options.crop || 'limit',
        quality: 'auto:good',
        fetch_format: 'auto',
      },
    ],
    public_id: options.publicId,
    overwrite: options.overwrite ?? false,
    invalidate: options.overwrite ?? false,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    originalName: file.name,
    size: file.size,
  };
}

/**
 * Upload multiple images to Cloudinary in parallel
 */
export async function uploadMultipleToCloudinary(
  files: UploadedFile[],
  options: CloudinaryUploadOptions,
  getPublicId?: (index: number) => string
): Promise<CloudinaryUploadResult[]> {
  const uploadPromises = files.map(async (file, index) => {
    const publicId = getPublicId
      ? getPublicId(index)
      : `${options.folder.split('/').pop()}_${Date.now()}_${index}`;

    return uploadToCloudinary(file, {
      ...options,
      publicId,
    });
  });

  return Promise.all(uploadPromises);
}

/**
 * Extract public_id from Cloudinary URL for deletion
 */
export function extractPublicId(url: string): string | null {
  try {
    const parts = url.split('/');
    const uploadIndex = parts.findIndex((part) => part === 'upload');
    if (uploadIndex !== -1 && parts.length > uploadIndex + 1) {
      // Skip version number (v1234567890) and get the rest
      const pathAfterUpload = parts.slice(uploadIndex + 2).join('/');
      // Remove file extension
      return pathAfterUpload.replace(/\.[^/.]+$/, '');
    }
    return null;
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
}

/**
 * Delete an image from Cloudinary by URL
 */
export async function deleteFromCloudinary(url: string): Promise<boolean> {
  try {
    const publicId = extractPublicId(url);
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Failed to delete from Cloudinary:', error);
    return false;
  }
}

/**
 * Delete old image and upload new one (for profile updates, etc.)
 */
export async function replaceCloudinaryImage(
  newFile: UploadedFile,
  oldUrl: string | null | undefined,
  options: CloudinaryUploadOptions
): Promise<CloudinaryUploadResult> {
  // Upload new image
  const result = await uploadToCloudinary(newFile, options);

  // Delete old image if exists and different from new
  if (oldUrl && oldUrl !== result.url) {
    await deleteFromCloudinary(oldUrl);
  }

  return result;
}
