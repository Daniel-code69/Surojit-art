const express = require('express');
const { z } = require('zod');
const { admin, db } = require('../config');
const { validate } = require('../middleware/validate');
const { verifyAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /categories - Public: all categories with course counts
router.get('/', async (req, res, next) => {
  try {
    const snapshot = await db.collection('categories')
      .orderBy('createdAt', 'desc')
      .get();

    const categories = [];
    snapshot.forEach((doc) => {
      categories.push({ id: doc.id, ...doc.data() });
    });

    // Get course counts for each category
    const courseCounts = {};
    const coursesSnap = await db.collection('courses').get();
    coursesSnap.forEach((doc) => {
      const catId = doc.data().categoryId;
      if (catId) {
        courseCounts[catId] = (courseCounts[catId] || 0) + 1;
      }
    });

    const result = categories.map((cat) => ({
      ...cat,
      courseCount: courseCounts[cat.id] || 0,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /categories - Admin only
router.post('/', verifyAdmin, validate(z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).optional(),
})), async (req, res, next) => {
  try {
    const slug = req.body.slug || req.body.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const data = {
      name: req.body.name,
      slug,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection('categories').add(data);
    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    next(err);
  }
});

// PUT /categories/:id - Admin only
router.put('/:id', verifyAdmin, validate(z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).optional(),
})), async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.slug) updates.slug = req.body.slug;

    await db.collection('categories').doc(req.params.id).update(updates);
    res.json({ message: 'Category updated' });
  } catch (err) {
    next(err);
  }
});

// DELETE /categories/:id - Admin only
router.delete('/:id', verifyAdmin, async (req, res, next) => {
  try {
    // Check if any course uses this category
    const coursesSnap = await db.collection('courses')
      .where('categoryId', '==', req.params.id)
      .limit(1)
      .get();

    if (!coursesSnap.empty) {
      return res.status(409).json({
        error: 'Cannot delete category: it is used by one or more courses',
      });
    }

    await db.collection('categories').doc(req.params.id).delete();
    res.json({ message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
