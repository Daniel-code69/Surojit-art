const express = require('express');
const { admin, db } = require('../config');
const { verifyAdmin } = require('../middleware/auth');

const router = express.Router();

const STATS_CACHE_DOC = 'stats';
const STATS_CACHE_TTL_MS = 60 * 1000; // 60 seconds

// GET /admin/stats - Dashboard statistics
router.get('/', verifyAdmin, async (req, res, next) => {
  try {
    // Check cache
    const cacheRef = db.collection('meta').doc(STATS_CACHE_DOC);
    const cacheDoc = await cacheRef.get();
    const cacheData = cacheDoc.data();

    if (cacheData && cacheData.cachedAt) {
      const age = Date.now() - cacheData.cachedAt.toDate().getTime();
      if (age < STATS_CACHE_TTL_MS) {
        return res.json(cacheData.stats);
      }
    }

    // Aggregate fresh stats
    const [studentsSnap, coursesSnap, ordersSnap, enrollmentsSnap] = await Promise.all([
      db.collection('students').count().get(),
      db.collection('courses').count().get(),
      db.collection('orders').where('status', '==', 'PAID').get(),
      db.collection('enrollments').count().get(),
    ]);

    const totalStudents = studentsSnap.data().count || 0;
    const totalCourses = coursesSnap.data().count || 0;
    const totalEnrollments = enrollmentsSnap.data().count || 0;

    let totalRevenue = 0;
    ordersSnap.forEach((doc) => {
      totalRevenue += doc.data().amount || 0;
    });

    // Recent orders (last 10)
    const recentOrdersSnap = await db.collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    const recentOrders = [];
    recentOrdersSnap.forEach((doc) => {
      recentOrders.push({ id: doc.id, ...doc.data() });
    });

    // Recent students (last 10)
    const recentStudentsSnap = await db.collection('students')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    const recentStudents = [];
    recentStudentsSnap.forEach((doc) => {
      recentStudents.push({ id: doc.id, ...doc.data() });
    });

    const stats = {
      totalStudents,
      totalCourses,
      totalRevenue,
      totalEnrollments,
      recentOrders,
      recentStudents,
    };

    // Update cache
    await cacheRef.set({
      stats,
      cachedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json(stats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
