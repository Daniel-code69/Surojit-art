const express = require('express');
const { z } = require('zod');
const { admin, db } = require('../config');
const { validate } = require('../middleware/validate');
const { verifyAdmin, verifyStudent } = require('../middleware/auth');
const telegramService = require('../telegram/service');

const router = express.Router();

// GET /enrollments/my - Student: my enrollments
router.get('/my', verifyStudent, async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const snapshot = await db.collection('enrollments')
      .where('studentId', '==', uid)
      .orderBy('enrolledAt', 'desc')
      .get();

    const enrollments = [];
    snapshot.forEach((doc) => {
      enrollments.push({ id: doc.id, ...doc.data() });
    });

    // Join with course data
    const courseIds = [...new Set(enrollments.map((e) => e.courseId))];
    const coursesMap = {};

    if (courseIds.length > 0) {
      const courseSnapshots = await Promise.all(
        courseIds.map((id) => db.collection('courses').doc(id).get())
      );
      courseSnapshots.forEach((doc) => {
        if (doc.exists) {
          coursesMap[doc.id] = { id: doc.id, ...doc.data() };
        }
      });
    }

    const result = enrollments.map((e) => ({
      ...e,
      course: coursesMap[e.courseId] || null,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /enrollments/check/:courseId - Check enrollment status
router.get('/check/:courseId', verifyStudent, async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const studentDoc = await db.collection('students').doc(uid).get();

    if (!studentDoc.exists) {
      return res.json({ enrolled: false });
    }

    const studentData = studentDoc.data();
    const enrolled = studentData.enrolledCourseIds &&
      studentData.enrolledCourseIds.includes(req.params.courseId);

    res.json({ enrolled });
  } catch (err) {
    next(err);
  }
});

// GET /enrollments - Admin: all enrollments (paginated)
router.get('/', verifyAdmin, async (req, res, next) => {
  try {
    const pageSize = Math.min(parseInt(req.query.limit) || 50, 100);
    let query = db.collection('enrollments')
      .orderBy('enrolledAt', 'desc')
      .limit(pageSize);

    if (req.query.courseId) {
      query = query.where('courseId', '==', req.query.courseId);
    }
    if (req.query.startAfter) {
      const startDoc = await db.collection('enrollments').doc(req.query.startAfter).get();
      if (startDoc.exists) {
        query = query.startAfter(startDoc);
      }
    }

    const snapshot = await query.get();
    const enrollments = [];
    snapshot.forEach((doc) => {
      enrollments.push({ id: doc.id, ...doc.data() });
    });

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    res.json({
      enrollments,
      nextCursor: lastDoc ? lastDoc.id : null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /enrollments/manual - Admin: manually enroll a student
router.post('/manual', verifyAdmin, validate(z.object({
  studentId: z.string(),
  courseId: z.string(),
})), async (req, res, next) => {
  try {
    const { studentId, courseId } = req.body;

    // Verify student exists
    const studentDoc = await db.collection('students').doc(studentId).get();
    if (!studentDoc.exists) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Verify course exists
    const courseDoc = await db.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const courseData = courseDoc.data();

    // Check if already enrolled
    const existingEnroll = await db.collection('enrollments')
      .where('studentId', '==', studentId)
      .where('courseId', '==', courseId)
      .limit(1)
      .get();

    if (!existingEnroll.empty) {
      return res.status(409).json({ error: 'Student already enrolled' });
    }

    // Create enrollment
    const enrollmentRef = db.collection('enrollments').doc();
    const batch = db.batch();

    batch.set(enrollmentRef, {
      studentId,
      courseId,
      courseTitle: courseData.title,
      studentEmail: studentDoc.data().email,
      telegramInviteLink: null,
      telegramJoinedAt: null,
      enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.update(db.collection('students').doc(studentId), {
      enrolledCourseIds: admin.firestore.FieldValue.arrayUnion(courseId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.update(db.collection('courses').doc(courseId), {
      enrollmentCount: admin.firestore.FieldValue.increment(1),
    });

    await batch.commit();

    // Grant Telegram access (non-blocking)
    try {
      const link = await telegramService.grantChannelAccess(studentId, courseId);
      if (link) {
        await enrollmentRef.update({ telegramInviteLink: link });
      }
    } catch (telErr) {
      console.error('Manual enrollment Telegram grant failed:', telErr);
    }

    res.status(201).json({
      message: 'Student enrolled successfully',
      enrollmentId: enrollmentRef.id,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /enrollments/:enrollmentId - Admin: remove enrollment
router.delete('/:enrollmentId', verifyAdmin, async (req, res, next) => {
  try {
    const enrollmentDoc = await db.collection('enrollments')
      .doc(req.params.enrollmentId)
      .get();

    if (!enrollmentDoc.exists) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    const enrollmentData = enrollmentDoc.data();
    const { studentId, courseId } = enrollmentData;
    const batch = db.batch();

    // Delete enrollment
    batch.delete(enrollmentDoc.ref);

    // Remove from student
    batch.update(db.collection('students').doc(studentId), {
      enrolledCourseIds: admin.firestore.FieldValue.arrayRemove(courseId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Decrement course count
    batch.update(db.collection('courses').doc(courseId), {
      enrollmentCount: admin.firestore.FieldValue.increment(-1),
    });

    await batch.commit();

    // Revoke Telegram access (non-blocking)
    try {
      await telegramService.revokeChannelAccess(studentId, courseId);
    } catch (telErr) {
      console.error('Telegram revoke failed:', telErr);
    }

    res.json({ message: 'Enrollment removed' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
