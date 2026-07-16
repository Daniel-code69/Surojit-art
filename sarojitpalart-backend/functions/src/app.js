const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { config } = require('./config');
const { AuthError, ForbiddenError } = require('./middleware/auth');

const app = express();

// CORS
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));

// Global rate limit: 100 req/min per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(globalLimiter);

// Parse JSON bodies (but NOT for webhooks - those need raw body)
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Routes
const adminAuthRoutes = require('./admin/auth');
const adminStatsRoutes = require('./admin/stats');
const studentProfileRoutes = require('./student/profile');
const categoryRoutes = require('./categories');
const courseRoutes = require('./courses/index');
const lessonRoutes = require('./courses/lessons');
const paymentCreateRoutes = require('./payments/createOrder');
const paymentVerifyRoutes = require('./payments/verifyPayment');
const paymentWebhookRoutes = require('./payments/webhook');
const enrollmentRoutes = require('./enrollments/index');
const reviewRoutes = require('./reviews/index');
const uploadRoutes = require('./uploads/index');

// Mount routes
app.use('/api/v1/admin/auth', adminAuthRoutes);
app.use('/api/v1/admin/stats', adminStatsRoutes);
app.use('/api/v1/student', studentProfileRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/courses', lessonRoutes);
app.use('/api/v1/payments', paymentCreateRoutes);
app.use('/api/v1/payments/verify', paymentVerifyRoutes);
app.use('/api/v1/payments/webhook', paymentWebhookRoutes);
app.use('/api/v1/enrollments', enrollmentRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/uploads', uploadRoutes);

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err instanceof AuthError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  if (err instanceof ForbiddenError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  if (err.code === 'NOT_FOUND') {
    return res.status(404).json({ error: 'Resource not found' });
  }
  if (err.name === 'ZodError') {
    return res.status(422).json({
      error: 'Validation failed',
      details: err.errors,
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
  });
});

module.exports = app;
