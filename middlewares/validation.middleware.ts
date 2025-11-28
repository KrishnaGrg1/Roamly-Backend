import type { NextFunction, Request, Response } from 'express';
import { type ZodSchema, ZodError } from 'zod';
import { makeErrorResponse } from '../helpers/standardResponse';

interface IValidationSchema {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
  headers?: ZodSchema;
}

class ValidationMiddleware {
  /**
   * Validate request data using Zod schemas
   */
  public validate = (validateSchema: IValidationSchema = {}) => {
    return async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      const { body, params, query, headers } = validateSchema;

      try {
        if (body) {
          const validateResult = await body.parseAsync(req.body);
          req.body = validateResult;
        }
        if (params) {
          const validateResult = await params.parseAsync(req.params);
          req.params = validateResult as any;
        }
        if (query) {
          const validateResult = await query.parseAsync(req.query);
          req.query = validateResult as any;
        }
        if (headers) {
          const validateResult = await headers.parseAsync(req.headers);
          req.headers = validateResult as any;
        }
        next();
      } catch (e: any) {
        if (e instanceof ZodError) {
          const errors = e.issues.map((err: any) => ({
            field: err.path.join('.') || 'unknown',
            message: err.message,
          }));
          res.status(400).json({
            message: 'Validation failed',
            errors,
          });
        } else if (e instanceof Error) {
          res.status(400).json(makeErrorResponse(e, 'Validation error', 400));
        } else {
          res
            .status(500)
            .json(
              makeErrorResponse(
                new Error('Unexpected error has occurred'),
                'Unexpected error has occurred',
                500
              )
            );
        }
      }
    };
  };
}

export default new ValidationMiddleware().validate;
