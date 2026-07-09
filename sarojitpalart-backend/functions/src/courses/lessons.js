const express = require('express');
const { z } = require('zod');
const { admin, db } = require('../config');
const { validate } = require('../middleware/validate');
const { verifyAdmin, verifyStudent } = require('../middleware/auth');

const router = express.Router();

const lessonSchema = z.object({
  title: z.string().min(1).max(200),
  videoUrl: z.string().optional(),
  order: z.number().int().min(0).optional(),
});

// GET /courses/:courseId/lessons - Student: get lessons (enrollment required)
router.get('/:courseId/lessons', verifyStudent, async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const studentDoc = await db.collection('students').doc(uid).get();
    const studentData = studentDoc.data();

    if (!studentData || !studentData.enrolledCourseIds ||
        !studentData.enrolledCourseIds.includes(req.params.courseId)) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    const snapshot = await db.collection('courses')
      .doc(req.params.courseId)
      .collection('lessons')
      .orderBy('order', 'asc')
      .get();

    const lessons = [];
    snapshot.forEach((doc) => {
      lessons.push({ id: doc.id, ...doc.data() });
    });

    res.json(lessons);
  } catch (err) {
    next(err);
  }
});

// POST /courses/:courseId/lessons - Admin: add lesson
router.post('/:courseId/lessons', verifyAdmin, validate(lessonSchema), async (req, res, next) => {
  try {
    const courseId = req.params.courseId;

    // Auto-set order to max + 1
    let order = req.body.order;
    if (order === undefined) {
      const lastLesson = await db.collection('courses')
        .doc(courseId)
        .collection('lessons')
        .orderBy('order', 'desc')
        .limit(1)
        .get();

      if (!lastLesson.empty) {
        order = lastLesson.docs[0].data().order + 1;
      } else {
        order = 0;
      }
    }

    const data = {
      title: req.body.title,
      videoUrl: req.body.videoUrl || '',
      order,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection('courses')
      .doc(courseId)
      .collection('lessons')
      .add(data);

    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    next(err);
  }
});

// PUT /courses/:courseId/lessons/:lessonId - Admin: update lesson
router.put('/:courseId/lessons/:lessonId', verifyAdmin, validate(lessonSchema.partial()), async (req, res, next) => {
  try {
    const updates = { ...req.body };
    await db.collection('courses')
      .doc(req.params.courseId)
      .collection('lessons')
      .doc(req.params.lessonId)
      .update(updates);

    res.json({ message: 'Lesson updated' });
  } catch (err) {
    next(err);
  }
});

// DELETE /courses/:courseId/lessons/:lessonId - Admin: delete lesson
router.delete('/:courseId/lessons/:lessonId', verifyAdmin, async (req, res, next) => {
  try {
    await db.collection('courses')
      .doc(req.params.courseId)
      .collection('lessons')
      .doc(req.params.lessonId)
      .delete();

    res.json({ message: 'Lesson deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /courses/:courseId/lessons/reorder - Admin: reorder lessons
router.post('/:courseId/lessons/reorder', verifyAdmin, validate(z.object({
  orderedIds: z.array(z.string()),
})), async (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    const courseId = req.params.courseId;
    const batch = db.batch();

    orderedIds.forEach((lessonId, index) => {
      const ref = db.collection('courses')
        .doc(courseId)
        .collection('lessons')
        .doc(lessonId);
      batch.update(ref, { order: index });
    });

    await batch.commit();
    res.json({ message: 'Lessons reordered' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
