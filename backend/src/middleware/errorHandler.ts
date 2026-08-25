import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'Something went wrong on the server.';

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle Prisma specific errors
    if (err.code === 'P2002') {
      statusCode = 409; // Conflict
      errorCode = 'UNIQUE_CONSTRAINT_FAILED';
      message = 'A unique constraint failed.';
    } else if (err.code === 'P2025') {
      statusCode = 404;
      errorCode = 'RECORD_NOT_FOUND';
      message = 'Record not found.';
    }
  } else if (err.name === 'ZodError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Invalid input data.';
    // Could attach detailed zod errors if needed
  }

  const reqId = req.headers['x-request-id'] as string;

  if (statusCode >= 500) {
    logger.error(`[${reqId}] Unhandled Error: ${err.message}`, { 
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
      err 
    });
  } else if (process.env.NODE_ENV !== 'production') {
    logger.warn(`[${reqId}] Client Error: ${err.message}`, { err });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      requestId: reqId,
      ...(err instanceof ApiError && err.details ? { details: err.details } : {})
    },
  });
};
