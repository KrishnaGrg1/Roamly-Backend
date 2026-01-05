import type { Response } from 'express';

export interface ApiResponse<T = any> {
  statusCode: number;
  headers?: Record<string, string>;
  success?: boolean;
  body: {
    message: string;
    data?: T;
    error?: string;
  };
}

export function makeSuccessResponse<T>(
  data: T,
  message: string,
  statusCode = 200,
  headers?: Record<string, string>
): ApiResponse<T> {
  return {
    statusCode,
    headers,
    success: true,
    body: {
      message: message,
      data,
    },
  };
}

export function makeErrorResponse(
  error: Error,
  message: string,
  statusCode = 500,
  headers?: Record<string, string>
): ApiResponse {
  return {
    statusCode,
    headers,
    success: false,
    body: {
      message: message,
      error: error.message,
    },
  };
}

/**
 * Common error responses for controllers
 */
export const HttpErrors = {
  unauthorized: (res: Response, message = 'Authentication required') => {
    res.status(401).json(makeErrorResponse(new Error(message), message, 401));
  },

  notFound: (res: Response, resource = 'Resource') => {
    const message = `${resource} not found`;
    res.status(404).json(makeErrorResponse(new Error(message), message, 404));
  },

  badRequest: (res: Response, message: string) => {
    res.status(400).json(makeErrorResponse(new Error(message), message, 400));
  },

  conflict: (res: Response, message: string) => {
    res.status(409).json(makeErrorResponse(new Error(message), message, 409));
  },

  serverError: (res: Response, err: unknown, context = 'Operation') => {
    console.error(`${context} error:`, err);
    const message = `${context} failed`;
    res
      .status(500)
      .json(
        makeErrorResponse(
          err instanceof Error ? err : new Error(message),
          message,
          500
        )
      );
  },
};

/**
 * Success response helper
 */
export const HttpSuccess = {
  ok: <T>(res: Response, data: T, message = 'Success') => {
    res.status(200).json(makeSuccessResponse(data, message, 200));
  },

  created: <T>(res: Response, data: T, message = 'Created successfully') => {
    res.status(201).json(makeSuccessResponse(data, message, 201));
  },

  noContent: (res: Response) => {
    res.status(204).send();
  },
};
