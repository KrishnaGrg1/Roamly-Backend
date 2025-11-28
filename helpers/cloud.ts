/**
 * File upload configuration constants
 * Note: express-fileupload is configured globally in index.ts
 * This file provides upload limits and constraints
 */

export const UPLOAD_LIMITS = {
  PROFILE_PICTURE: {
    maxSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 1,
  },
  POST_IMAGES: {
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
  },
} as const;
