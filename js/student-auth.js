/* ===================================================
   STUDENT AUTH + ENROLLMENT — Bridges the frontend to
   the Firebase/Cloud-Functions backend (window.API).
   Keeps the same public function names used by all pages
   and caches enrollment data locally for instant UI.
   =================================================== */

const STUDENT_AUTH_KEYS = {
  USERS: 'spa_users',
  SESSION: 'spa_student_session',
  REMEMBER: 'spa_student_remember',
  ENROLLMENTS: 'spa_enrollments',
  MY_COURSES: 'spa_api_my_courses',
  ENROLLED_IDS: 'spa_enrolled_ids',
};

/**
 * Re-export the Firebase-backed auth globals from firebase-init.js so pages
 * that call registerStudent/loginStudent/etc. hit the backend.
 */
function api() {
  return window.API || null;
}

/**
 * Register a new student via Firebase Auth + backend profile.
 * @returns {Promise<{success, message}>}
 */
async function registerStudent(name, email, password) {
  if (!name || !email || !password) {
    return { success: false, message: 'All fields are required.' };
  }
  const api = window.API;
  if (!api || typeof api.registerStudent !== 'function') {
    return { success: false, message: 'Registration service unavailable.' };
  }
  try {
    await api.registerStudent(name, email, password);
    return { success: true, message: 'Registration successful! You can now login.' };
  } catch (err) {
    let message = 'Registration failed. Please try again.';
    if (err.code === 'auth/email-already-in-use') message = 'This email is already registered.';
    else if (err.code === 'auth/weak-password') message = 'Password is too weak. Use at least 6 characters.';
    else if (err.code === 'auth/operation-not-allowed') message = 'Email/password sign-up is not enabled.';
    return { success: false, message };
  }
}

/**
 * Attempt student login via Firebase Auth.
 */
async function loginStudent(email, password, rememberMe = false) {
  const api = window.API;
  if (!api || typeof api.loginStudent !== 'function') {
    return { success: false, message: 'Login service unavailable.' };
  }
  try {
    await api.loginStudent(email, password);
    return {
      success: true,
      message: 'Login successful! Redirecting to dashboard...',
      redirect: 'student-dashboard.html',
    };
  } catch (err) {
    let message = 'Invalid email or password.';
    if (err && err.code === 'auth/user-not-found') message = 'No account found with this email.';
    else if (err && err.code === 'auth/wrong-password') message = 'Invalid password.';
    else if (err && err.code === 'auth/too-many-requests') message = 'Too many attempts. Please try again later.';
    else if (err && (err.code === 'auth/network-request-failed' || err.code === 'auth/invalid-api-key')) message = 'Network error. Please try again.';
    return { success: false, message };
  }
}

/**
 * Check if a student is authenticated (signed into Firebase).
 */
function isStudentAuthenticated() {
  return !!getCurrentFirebaseUser();
}

/**
 * Get current logged-in student data derived from the Firebase user.
 */
function getCurrentStudent() {
  const user = getCurrentFirebaseUser();
  if (!user) return null;
  return {
    userId: user.uid,
    email: user.email,
    name: user.displayName || 'Student',
    createdAt: user.metadata && user.metadata.creationTime ? new Date(user.metadata.creationTime).getTime() : Date.now(),
  };
}

/**
 * Logout student.
 */
function logoutStudent() {
  const api = window.API;
  if (api && typeof api.logoutStudent === 'function') {
    return api.logoutStudent();
  }
  return Promise.resolve();
}

/**
 * Reset student password — sends a Firebase password-reset email.
 */
async function resetStudentPassword(email, newPassword, confirmPassword) {
  const api = window.API;
  if (!api || typeof api.resetStudentPassword !== 'function') {
    return { success: false, message: 'Password reset service unavailable.' };
  }
  try {
    await api.resetStudentPassword(email);
    return { success: true, message: 'Password reset email sent! Check your inbox.' };
  } catch (err) {
    let message = 'Unable to send reset email.';
    if (err && err.code === 'auth/user-not-found') message = 'No account found with this email.';
    return { success: false, message };
  }
}

/* ── Validation Helpers ── */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ── Enrollment Helpers ──
   Source of truth is the backend. Local caches give instant UI. */

function cacheEnrolledIds(ids) {
  localStorage.setItem(STUDENT_AUTH_KEYS.ENROLLED_IDS, JSON.stringify(Array.from(new Set(ids))));
}

