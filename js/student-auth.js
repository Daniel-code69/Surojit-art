/* ===================================================
   STUDENT AUTH — Authentication System for Students
   =================================================== */

const STUDENT_AUTH_KEYS = {
  USERS: 'spa_users',
  SESSION: 'spa_student_session',
  REMEMBER: 'spa_student_remember',
  ENROLLMENTS: 'spa_enrollments'
};

const STUDENT_AUTH_CONFIG = {
  sessionDuration: 3 * 60 * 60 * 1000, // 3 hours
  rememberDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
  tokenPrefix: 'SPA_STU_'
};

/**
 * Hash a string using SHA-256 (Web Crypto API)
 */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random session token
 */
function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return STUDENT_AUTH_CONFIG.tokenPrefix + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get all registered users from localStorage
 */
function getUsers() {
  return JSON.parse(localStorage.getItem(STUDENT_AUTH_KEYS.USERS)) || [];
}

/**
 * Save users array to localStorage
 */
function saveUsers(users) {
  localStorage.setItem(STUDENT_AUTH_KEYS.USERS, JSON.stringify(users));
}

/**
 * Register a new student
 * @returns {Object} { success, message }
 */
async function registerStudent(name, email, password) {
  if (!name || !email || !password) {
    return { success: false, message: 'All fields are required.' };
  }

  const users = getUsers();

  // Check if email already exists
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, message: 'Email is already registered. Please login.' };
  }

  // Create new user
  const passwordHash = await hashPassword(password);
  const newUser = {
    id: 'user_' + Date.now(),
    name: name,
    email: email.toLowerCase(),
    passwordHash: passwordHash,
    createdAt: Date.now()
  };

  users.push(newUser);
  saveUsers(users);

  return { success: true, message: 'Registration successful! You can now login.' };
}

/**
 * Attempt student login
 * @returns {Object} { success, message, redirect }
 */
async function loginStudent(email, password, rememberMe = false) {
  if (!email || !password) {
    return { success: false, message: 'Please fill in all fields.' };
  }

  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    return { success: false, message: 'Invalid email or password.' };
  }

  const inputHash = await hashPassword(password);

  if (inputHash === user.passwordHash) {
    // Create session
    const token = generateToken();
    const session = {
      token,
      userId: user.id,
      email: user.email,
      name: user.name,
      createdAt: Date.now(),
      expiresAt: Date.now() + (rememberMe ? STUDENT_AUTH_CONFIG.rememberDuration : STUDENT_AUTH_CONFIG.sessionDuration)
    };

    // Store session
    if (rememberMe) {
      localStorage.setItem(STUDENT_AUTH_KEYS.SESSION, JSON.stringify(session));
      localStorage.setItem(STUDENT_AUTH_KEYS.REMEMBER, 'true');
    } else {
      sessionStorage.setItem(STUDENT_AUTH_KEYS.SESSION, JSON.stringify(session));
      localStorage.removeItem(STUDENT_AUTH_KEYS.REMEMBER);
    }

    return {
      success: true,
      message: 'Login successful! Redirecting to dashboard...',
      redirect: 'student-dashboard.html'
    };
  } else {
    return { success: false, message: 'Invalid email or password.' };
  }
}

/**
 * Check if a student is authenticated
 */
function isStudentAuthenticated() {
  let session = sessionStorage.getItem(STUDENT_AUTH_KEYS.SESSION);
  if (!session) {
    session = localStorage.getItem(STUDENT_AUTH_KEYS.SESSION);
  }

  if (!session) return false;

  try {
    const data = JSON.parse(session);
    if (!data.token || !data.token.startsWith(STUDENT_AUTH_CONFIG.tokenPrefix)) return false;
    
    if (Date.now() > data.expiresAt) {
      logoutStudent();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current logged-in student data
 */
function getCurrentStudent() {
  let session = sessionStorage.getItem(STUDENT_AUTH_KEYS.SESSION);
  if (!session) {
    session = localStorage.getItem(STUDENT_AUTH_KEYS.SESSION);
  }

  if (!session) return null;

  try {
    const data = JSON.parse(session);
    if (Date.now() > data.expiresAt) {
      logoutStudent();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Logout student
 */
function logoutStudent() {
  sessionStorage.removeItem(STUDENT_AUTH_KEYS.SESSION);
  localStorage.removeItem(STUDENT_AUTH_KEYS.SESSION);
  localStorage.removeItem(STUDENT_AUTH_KEYS.REMEMBER);
}

/**
 * Protect student routes (e.g. dashboard)
 */
function protectStudentRoute() {
  if (!isStudentAuthenticated()) {
    // Save the intended destination to redirect back after login
    sessionStorage.setItem('spa_redirect_after_login', window.location.href);
    window.location.href = 'student-login.html';
    return false;
  }
  return true;
}

/**
 * Reset student password (simulated)
 */
async function resetStudentPassword(email, newPassword, confirmPassword) {
  if (newPassword.length < 6) {
    return { success: false, message: 'Password must be at least 6 characters.' };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, message: 'Passwords do not match.' };
  }

  const users = getUsers();
  const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

  if (userIndex === -1) {
    return { success: false, message: 'Email address not found.' };
  }

  const newHash = await hashPassword(newPassword);
  users[userIndex].passwordHash = newHash;
  saveUsers(users);

  return { success: true, message: 'Password reset successfully! You can now login.' };
}

/* ── Validation Helpers ── */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ── Enrollment Helpers ── */

function getEnrollments() {
  return JSON.parse(localStorage.getItem(STUDENT_AUTH_KEYS.ENROLLMENTS)) || [];
}

function saveEnrollments(enrollments) {
  localStorage.setItem(STUDENT_AUTH_KEYS.ENROLLMENTS, JSON.stringify(enrollments));
}

/**
 * Check if current student is enrolled in a course
 */
function isEnrolled(courseId) {
  const student = getCurrentStudent();
  if (!student) return false;

  const enrollments = getEnrollments();
  return enrollments.some(e => e.userId === student.userId && String(e.courseId) === String(courseId));
}

/**
 * Enroll current student in a course
 */
function enrollInCourse(courseId) {
  const student = getCurrentStudent();
  if (!student) return { success: false, message: 'Please login to enroll.' };

  if (isEnrolled(courseId)) {
    return { success: false, message: 'You are already enrolled in this course.' };
  }

  const enrollments = getEnrollments();
  enrollments.push({
    id: 'enr_' + Date.now(),
    userId: student.userId,
    courseId: courseId,
    enrolledAt: Date.now()
  });
  
  saveEnrollments(enrollments);
  return { success: true, message: 'Successfully enrolled in course!' };
}

/**
 * Get courses enrolled by current student
 */
function getMyCourses() {
  const student = getCurrentStudent();
  if (!student) return [];

  const enrollments = getEnrollments();
  const myEnrollments = enrollments.filter(e => e.userId === student.userId);
  
  // Assuming getCourses() from data.js is available in scope
  if (typeof getCourses === 'function') {
    const allCourses = getCourses();
    return myEnrollments.map(e => {
      const course = allCourses.find(c => String(c.id) === String(e.courseId));
      return course ? { ...course, enrolledAt: e.enrolledAt } : null;
    }).filter(Boolean);
  }
  
  return myEnrollments;
}
