const express = require('express');
const { z } = require('zod');
const { admin, db } = require('../config');
const { validate } = require('../middleware/validate');
const { verifyAdmin, verifyStudent } = require('../middleware/auth');

const router = express.Router();

const courseSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().optional(),
  description: z.string().min(1),
  shortDescription: z.string().min(1).max(300),
  thumbnail: z.string().optional(),
  price: z.number().min(0),
  discountedPrice: z.number().min(0).nullable().optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  categoryId: z.string(),
  categoryName: z.string().optional(),
  telegramChannelId: z.string().optional(),
});

function generateSlug(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

// GET /courses - Public: list published courses
router.get('/', async (req, res, next) => {
  try {
    let query = db.collection('courses').where('status', '==', 'PUBLISHED');

    // Filters
    if (req.query.category) {
      query = query.where('categoryId', '==', req.query.category);
    }
    if (req.query.level) {
      query = query.where('level', '==', req.query.level);
    }

    // Sorting
    const sortFieldMap = {
      newest: { field: 'createdAt', dir: 'desc' },
      popularity: { field: 'enrollmentCount', dir: 'desc' },
      'price-low': { field: 'price', dir: 'asc' },
      'price-high': { field: 'price', dir: 'desc' },
    };

    const sort = sortFieldMap[req.query.sort] || sortFieldMap.newest;
    query = query.orderBy(sort.field, sort.dir);

    const snapshot = await query.get();
    let courses = [];
    snapshot.forEach((doc) => {
      courses.push({ id: doc.id, ...doc.data() });
    });

    // Client-side text search
    if (req.query.search) {
      const search = req.query.search.toLowerCase();
      courses = courses.filter((c) =>
        c.title.toLowerCase().includes(search) ||
        c.shortDescription.toLowerCase().includes(search)
      );
    }

    // Price filter
    if (req.query.price === 'free') {
      courses = courses.filter((c) => c.price === 0);
    } else if (req.query.price === 'paid') {
      courses = courses.filter((c) => c.price > 0);
    }

    res.json(courses);
  } catch (err) {
    next(err);
  }
});

// GET /courses/:courseId - Public: single course
router.get('/:courseId', async (req, res, next) => {
  try {
    const doc = await db.collection('courses').doc(req.params.courseId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const data = doc.data();
    if (data.status !== 'PUBLISHED') {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(404).json({ error: 'Course not found' });
      }
    }
    res.json({ id: doc.id, ...data });
  } catch (err) {
    next(err);
  }
});

// POST /courses - Admin: create course
router.post('/', verifyAdmin, validate(courseSchema), async (req, res, next) => {
  try {
    const slug = req.body.slug || generateSlug(req.body.title);
    const data = {
      ...req.body,
      slug,
      discountedPrice: req.body.discountedPrice || null,
      enrollmentCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection('courses').add(data);
    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    next(err);
  }
});

// PUT /courses/:courseId - Admin: update course
router.put('/:courseId', verifyAdmin, validate(courseSchema.partial()), async (req, res, next) => {
  try {
    const updates = { ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (updates.title && !updates.slug) {
      updates.slug = generateSlug(updates.title);
    }
    await db.collection('courses').doc(req.params.courseId).update(updates);
    res.json({ message: 'Course updated' });
  } catch (err) {
    next(err);
  }
});

// DELETE /courses/:courseId - Admin: soft delete
router.delete('/:courseId', verifyAdmin, async (req, res, next) => {
  try {
    await db.collection('courses').doc(req.params.courseId).update({
      status: 'DRAFT',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ message: 'Course moved to draft' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