function getEnrolledIds() {
  try {
    return JSON.parse(localStorage.getItem(STUDENT_AUTH_KEYS.ENROLLED_IDS)) || [];
  } catch (e) {
    return [];
  }
}

function cacheMyCourses(courses) {
  localStorage.setItem(STUDENT_AUTH_KEYS.MY_COURSES, JSON.stringify(courses));
}

function getCachedMyCourses() {
  try {
    return JSON.parse(localStorage.getItem(STUDENT_AUTH_KEYS.MY_COURSES)) || [];
  } catch (e) {
    return [];
  }
}

/**
 * Refresh local enrollment caches from the backend.
 * Safe to call after login / after payment / on dashboard load.
 */
async function syncEnrollmentsFromApi() {
  const api = window.API;
  if (!api || !getCurrentFirebaseUser()) return;
  try {
    const enrollments = await api.apiFetch('/enrollments/my');
    const ids = enrollments.map((e) => e.courseId).filter(Boolean);
    cacheEnrolledIds(ids);

    // Interleave enrollment meta with catalog course data for the dashboard cards.
    const allCourses = typeof getCourses === 'function' ? getCourses() : [];
    const my = enrollments.map((e) => {
      const base = allCourses.find((c) => String(c.id) === String(e.courseId)) || null;
      const remoteCourse = e.course || null;
      if (!base && remoteCourse && typeof mapRemoteCourse === 'function') {
        const mapped = mapRemoteCourse(remoteCourse);
        if (mapped) return { ...mapped, enrolledAt: e.enrolledAt, enrollmentId: e.id };
      }
      return base
        ? { ...base, enrolledAt: e.enrolledAt, enrollmentId: e.id }
        : { id: e.courseId, title: remoteCourse ? remoteCourse.title : e.courseTitle || 'Course', thumbnail: (remoteCourse && remoteCourse.thumbnail) || 'assets/images/course_portrait.png', lessons: [], enrolledAt: e.enrolledAt, enrollmentId: e.id, category: (remoteCourse && remoteCourse.categoryName) || 'Art', level: 'Beginner', pricing: 'paid', originalPrice: (remoteCourse && remoteCourse.price) || 0, discountPrice: (remoteCourse && (remoteCourse.discountedPrice || remoteCourse.price)) || 0, duration: 'Flexible' };
    });
    cacheMyCourses(my.filter(Boolean));
  } catch (e) {
    // Backend unreachable — fall back to whatever is cached.
  }
}

/**
 * Check if current student is enrolled in a course (synchronous, cache-first).
 * Use syncEnrollmentsFromApi() to refresh the cache from the backend.
 */
function isEnrolled(courseId) {
  const enrolledIds = getEnrolledIds();
  if (enrolledIds.includes(String(courseId))) return true;

  // Legacy localStorage fallback
  const student = getLegacyCurrentStudent();
  if (!student) return false;
  const enrollments = JSON.parse(localStorage.getItem(STUDENT_AUTH_KEYS.ENROLLMENTS)) || [];
  return enrollments.some((e) => e.userId === student.userId && String(e.courseId) === String(courseId));
}

/**
 * Server-authoritative enrollment check (async).
 */
async function checkEnrollmentStatus(courseId) {
  const api = window.API;
  if (api && getCurrentFirebaseUser()) {
    try {
      const check = await api.apiFetch('/enrollments/check/' + courseId);
      return !!check.enrolled;
    } catch (e) {
      // Fall back to local cache
    }
  }
  return isEnrolled(courseId);
}

/**
 * Enroll current student in a course. Free courses enroll immediately;
 * paid courses return an order for the Razorpay checkout.
 * @returns {Promise<{success, message, needsPayment?, order?}>}
 */
