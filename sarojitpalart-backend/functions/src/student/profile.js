const express = require('express');
const { z } = require('zod');
const { admin, db } = require('../config');
const { validate } = require('../middleware/validate');
const { verifyStudent } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../email/service');

const router = express.Router();

// POST /student/profile/create - Called after Firebase Auth registration
router.post('/profile/create', validate(z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  uid: z.string(),
})), async (req, res, next) => {
  try {
    const { name, email, uid } = req.body;

    const studentData = {
      name,
      email,
      isVerified: false,
      telegramUserId: null,
      telegramUsername: null,
      enrolledCourseIds: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = db.collection('students').doc(uid);
    const existing = await ref.get();

    if (existing.exists) {
      return res.json({ message: 'Student profile already exists', uid });
    }

    await ref.set(studentData);

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, name);

    res.status(201).json({ message: 'Student profile created', uid });
  } catch (err) {
    next(err);
  }
});

// GET /student/profile - Get own profile
router.get('/profile', verifyStudent, async (req, res, next) => {
  try {
    const doc = await db.collection('students').doc(req.user.uid).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Student profile not found' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    next(err);
  }
});

// PATCH /student/profile - Update profile
router.patch('/profile', verifyStudent, validate(z.object({
  name: z.string().min(1).max(100).optional(),
})), async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('students').doc(req.user.uid).update(updates);
    res.json({ message: 'Profile updated' });
  } catch (err) {
    next(err);
  }
});

// POST /student/connect-telegram - Link Telegram account
router.post('/connect-telegram', verifyStudent, validate(z.object({
  telegramUserId: z.string(),
  telegramUsername: z.string().optional(),
})), async (req, res, next) => {
  try {
    const { telegramUserId, telegramUsername } = req.body;
    const uid = req.user.uid;

    await db.collection('students').doc(uid).update({
      telegramUserId,
      telegramUsername: telegramUsername || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Grant access to all currently enrolled courses
    try {
      const telegramService = require('../telegram/service');
      await telegramService.grantAccessToAllEnrolled(uid);
    } catch (err) {
      console.error('Failed to grant Telegram access after connect:', err);
    }

    res.json({ message: 'Telegram account connected' });
  } catch (err) {
    next(err);
  }
});

// Firebase Auth onCreate trigger (for reference - used in index.js)
async function onStudentCreate(userRecord) {
  const { uid, email, displayName } = userRecord;
  // Only create profile for non-admin users
  const adminDoc = await db.collection('admins').doc(uid).get();
  if (adminDoc.exists) return;

  const studentData = {
    name: displayName || email.split('@')[0],
    email: email || '',
    isVerified: false,
    telegramUserId: null,
    telegramUsername: null,
    enrolledCourseIds: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('students').doc(uid).set(studentData);
  sendWelcomeEmail(email, studentData.name);
}

module.exports = router;
module.exports.onStudentCreate = onStudentCreate;
