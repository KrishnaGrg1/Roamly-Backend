import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

interface IvalidatonSchema {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
  headers?: ZodSchema;
}

const validate = (validateSchema: IvalidatonSchema = {}) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { body, params, query, headers } = validateSchema;

    try {
      if (body) {
        req.body = body.parse(req.body);
      }
      if (params) {
        req.params = params.parse(req.params) as any;
      }
      if (query) {
        req.query = query.parse(req.query) as any;
      }
      if (headers) {
        req.headers = headers.parse(req.headers) as any;
      }
      next();
    } catch (e: any) {
      if (e.errors && Array.isArray(e.errors)) {
        // Zod validation error
        const errors = e.errors.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        res.status(400).json({
          message: 'Validation failed',
          errors,
        });
      } else if (e instanceof Error) {
        res.status(400).json({
          message: e.message,
        });
      } else {
        res.status(500).json({
          message: 'Validation error occurred',
        });
      }
    }
  };
};

export default validate;