async function enrollInCourse(courseId) {
  if (!getCurrentFirebaseUser()) {
    return { success: false, message: 'Please login to enroll.' };
  }

  const api = window.API;
  if (api && typeof api.apiFetch === 'function') {
    try {
      const result = await api.apiFetch('/payments/create-order', {
        method: 'POST',
        auth: true,
        body: { courseId: String(courseId) },
      });

      if (result && result.free) {
        await syncEnrollmentsFromApi();
        return { success: true, message: 'Successfully enrolled in course!' };
      }

      if (result && result.razorpayOrderId) {
        return { success: true, needsPayment: true, order: result, message: 'Complete payment to enroll.' };
      }

      return { success: false, message: (result && result.message) || 'Unable to process enrollment.' };
    } catch (err) {
      if (err && err.status === 409) {
        await syncEnrollmentsFromApi();
        return { success: false, message: 'You are already enrolled in this course.' };
      }
      return { success: false, message: (err && err.message) || 'Enrollment failed. Please try again.' };
    }
  }

  // Fallback: local enroll
  const student = getLegacyCurrentStudent();
  if (!student) return { success: false, message: 'Please login to enroll.' };
  if (await isEnrolled(courseId)) return { success: false, message: 'You are already enrolled in this course.' };
  const enrollments = JSON.parse(localStorage.getItem(STUDENT_AUTH_KEYS.ENROLLMENTS)) || [];
  enrollments.push({ id: 'enr_' + Date.now(), userId: student.userId, courseId: String(courseId), enrolledAt: Date.now() });
  localStorage.setItem(STUDENT_AUTH_KEYS.ENROLLMENTS, JSON.stringify(enrollments));
  return { success: true, message: 'Successfully enrolled in course!' };
}

/**
 * Launch the Razorpay checkout for a paid course order.
 * @returns {Promise<{razorpayPaymentId, razorpaySignature}>}
 */
function launchRazorpay(order) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = function() {
      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'Sarojit Pal Art',
        description: order.courseTitle || '',
        order_id: order.razorpayOrderId,
        handler: function(response) {
          resolve(response);
        },
        modal: {
          ondismiss: function () {
            reject(new Error('Payment window closed'));
          },
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    };
    script.onerror = function () {
      reject(new Error('Could not load payment gateway'));
    };
    document.body.appendChild(script);
  });
}

/**
 * Full enroll flow: free = instant, paid = Razorpay checkout + verify.
 */
async function checkoutCourse(courseId) {
  const result = await enrollInCourse(courseId);
  if (result.success && !result.needsPayment) return result;
  if (!result.needsPayment) return result;

  try {
    const payment = await launchRazorpay(result.order);
    const verify = await payOrderPayment(result.order, payment);
    if (verify.success && typeof renderCourses === 'function') renderCourses();
    if (verify.success) await syncEnrollmentsFromApi();
    return verify;
  } catch (err) {
    return { success: false, message: (err && err.message) || 'Payment was not completed.' };
  }
}

/**
 * Validate a Razorpay checkout result against the backend.
 */
async function payOrderPayment(order, payment) {
  const api = window.API;
  if (!api || !api.apiFetch) return { success: false, message: 'Service unavailable.' };
  try {
    await api.apiFetch('/payments/verify', {
      method: 'POST',
      auth: true,
      body: {
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: payment.razorpayPaymentId,
        razorpaySignature: payment.razorpaySignature,
        courseId: String(payment.courseId || order.courseId || ''),
      },
    });
    await syncEnrollmentsFromApi();
    return { success: true, message: 'Payment successful! You are enrolled.' };
  } catch (err) {
    let message = 'Payment verification failed.';
    if (err && err.status === 400) message = err.message || message;
    return { success: false, message };
  }
}

/**
 * Get courses enrolled by current student (cached from backend).
 */
function getMyCourses() {
  const cached = getCachedMyCourses();
  if (cached.length > 0) return cached;

  // Legacy localStorage fallback
  const student = getLegacyCurrentStudent();
  if (!student) return [];
  const enrollments = JSON.parse(localStorage.getItem(STUDENT_AUTH_KEYS.ENROLLMENTS)) || [];
  const myEnrollments = enrollments.filter((e) => e.userId === student.userId);
  if (typeof getCourses === 'function') {
    const allCourses = getCourses();
    return myEnrollments.map((e) => {
      const course = allCourses.find((c) => String(c.id) === String(e.courseId));
      return course ? { ...course, enrolledAt: e.enrolledAt } : null;
    }).filter(Boolean);
  }
  return myEnrollments;
}

function getLegacyCurrentStudent() {
  let session = sessionStorage.getItem(STUDENT_AUTH_KEYS.SESSION);
  if (!session) session = localStorage.getItem(STUDENT_AUTH_KEYS.SESSION);
  if (!session) return null;
  try {
    const data = JSON.parse(session);
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(STUDENT_AUTH_KEYS.SESSION);
      sessionStorage.removeItem(STUDENT_AUTH_KEYS.SESSION);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

/**
 * Protect student routes (e.g. dashboard).
 */
function protectStudentRoute() {
  if (!isStudentAuthenticated()) {
    sessionStorage.setItem('spa_redirect_after_login', window.location.href);
    window.location.href = 'student-login.html';
    return false;
  }
  return true;
}