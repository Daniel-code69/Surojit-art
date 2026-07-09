const express = require('express');
const { z } = require('zod');
const { admin, db } = require('../config');
const { validate } = require('../middleware/validate');
const { verifyAdmin, verifyStudent } = require('../middleware/auth');

const router = express.Router();

// GET /reviews - Public: approved reviews
router.get('/', async (req, res, next) => {
  try {
    let query = db.collection('reviews')
      .where('approved', '==', true)
      .orderBy('createdAt', 'desc');

    const snapshot = await query.get();
    const reviews = [];
    snapshot.forEach((doc) => {
      reviews.push({ id: doc.id, ...doc.data() });
    });

    res.json(reviews);
  } catch (err) {
    next(err);
  }
});

// POST /reviews - Student: create review
router.post('/', verifyStudent, validate(z.object({
  courseId: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1).max(1000),
})), async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const studentDoc = await db.collection('students').doc(uid).get();

    if (!studentDoc.exists) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const studentData = studentDoc.data();

    const reviewData = {
      studentId: uid,
      studentName: studentData.name,
      courseId: req.body.courseId || null,
      rating: req.body.rating,
      text: req.body.text,
      approved: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection('reviews').add(reviewData);
    res.status(201).json({ id: ref.id, ...reviewData });
  } catch (err) {
    next(err);
  }
});

// GET /reviews/pending - Admin: unapproved reviews
router.get('/pending', verifyAdmin, async (req, res, next) => {
  try {
    const snapshot = await db.collection('reviews')
      .where('approved', '==', false)
      .orderBy('createdAt', 'desc')
      .get();

    const reviews = [];
    snapshot.forEach((doc) => {
      reviews.push({ id: doc.id, ...doc.data() });
    });

    res.json(reviews);
  } catch (err) {
    next(err);
  }
});

// PATCH /reviews/:id/approve - Admin: approve review
router.patch('/:id/approve', verifyAdmin, async (req, res, next) => {
  try {
    await db.collection('reviews').doc(req.params.id).update({
      approved: true,
    });
    res.json({ message: 'Review approved' });
  } catch (err) {
    next(err);
  }
});

// DELETE /reviews/:id - Admin: delete review
router.delete('/:id', verifyAdmin, async (req, res, next) => {
  try {
    await db.collection('reviews').doc(req.params.id).delete();
    res.json({ message: 'Review deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
