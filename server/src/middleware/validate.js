import { badRequest } from '../utils/ApiError.js';

/** zod validation for body / query / params */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return next(badRequest(details[0]?.message || 'Invalid input', details));
    }
    req[source] = result.data;
    next();
  };
