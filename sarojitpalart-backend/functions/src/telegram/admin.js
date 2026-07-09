const express = require('express');
const { z } = require('zod');
const { db, config } = require('../config');
const { validate } = require('../middleware/validate');
const { verifyAdmin } = require('../middleware/auth');
const telegramService = require('./service');

const router = express.Router();

// POST /telegram/broadcast - Admin: broadcast message to enrolled students
router.post('/broadcast', verifyAdmin, validate(z.object({
  courseId: z.string(),
  message: z.string().min(1).max(4000),
})), async (req, res, next) => {
  try {
    const { courseId, message } = req.body;
    const result = await telegramService.sendBroadcast(courseId, message);
    res.json({
      message: 'Broadcast completed',
      sent: result.sent,
      failed: result.failed,
    });
  } catch (err) {
    next(err);
  }
});

// GET /telegram/generate-link - Admin: generate Telegram start link for a student
router.post('/generate-link', verifyAdmin, validate(z.object({
  studentId: z.string(),
})), async (req, res, next) => {
  try {
    const { studentId } = req.body;
    const link = `https://t.me/${config.telegram.botUsername}?start=verify_${studentId}`;
    res.json({ link });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
