const express = require('express');
const { z } = require('zod');
const crypto = require('crypto');
const { admin, db, config } = require('../config');
const { validate } = require('../middleware/validate');
const { verifyStudent } = require('../middleware/auth');
const telegramService = require('../telegram/service');
const { sendPurchaseConfirmation } = require('../email/service');

const router = express.Router();

// POST /payments/verify
router.post('/', verifyStudent, validate(z.object({
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
  courseId: z.string(),
})), async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, courseId } = req.body;
    const uid = req.user.uid;

    // Step 1: Verify HMAC-SHA256 signature
    const expectedSig = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSig !== razorpaySignature) {
      return res.status(400).json({ error: 'Payment signature verification failed' });
    }

    // Step 2: Find the order
    const ordersSnap = await db.collection('orders')
      .where('razorpayOrderId', '==', razorpayOrderId)
      .limit(1)
      .get();

    if (ordersSnap.empty) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderDoc = ordersSnap.docs[0];
    const orderData = orderDoc.data();

    // Verify order belongs to this student
    if (orderData.studentId !== uid) {
      return res.status(403).json({ error: 'Order does not belong to you' });
    }

    // Idempotency check
    if (orderData.status === 'PAID') {
      return res.json({
        success: true,
        message: 'Already enrolled',
        telegramInviteLink: null,
      });
    }

    if (orderData.status !== 'CREATED') {
      return res.status(400).json({ error: 'Order is not in a payable state' });
    }

    // Step 3: Batch write - update order, create enrollment, update student, increment course
    const enrollmentRef = db.collection('enrollments').doc();
    const courseRef = db.collection('courses').doc(courseId);

    const batch = db.batch();

    // Update order
    batch.update(orderDoc.ref, {
      status: 'PAID',
      razorpayPaymentId,
      razorpaySignature,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create enrollment
    batch.set(enrollmentRef, {
      studentId: uid,
      courseId,
      courseTitle: orderData.courseTitle,
      studentEmail: req.user.email || orderData.studentId,
      telegramInviteLink: null,
      telegramJoinedAt: null,
      enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update student enrolledCourseIds
    batch.update(db.collection('students').doc(uid), {
      enrolledCourseIds: admin.firestore.FieldValue.arrayUnion(courseId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Increment course enrollment count
    batch.update(courseRef, {
      enrollmentCount: admin.firestore.FieldValue.increment(1),
    });

    await batch.commit();

    // Step 4: Grant Telegram access (non-blocking)
    let telegramInviteLink = null;
    try {
      telegramInviteLink = await telegramService.grantChannelAccess(uid, courseId);
    } catch (telErr) {
      console.error('Telegram grant failed (non-blocking):', telErr);
    }

    // Save invite link on enrollment if returned
    if (telegramInviteLink) {
      await enrollmentRef.update({ telegramInviteLink });
    }

    // Step 5: Send confirmation email (non-blocking)
    try {
      const studentDoc = await db.collection('students').doc(uid).get();
      const student = studentDoc.data();
      sendPurchaseConfirmation(
        student.email,
        student.name,
        orderData.courseTitle,
        orderData.amount,
        orderData.razorpayOrderId,
        telegramInviteLink,
        uid,
      );
    } catch (emailErr) {
      console.error('Confirmation email failed (non-blocking):', emailErr);
    }

    res.json({
      success: true,
      telegramInviteLink,
      enrollmentId: enrollmentRef.id,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
