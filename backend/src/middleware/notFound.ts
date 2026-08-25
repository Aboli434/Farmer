import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  next(new ApiError(404, 'NOT_FOUND', `Not Found - ${req.originalUrl}`));
};
