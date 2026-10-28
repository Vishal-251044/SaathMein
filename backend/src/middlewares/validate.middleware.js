/**
 * Request validation with Zod. Routes pass a schema object with optional
 * `body`, `query` and `params` Zod schemas; parsed (clean) values replace the raw ones.
 */
const ApiError = require('../utils/ApiError');

/**
 * Build a validation middleware.
 * @param {{ body?: import('zod').ZodType, query?: import('zod').ZodType, params?: import('zod').ZodType }} schemas
 * @returns {Function} Express middleware that responds 422 with field errors on failure
 */
const validate = (schemas) => (req, res, next) => {
  const details = [];

  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;

    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      result.error.issues.forEach((issue) =>
        details.push({ in: part, field: issue.path.join('.'), message: issue.message }),
      );
      continue;
    }

    // Express 5 makes req.query a getter, so store parsed query separately
    if (part === 'query') req.validatedQuery = result.data;
    else req[part] = result.data;
  }

  if (details.length) {
    return next(new ApiError(422, 'Some fields are invalid', { details }));
  }
  return next();
};

module.exports = validate;
