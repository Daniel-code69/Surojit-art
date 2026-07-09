/* ===================================================
   API LAYER — Firebase Auth + Backend API Integration
   Replaces data.js, auth.js, and student-auth.js
   =================================================== */

// ── Configuration ──
const API_CONFIG = {
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'sarojitpalart.firebaseapp.com',
    projectId: 'sarojitpalart',
    storageBucket: 'sarojitpalart.appspot.com',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID',
  },
  apiBaseUrl: '/api/v1',
  razorpayKeyId: null, // Set dynamically from create-order response
};

let firebaseApp = null;
let firebaseAuth = null;
let firestore = null;

// ── Firebase Lazy Init ──

async function ensureFirebaseLoaded() {
  if (typeof firebase !== 'undefined') return;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js';
    script.onload = () => {
      const authScript = document.createElement('script');
      authScript.src = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js';
      authScript.onload = resolve;
      authScript.onerror = reject;
      document.head.appendChild(authScript);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function initFirebase() {
  if (firebaseApp) return;
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded. Call ensureFirebaseLoaded() first.');
    return;
  }
  firebaseApp = firebase.initializeApp(API_CONFIG.firebase);
  firebaseAuth = firebase.auth();
}

function getAuth() {
  if (!firebaseAuth) initFirebase();
  return firebaseAuth;
}

// ── Student Auth ──

async function registerStudent(name, email, password) {
  const auth = getAuth();
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  const uid = cred.user.uid;
  const idToken = await cred.user.getIdToken();

  // Create profile in backend
  await apiFetch('/student/profile/create', {
    method: 'POST',
    body: { name, email, uid },
  });

  return { uid, email, name, idToken };
}

async function loginStudent(email, password) {
  const auth = getAuth();
  const cred = await auth.signInWithEmailAndPassword(email, password);
  const idToken = await cred.user.getIdToken();
  return {
    uid: cred.user.uid,
    email: cred.user.email,
    idToken,
  };
}

function logoutStudent() {
  return getAuth().signOut();
}

function isStudentAuthenticated() {
  const auth = getAuth();
  return auth.currentUser;
}

async function getStudentIdToken() {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken(false);
}

function resetStudentPassword(email) {
  return getAuth().sendPasswordResetEmail(email);
}

// ── Admin Auth ──

async function loginAdmin(email, password) {
  const auth = getAuth();
  const cred = await auth.signInWithEmailAndPassword(email, password);
  const idToken = await cred.user.getIdToken();

  // Verify admin claim exists
  const decoded = await verifyTokenLocally(idToken);
  if (!decoded.admin) {
    await auth.signOut();
    throw new Error('Unauthorized: Not an admin account');
  }

  return { uid: cred.user.uid, email: cred.user.email, idToken };
}

async function isAdminAuthenticated() {
  const user = getAuth().currentUser;
  if (!user) return false;
  const idToken = await user.getIdToken(false);
  try {
    const decoded = await verifyTokenLocally(idToken);
    return decoded.admin === true;
  } catch {
    return false;
  }
}

async function getAdminIdToken() {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken(false);
  // Verify it has admin claim
  const decoded = await verifyTokenLocally(token);
  if (!decoded.admin) throw new Error('Not an admin');
  return token;
}

async function verifyTokenLocally(idToken) {
  if (typeof firebase === 'undefined') throw new Error('Firebase not loaded');
  const auth = getAuth();
  // Firebase JS SDK doesn't decode JWT client-side easily,
  // so we use the backend endpoint to verify
  const res = await apiFetch('/admin/auth/me', {
    method: 'GET',
    useAdminToken: true,
  });
  return { admin: res.admin, uid: res.uid, email: res.email };
}

// ── Auth State Observer ──

function onAuthStateChanged(callback) {
  const auth = getAuth();
  return auth.onAuthStateChanged(callback);
}

// ── API Fetch Helper ──

async function apiFetch(endpoint, options = {}) {
  const { method = 'GET', body, useAdminToken, useStudentToken = true } = options;
  const headers = {};

  // Auto-attach auth token
  if (useAdminToken || useStudentToken) {
    try {
      const user = getAuth().currentUser;
      if (user) {
        const token = await user.getIdToken(false);
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('Failed to get auth token:', err);
    }
  }

  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${API_CONFIG.apiBaseUrl}${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.status) throw err;
    throw new Error('Network error: Unable to reach server');
  }
}

// ── Courses API ──

async function getCourses(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.level) params.set('level', filters.level);
  if (filters.price) params.set('price', filters.price);
  if (filters.search) params.set('search', filters.search);
  if (filters.sort) params.set('sort', filters.sort);

  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/courses${query}`, { useAdminToken: false, useStudentToken: false });
}

async function getCourse(id) {
  return apiFetch(`/courses/${id}`, { useAdminToken: false, useStudentToken: false });
}

async function getCourseLessons(courseId) {
  return apiFetch(`/courses/${courseId}/lessons`);
}

async function createCourse(data) {
  return apiFetch('/courses', { method: 'POST', body: data, useAdminToken: true });
}

async function updateCourse(courseId, data) {
  return apiFetch(`/courses/${courseId}`, { method: 'PUT', body: data, useAdminToken: true });
}

async function deleteCourse(courseId) {
  return apiFetch(`/courses/${courseId}`, { method: 'DELETE', useAdminToken: true });
}

// ── Categories API ──

async function getCategories() {
  return apiFetch('/categories', { useAdminToken: false, useStudentToken: false });
}

async function createCategory(data) {
  return apiFetch('/categories', { method: 'POST', body: data, useAdminToken: true });
}

async function updateCategory(id, data) {
  return apiFetch(`/categories/${id}`, { method: 'PUT', body: data, useAdminToken: true });
}

async function deleteCategory(id) {
  return apiFetch(`/categories/${id}`, { method: 'DELETE', useAdminToken: true });
}

// ── Reviews API ──

async function getReviews() {
  return apiFetch('/reviews', { useAdminToken: false, useStudentToken: false });
}

async function createReview(data) {
  return apiFetch('/reviews', { method: 'POST', body: data });
}

async function getPendingReviews() {
  return apiFetch('/reviews/pending', { useAdminToken: true });
}

async function approveReview(id) {
  return apiFetch(`/reviews/${id}/approve`, { method: 'PATCH', useAdminToken: true });
}

async function deleteReview(id) {
  return apiFetch(`/reviews/${id}`, { method: 'DELETE', useAdminToken: true });
}

// ── Payments API ──

async function createPaymentOrder(courseId) {
  return apiFetch('/payments/create-order', {
    method: 'POST',
    body: { courseId },
  });
}

async function verifyPayment(data) {
  return apiFetch('/payments/verify', {
    method: 'POST',
    body: data,
  });
}

async function getMyOrders() {
  return apiFetch('/payments/my-orders');
}

// ── Enrollments API ──

async function isEnrolled(courseId) {
  const data = await apiFetch(`/enrollments/check/${courseId}`);
  return data.enrolled;
}

async function getMyEnrollments() {
  return apiFetch('/enrollments/my');
}

// ── Student Profile API ──

async function getStudentProfile() {
  return apiFetch('/student/profile');
}

async function updateStudentProfile(data) {
  return apiFetch('/student/profile', { method: 'PATCH', body: data });
}

async function connectTelegram(telegramUserId, telegramUsername) {
  return apiFetch('/student/connect-telegram', {
    method: 'POST',
    body: { telegramUserId, telegramUsername },
  });
}

// ── Admin Stats API ──

async function getAdminStats() {
  return apiFetch('/admin/stats', { useAdminToken: true });
}

// ── Razorpay Payment Flow ──

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function enrollInCourse(courseId) {
  if (!isStudentAuthenticated()) {
    throw new Error('Please log in first to enroll in a course');
  }

  // Step 1: Create Razorpay order
  const order = await createPaymentOrder(courseId);

  // Step 2: Load Razorpay checkout
  await loadRazorpayScript();

  // Step 3: Open Razorpay checkout
  return new Promise((resolve, reject) => {
    const options = {
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'Sarojit Pal Art',
      description: order.courseTitle,
      order_id: order.razorpayOrderId,
      handler: async function (response) {
        try {
          const result = await verifyPayment({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            courseId,
          });
          resolve(result);
        } catch (err) {
          reject(err);
        }
      },
      modal: {
        ondismiss: function () {
          reject(new Error('Payment cancelled'));
        },
      },
      prefill: {
        email: getAuth().currentUser?.email || '',
      },
      theme: {
        color: '#4F46E5',
      },
    };

    const rzp = new Razorpay(options);
    rzp.open();
  });
}

// ── Telegram Helper ──

function getTelegramConnectLink(studentId) {
  const botUsername = API_CONFIG.firebase.projectId
    ? 'SarojitPalArtBot'
    : 'SarojitPalArtBot';
  return `https://t.me/${botUsername}?start=verify_${studentId}`;
}

