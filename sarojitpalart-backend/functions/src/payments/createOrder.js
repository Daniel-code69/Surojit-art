const express = require('express');
const { z } = require('zod');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const rateLimit = require('express-rate-limit');
const { admin, db, config } = require('../config');
const { validate } = require('../middleware/validate');
const { verifyStudent } = require('../middleware/auth');

const router = express.Router();

// Payment rate limit: 10 req/min per IP for creating orders
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment requests, please try again later' },
});

function getRazorpay() {
  return new Razorpay({
    key_id: config.razorpay.keyId,
    key_secret: config.razorpay.keySecret,
  });
}

function shortUUID() {
  return crypto.randomBytes(8).toString('hex');
}

// Shared handler: enrolls in free courses or creates a Razorpay order for paid ones.
async function createOrderHandler(req, res) {
  const { courseId } = req.body;
  const uid = req.user.uid;

  // Get student
  const studentDoc = await db.collection('students').doc(uid).get();
  if (!studentDoc.exists) {
    return res.status(404).json({ error: 'Student profile not found' });
  }
  const student = studentDoc.data();

  // Check if already enrolled
  if (student.enrolledCourseIds && student.enrolledCourseIds.includes(courseId)) {
    return res.status(409).json({ error: 'Already enrolled in this course' });
  }

  // Get course
  const courseDoc = await db.collection('courses').doc(courseId).get();
  if (!courseDoc.exists) {
    return res.status(404).json({ error: 'Course not found' });
  }
  const course = courseDoc.data();

  if (course.status !== 'PUBLISHED') {
    return res.status(400).json({ error: 'Course is not available' });
  }

  // Calculate amount (in paise)
  const finalPrice = course.discountedPrice || course.price;
  const amountPaise = Math.round(finalPrice * 100);

  // FREE courses: enroll immediately, no Razorpay order required
  if (amountPaise === 0) {
    // Check for existing enrollment
    const existingEnroll = await db.collection('enrollments')
      .where('studentId', '==', uid)
      .where('courseId', '==', courseId)
      .limit(1)
      .get();

    if (!existingEnroll.empty) {
      return res.status(409).json({ error: 'Already enrolled in this course' });
    }

    const enrollmentRef = db.collection('enrollments').doc();
    const batch = db.batch();

    batch.set(enrollmentRef, {
      studentId: uid,
      courseId,
      courseTitle: course.title,
      studentEmail: student.email,
      enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.update(db.collection('students').doc(uid), {
      enrolledCourseIds: admin.firestore.FieldValue.arrayUnion(courseId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.update(db.collection('courses').doc(courseId), {
      enrollmentCount: admin.firestore.FieldValue.increment(1),
    });

    await batch.commit();

    return res.json({
      free: true,
      success: true,
      message: 'Enrolled in free course',
      enrollmentId: enrollmentRef.id,
      courseId,
    });
  }

  // Create Razorpay order
  const razorpay = getRazorpay();
  const receiptId = `rcpt_${shortUUID()}`;

  const razorpayOrder = await razorpay.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: receiptId,
    notes: {
      studentId: uid,
      courseId,
      studentEmail: student.email,
    },
  });

  // Save order to Firestore
  const orderData = {
    studentId: uid,
    courseId,
    courseTitle: course.title,
    amount: course.discountedPrice || course.price,
    currency: 'INR',
    razorpayOrderId: razorpayOrder.id,
    razorpayPaymentId: null,
    razorpaySignature: null,
    status: 'CREATED',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('orders').add(orderData);

  return res.json({
    razorpayOrderId: razorpayOrder.id,
    amount: amountPaise,
    currency: 'INR',
    courseTitle: course.title,
    keyId: config.razorpay.keyId,
  });
}

// POST /payments/create-order
router.post('/create-order', paymentLimiter, verifyStudent, validate(z.object({
  courseId: z.string(),
})), async (req, res, next) => {
  try {
    await createOrderHandler(req, res);
  } catch (err) {
    console.error('Razorpay create order error:', err);
    if (err.statusCode === 502) {
      return res.status(502).json({ error: 'Payment service temporarily unavailable' });
    }
    next(err);
  }
});

// Alias: POST /payments (backwards-compat for clients that use the bare path)
router.post('/', paymentLimiter, verifyStudent, validate(z.object({
  courseId: z.string(),
})), async (req, res, next) => {
  try {
    await createOrderHandler(req, res);
  } catch (err) {
    console.error('Razorpay create order error:', err);
    if (err.statusCode === 502) {
      return res.status(502).json({ error: 'Payment service temporarily unavailable' });
    }
    next(err);
  }
});

// GET /payments/my-orders
router.get('/my-orders', verifyStudent, async (req, res, next) => {
  try {
    const snapshot = await db.collection('orders')
      .where('studentId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .get();

    const orders = [];
    snapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() });
    });

    res.json(orders);
  } catch (err) {
    next(err);
  }
});

module.exports = router;