const { auth } = require('../config');

class AuthError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

async function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('No authorization token provided');
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded;
  } catch (err) {
    throw new AuthError('Invalid or expired token');
  }
}

async function verifyAdmin(req, res, next) {
  try {
    const decoded = await verifyToken(req);
    if (!decoded.admin) {
      throw new ForbiddenError('Admin access required');
    }
    req.user = decoded;
    next();
  } catch (err) {
    next(err);
  }
}

async function verifyStudent(req, res, next) {
  try {
    const decoded = await verifyToken(req);
    req.user = decoded;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { verifyAdmin, verifyStudent, AuthError, ForbiddenError };
