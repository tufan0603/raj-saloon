import { env } from '../config/env.js';

export const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';

  if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid id';
  }
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field === 'email' ? 'An account with this email already exists' : `Duplicate value for ${field}`;
  }
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }
  if (err.name === 'MulterError') status = 400;

  if (status >= 500) console.error(err);
  res.status(status).json({
    success: false,
    message,
    ...(err.details ? { details: err.details } : {}),
    ...(env.nodeEnv === 'development' && status >= 500 ? { stack: err.stack } : {}),
  });
};
