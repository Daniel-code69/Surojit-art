const { ZodError } = require('zod');

function validate(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fieldErrors = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(422).json({
          error: 'Validation failed',
          details: fieldErrors,
        });
      }
      next(err);
    }
  };
}

module.exports = { validate };
