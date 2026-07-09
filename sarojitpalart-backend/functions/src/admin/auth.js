const express = require('express');
const { z } = require('zod');
const { admin, auth, db, config } = require('../config');
const { validate } = require('../middleware/validate');
const { verifyAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /admin/auth/setup - One-time admin setup
router.post('/setup', validate(z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
})), async (req, res, next) => {
  try {
    // Check if any admin already exists
    const adminSnapshot = await db.collection('admins').limit(1).get();
    if (!adminSnapshot.empty) {
      return res.status(409).json({ error: 'Admin already exists. Setup can only be run once.' });
    }

    const { email, password, name } = req.body;

    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });

    // Set admin custom claim
    await auth.setCustomUserClaims(userRecord.uid, { admin: true });

    // Create admin doc in Firestore
    await db.collection('admins').doc(userRecord.uid).set({
      email,
      name,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({
      message: 'Admin created successfully',
      uid: userRecord.uid,
      email,
      name,
    });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    next(err);
  }
});

// POST /admin/auth/set-claim - Internal: set admin claim on existing user
router.post('/set-claim', validate(z.object({
  uid: z.string(),
})), async (req, res, next) => {
  try {
    const secret = req.headers['x-admin-setup-secret'];
    if (!secret || secret !== config.adminSetupSecret) {
      return res.status(403).json({ error: 'Invalid setup secret' });
    }

    const { uid } = req.body;
    await auth.setCustomUserClaims(uid, { admin: true });

    res.json({ message: 'Admin claim set', uid });
  } catch (err) {
    next(err);
  }
});

// GET /admin/auth/me - Check current admin status
router.get('/me', verifyAdmin, async (req, res) => {
  res.json({ uid: req.user.uid, email: req.user.email, admin: true });
});

module.exports = router;
