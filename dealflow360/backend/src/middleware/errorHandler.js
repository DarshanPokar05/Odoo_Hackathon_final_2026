'use strict';

const { ZodError } = require('zod');

/**
 * Global error handler — must be registered LAST in app.js (after all routes).
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Zod validation errors → 422
  if (err instanceof ZodError) {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  // Prisma known errors
  if (err.code) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'A record with this value already exists.' },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Record not found.' },
      });
    }
  }

  // Generic fallback
  const statusCode = err.statusCode || err.status || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message || 'Internal server error';

  if (statusCode === 500) {
    console.error('[ErrorHandler]', err);
  }

  return res.status(statusCode).json({
    success: false,
    error: { code: err.code || 'SERVER_ERROR', message },
  });
}

module.exports = { errorHandler };
