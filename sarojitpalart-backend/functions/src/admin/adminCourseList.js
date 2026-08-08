const express = require('express');
const { db } = require('../config');
const { verifyAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /admin/courses - Admin: list ALL courses (published + drafts), newest first
router.get('/', verifyAdmin, async (req, res, next) => {
  try {
    const snapshot = await db.collection('courses')
      .orderBy('createdAt', 'desc')
      .get();

    const courses = [];
    snapshot.forEach((doc) => {
      courses.push({ id: doc.id, ...doc.data() });
    });

    res.json(courses);
  } catch (err) {
    next(err);
  }
});

module.exports = router;