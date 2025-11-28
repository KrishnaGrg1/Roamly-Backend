import type { UploadedFile } from 'express-fileupload';

export interface FileValidationOptions {
  allowedMimeTypes: readonly string[] | string[];
  maxSizeBytes: number;
  fieldName: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const FILE_CONSTRAINTS = {
  PROFILE_PICTURE: {
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  },
  POST_IMAGE: {
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  },
} as const;

export function validateFile(
  file: UploadedFile | undefined | null,
  options: FileValidationOptions
): ValidationResult {
  // Check if file exists
  if (!file) {
    return {
      isValid: false,
      error: `${options.fieldName} is required`,
    };
  }

  // Check file size
  if (file.size > options.maxSizeBytes) {
    const maxSizeMB = (options.maxSizeBytes / (1024 * 1024)).toFixed(1);
    return {
      isValid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    };
  }

  // Check MIME type
  if (!options.allowedMimeTypes.includes(file.mimetype)) {
    const allowedTypes = options.allowedMimeTypes
      .map((type) => type.split('/')[1]?.toUpperCase() || type)
      .join(', ');
    return {
      isValid: false,
      error: `Invalid file type. Allowed: ${allowedTypes}`,
    };
  }

  // Additional check: verify file has data (Bun-specific)
  if (!file.data || file.data.length === 0) {
    return {
      isValid: false,
      error: 'File is empty or corrupted',
    };
  }

  return { isValid: true };
}

export function validateFiles(
  files: UploadedFile | UploadedFile[] | undefined,
  options: FileValidationOptions,
  maxCount: number = 10
): ValidationResult {
  if (!files) {
    return {
      isValid: false,
      error: 'At least one file is required',
    };
  }

  const fileArray = Array.isArray(files) ? files : [files];

  if (fileArray.length === 0) {
    return {
      isValid: false,
      error: 'At least one file is required',
    };
  }

  if (fileArray.length > maxCount) {
    return {
      isValid: false,
      error: `Maximum ${maxCount} files allowed`,
    };
  }

  // Validate each file
  for (let i = 0; i < fileArray.length; i++) {
    const result = validateFile(fileArray[i], {
      ...options,
      fieldName: `${options.fieldName}[${i}]`,
    });

    if (!result.isValid) {
      return result;
    }
  }

  return { isValid: true };
}

export function fileToDataUri(file: UploadedFile): string {
  try {
    const mimeType = file.mimetype;
    const base64 = file.data.toString('base64');

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Buffer conversion error:', error);
    throw new Error(`Failed to convert file to data URI: ${error}`);
  }
}
