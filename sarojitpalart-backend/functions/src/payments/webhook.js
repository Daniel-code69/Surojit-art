const express = require('express');
const crypto = require('crypto');
const { admin, db, config } = require('../config');
// Telegram video-delivery disabled — video access is handled via Firestore rules + API gating
// const telegramService = require('../telegram/service');
const { sendPurchaseConfirmation } = require('../email/service');

const router = express.Router();

// POST /payments/webhook - Razorpay webhook (NO auth middleware)
router.post('/', async (req, res) => {
  // Always respond 200 synchronously
  try {
    // Verify webhook signature
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      console.error('Webhook: No signature header');
      return res.status(200).json({ status: 'ok' });
    }

    const expectedSig = crypto
      .createHmac('sha256', config.razorpay.webhookSecret)
      .update(req.body)
      .digest('hex');

    if (expectedSig !== signature) {
      console.error('Webhook: Invalid signature');
      return res.status(200).json({ status: 'ok' });
    }

    const event = JSON.parse(req.body.toString());
    const eventType = event.event;

    // Process in background - respond 200 immediately
    res.status(200).json({ status: 'ok' });

    // Handle different event types asynchronously
    setImmediate(async () => {
      try {
        switch (eventType) {
          case 'payment.captured':
            await handlePaymentCaptured(event);
            break;
          case 'payment.failed':
            await handlePaymentFailed(event);
            break;
          default:
            console.log(`Webhook: Unhandled event type: ${eventType}`);
        }
      } catch (err) {
        console.error('Webhook background processing error:', err);
      }
    });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).json({ status: 'ok' });
  }
});

async function handlePaymentCaptured(event) {
  const payment = event.payload.payment.entity;
  const orderId = payment.order_id;
  const paymentId = payment.id;

  // Find order
  const ordersSnap = await db.collection('orders')
    .where('razorpayOrderId', '==', orderId)
    .limit(1)
    .get();

  if (ordersSnap.empty) {
    console.log(`Webhook: Order ${orderId} not found`);
    return;
  }

  const orderDoc = ordersSnap.docs[0];
  const orderData = orderDoc.data();

  // Idempotency: check if already enrolled
  if (orderData.status === 'PAID') {
    console.log(`Webhook: Order ${orderId} already processed`);
    return;
  }

  if (orderData.status !== 'CREATED') {
    console.log(`Webhook: Order ${orderId} in unexpected state: ${orderData.status}`);
    return;
  }

  const { studentId, courseId } = orderData;

  // Check enrollment doesn't already exist
  const enrollmentsSnap = await db.collection('enrollments')
    .where('studentId', '==', studentId)
    .where('courseId', '==', courseId)
    .limit(1)
    .get();

  if (!enrollmentsSnap.empty) {
    console.log(`Webhook: Enrollment already exists for student ${studentId} course ${courseId}`);
    return;
  }

  // Create enrollment
  const enrollmentRef = db.collection('enrollments').doc();
  const batch = db.batch();

  batch.update(orderDoc.ref, {
    status: 'PAID',
    razorpayPaymentId: paymentId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  batch.set(enrollmentRef, {
    studentId,
    courseId,
    courseTitle: orderData.courseTitle,
    studentEmail: orderData.studentId,
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

  // Send email
  try {
    const studentDoc = await db.collection('students').doc(studentId).get();
    if (studentDoc.exists) {
      const student = studentDoc.data();
      sendPurchaseConfirmation(
        student.email,
        student.name,
        orderData.courseTitle,
        orderData.amount,
        orderId,
        null,
        studentId,
      );
    }
  } catch (err) {
    console.error('Webhook email failed:', err);
  }
}

async function handlePaymentFailed(event) {
  const payment = event.payload.payment.entity;
  const orderId = payment.order_id;

  const ordersSnap = await db.collection('orders')
    .where('razorpayOrderId', '==', orderId)
    .limit(1)
    .get();

  if (ordersSnap.empty) return;

  const orderDoc = ordersSnap.docs[0];
  const orderData = orderDoc.data();

  if (orderData.status === 'CREATED') {
    await orderDoc.ref.update({
      status: 'FAILED',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

module.exports = router;
