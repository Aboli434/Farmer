import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError';

export const validateRequest = (schema: ZodSchema<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed.body !== undefined) {
        Object.keys(req.body).forEach(key => delete req.body[key]);
        Object.assign(req.body, parsed.body);
      }
      if (parsed.query !== undefined) {
        Object.keys(req.query).forEach(key => delete (req.query as any)[key]);
        Object.assign(req.query, parsed.query);
      }
      if (parsed.params !== undefined) {
        Object.keys(req.params).forEach(key => delete (req.params as any)[key]);
        Object.assign(req.params, parsed.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ApiError(400, 'BAD_REQUEST', 'Validation failed', error.issues || (error as any).errors));
      } else {
        next(error);
      }
    }
  };
};
