const express = require('express');
const crypto = require('crypto');
const { admin, db, config, fieldValue } = require('../config');
// Telegram video-delivery disabled — video access is handled via Firestore rules + API gating
// const telegramService = require('../telegram/service');
const { sendPurchaseConfirmation } = require('../email/service');

const router = express.Router();

// POST /payments/webhook - Razorpay webhook (NO auth middleware)
router.post('/', async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      console.error('Webhook: No signature header');
      return res.status(400).json({ error: 'Missing signature' });
    }

    const expectedSig = crypto
      .createHmac('sha256', config.razorpay.webhookSecret)
      .update(req.body)
      .digest('hex');

    if (expectedSig !== signature) {
      console.error('Webhook: Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(req.body.toString());
    const eventType = event.event;

    // Process the event BEFORE responding so Cloud Functions doesn't terminate mid-flight.
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

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).json({ error: 'ok' });
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

  // Validate that the captured amount matches the order amount.
  // This prevents forged (but correctly signed by Razorpay) capture events from granting access for a lower amount.
  const expectedPaise = Math.round(orderData.amount * 100);
  if (payment.amount !== undefined && expectedPaise !== payment.amount) {
    console.error(`Webhook: Amount mismatch for order ${orderId}. Expected ${expectedPaise}, got ${payment.amount}`);
    return;
  }

  const { studentId, courseId } = orderData;

  // Verify the student still exists before touching their doc
  const studentDoc = await db.collection('students').doc(studentId).get();
  if (!studentDoc.exists) {
    console.error(`Webhook: Student ${studentId} not found for order ${orderId}. Marking order as PAID.`);
    await orderDoc.ref.update({
      status: 'PAID',
      razorpayPaymentId: paymentId,
      updatedAt: fieldValue.serverTimestamp(),
    });
    return;
  }

  // Check enrollment doesn't already exist
  const enrollmentsSnap = await db.collection('enrollments')
    .where('studentId', '==', studentId)
    .where('courseId', '==', courseId)
    .limit(1)
    .get();

  if (!enrollmentsSnap.empty) {
    console.log(`Webhook: Enrollment already exists for student ${studentId} course ${courseId}`);
    // Still mark the order as PAID since payment was captured
    await orderDoc.ref.update({
      status: 'PAID',
      razorpayPaymentId: paymentId,
      updatedAt: fieldValue.serverTimestamp(),
    });
    return;
  }

  // Create enrollment
  const enrollmentRef = db.collection('enrollments').doc();
  const batch = db.batch();

  batch.update(orderDoc.ref, {
    status: 'PAID',
    razorpayPaymentId: paymentId,
    updatedAt: fieldValue.serverTimestamp(),
  });

  batch.set(enrollmentRef, {
    studentId,
    courseId,
    courseTitle: orderData.courseTitle,
    studentEmail: studentDoc.data().email || orderData.studentId,
    enrolledAt: fieldValue.serverTimestamp(),
  });

  batch.update(db.collection('students').doc(studentId), {
    enrolledCourseIds: fieldValue.arrayUnion(courseId),
    updatedAt: fieldValue.serverTimestamp(),
  });

  batch.update(db.collection('courses').doc(courseId), {
    enrollmentCount: fieldValue.increment(1),
  });

  await batch.commit();

  // Send email (non-blocking)
  try {
    const student = studentDoc.data();
    sendPurchaseConfirmation(
      student.email,
      student.name,
      orderData.courseTitle,
      orderData.amount,
      orderId,
      paymentId,
      studentId,
    );
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
      updatedAt: fieldValue.serverTimestamp(),
    });
  }
}

module.exports = router;