// ── Admin Course CRUD helpers ──

async function adminCreateCourse(data) {
  return createCourse(data);
}

async function adminUpdateCourse(courseId, data) {
  return updateCourse(courseId, data);
}

async function adminDeleteCourse(courseId) {
  return deleteCourse(courseId);
}

async function adminCreateLesson(courseId, data) {
  return apiFetch(`/courses/${courseId}/lessons`, {
    method: 'POST',
    body: data,
    useAdminToken: true,
  });
}

async function adminUpdateLesson(courseId, lessonId, data) {
  return apiFetch(`/courses/${courseId}/lessons/${lessonId}`, {
    method: 'PUT',
    body: data,
    useAdminToken: true,
  });
}

async function adminDeleteLesson(courseId, lessonId) {
  return apiFetch(`/courses/${courseId}/lessons/${lessonId}`, {
    method: 'DELETE',
    useAdminToken: true,
  });
}

async function adminReorderLessons(courseId, orderedIds) {
  return apiFetch(`/courses/${courseId}/lessons/reorder`, {
    method: 'POST',
    body: { orderedIds },
    useAdminToken: true,
  });
}

// ── Admin Enrollment helpers ──

async function adminGetEnrollments(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/enrollments${query ? '?' + query : ''}`, { useAdminToken: true });
}

async function adminManualEnroll(studentId, courseId) {
  return apiFetch('/enrollments/manual', {
    method: 'POST',
    body: { studentId, courseId },
    useAdminToken: true,
  });
}

async function adminRemoveEnrollment(enrollmentId) {
  return apiFetch(`/enrollments/${enrollmentId}`, {
    method: 'DELETE',
    useAdminToken: true,
  });
}

// ── Admin Telegram helpers ──

async function adminSendBroadcast(courseId, message) {
  return apiFetch('/telegram/broadcast', {
    method: 'POST',
    body: { courseId, message },
    useAdminToken: true,
  });
}

async function adminGenerateTelegramLink(studentId) {
  return apiFetch('/telegram/generate-link', {
    method: 'POST',
    body: { studentId },
    useAdminToken: true,
  });
}

// ── Upload helpers ──

async function adminGetUploadUrl(fileName, contentType) {
  return apiFetch('/uploads/thumbnail', {
    method: 'POST',
    body: { fileName, contentType },
    useAdminToken: true,
  });
}

async function adminUploadBase64(imageData, fileName) {
  return apiFetch('/uploads/base64', {
    method: 'POST',
    body: { imageData, fileName },
    useAdminToken: true,
  });
}

// ── Admin setup helper ──

async function adminSetup(email, password, name) {
  return apiFetch('/admin/auth/setup', {
    method: 'POST',
    body: { email, password, name },
    useAdminToken: false,
    useStudentToken: false,
  });
}

// ── Export all functions globally ──

window.SPA = {
  // Firebase
  initFirebase,
  ensureFirebaseLoaded,
  onAuthStateChanged,

  // Student Auth
  registerStudent,
  loginStudent,
  logoutStudent,
  isStudentAuthenticated,
  getStudentIdToken,
  resetStudentPassword,

  // Admin Auth
  loginAdmin,
  isAdminAuthenticated,
  getAdminIdToken,

  // API
  apiFetch,

  // Courses
  getCourses,
  getCourse,
  getCourseLessons,

  // Categories
  getCategories,

  // Reviews
  getReviews,
  createReview,

  // Payments
  createPaymentOrder,
  verifyPayment,
  getMyOrders,

  // Enrollments
  isEnrolled,
  getMyEnrollments,

  // Profile
  getStudentProfile,
  updateStudentProfile,
  connectTelegram,

  // Payment Flow
  enrollInCourse,
  getTelegramConnectLink,

  // Admin
  getAdminStats,
  adminCreateCourse,
  adminUpdateCourse,
  adminDeleteCourse,
  adminCreateLesson,
  adminUpdateLesson,
  adminDeleteLesson,
  adminReorderLessons,
  adminGetEnrollments,
  adminManualEnroll,
  adminRemoveEnrollment,
  adminSendBroadcast,
  adminGenerateTelegramLink,
  adminGetUploadUrl,
  adminUploadBase64,
  adminSetup,
  createCategory,
  updateCategory,
  deleteCategory,
  getPendingReviews,
  approveReview,
  deleteReview,
};

console.log('SPA API layer loaded. Use window.SPA.* for all Firebase + backend operations.');
