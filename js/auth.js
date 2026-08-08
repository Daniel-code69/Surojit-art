/* ===================================================
   ADMIN AUTH — Firebase custom-claim backed.
   The frontend never stores or checks passwords; it signs in
   through Firebase and verifies the admin claim via the backend.
   =================================================== */

const AUTH_KEYS = {
  SESSION: 'spa_admin_session',
  REMEMBER: 'spa_admin_remember',
  ATTEMPTS: 'spa_auth_attempts',
  LOCKOUT: 'spa_auth_lockout',
  ADMIN_HASH: 'spa_admin_hash'
};

const AUTH_CONFIG = {
  maxAttempts: 5,
  lockoutDuration: 60, // seconds
  sessionDuration: 30 * 60 * 1000, // 30 minutes (client-side UI hint; source of truth is Firebase)
  rememberDuration: 7 * 24 * 60 * 60 * 1000,
  tokenPrefix: 'SPA_TOKEN_',
  verifiedKey: 'spa_admin_verified'
};

/**
 * Initialize — no local credentials are ever stored.
 * Previously this wrote a hard-coded admin hash to localStorage.
 */
function initAuth() {
  // Intentionally empty: there is no default admin password in the frontend.
}

/**
 * Attempt admin login using Firebase + backend claim verification.
 * @returns {Promise<{success, message, redirect}>}
 */
async function attemptLogin(email, password, rememberMe = false) {
  const api = window.API;
  if (!api || typeof api.loginAdmin !== 'function') {
    return { success: false, message: 'Authentication service unavailable.' };
  }

  try {
    await api.loginAdmin(email, password);
    if (rememberMe) {
      localStorage.setItem(AUTH_KEYS.REMEMBER, email);
    } else {
      localStorage.removeItem(AUTH_KEYS.REMEMBER);
    }
    localStorage.setItem(AUTH_KEYS.verifiedKey, '1');
    return {
      success: true,
      message: 'Login successful! Redirecting...',
      redirect: 'admin.html',
    };
  } catch (err) {
    clearVerified();
    let message = 'Invalid email or password.';
    if (err && err.code === 'auth/user-not-found') message = 'No admin account found with this email.';
    else if (err && err.code === 'auth/wrong-password') message = 'Invalid password.';
    else if (err && err.code === 'auth/too-many-requests') message = 'Too many attempts. Please try again later.';
    else if (err && err.message && err.message.indexOf('not an admin') !== -1) message = 'This account does not have admin access.';
    return { success: false, message, locked: false };
  }
}

function clearVerified() {
  localStorage.removeItem(AUTH_KEYS.verifiedKey);
}

/**
 * Check whether an admin is authenticated. Sync, because admin pages gate on it
 * during initial render. This trusts the last backend verification, which is
 * refreshed on load when Firebase still has a signed-in user.
 */
function isAuthenticated() {
  const user = typeof getCurrentFirebaseUser === 'function' ? getCurrentFirebaseUser() : null;
  if (!user) {
    clearVerified();
    return false;
  }
  return localStorage.getItem(AUTH_KEYS.verifiedKey) === '1';
}

/**
 * Verify the current Firebase user actually holds the admin claim (server-side).
 * Admin pages should call this on boot to refresh trust.
 * @returns {Promise<boolean>}
 */
async function verifyAdminAuth() {
  const api = window.API;
  if (!api || !getCurrentFirebaseUser()) {
    clearVerified();
    return false;
  }
  try {
    const ok = await api.isAdminAuthenticated();
    if (ok) {
      localStorage.setItem(AUTH_KEYS.verifiedKey, '1');
      return true;
    }
  } catch (e) {
    // Unauthorized — fall through
  }
  clearVerified();
  return false;
}

/**
 * Get current admin session data (Firebase user snapshot).
 */
function getSession() {
  const user = typeof getCurrentFirebaseUser === 'function' ? getCurrentFirebaseUser() : null;
  if (!user || localStorage.getItem(AUTH_KEYS.verifiedKey) !== '1') return null;
  return {
    email: user.email,
    name: user.displayName || 'Admin',
    role: 'admin',
    uid: user.uid,
  };
}

/**
 * Logout — signs out of Firebase and clears local trust flags.
 */
async function logout() {
  const api = window.API;
  clearVerified();
  if (api && typeof api.logoutStudent === 'function') {
    return api.logoutStudent();
  }
  return Promise.resolve();
}

/**
 * Protect route — redirect to login if not authenticated.
 */
async function protectRoute() {
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
    return false;
  }
  const ok = await verifyAdminAuth();
  if (!ok) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

/**
 * Change admin password (Firebase).
 */
async function changePassword(currentPassword, newPassword) {
  const user = typeof getCurrentFirebaseUser === 'function' ? getCurrentFirebaseUser() : null;
  if (!user) return { success: false, message: 'Not authenticated.' };
  if (newPassword.length < 6) return { success: false, message: 'New password must be at least 6 characters.' };

  try {
    const fixture = window.firebase && window.firebase.auth ? window.firebase.auth.EmailAuthProvider : null;
    if (fixture) {
      const cred = fixture.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(cred);
    }
    await user.updatePassword(newPassword);
    return { success: true, message: 'Password changed successfully!' };
  } catch (err) {
    let message = 'Failed to change password.';
    if (err && err.code === 'auth/wrong-password') message = 'Current password is incorrect.';
    else if (err && err.code === 'auth/weak-password') message = 'New password must be at least 6 characters.';
    else if (err && err.code === 'auth/requires-recent-login') message = 'Please log in again before changing the password.';
    return { success: false, message };
  }
}

/**
 * Reset password (forgot password flow) — sends a Firebase reset email.
 */
async function resetPassword(email, newPassword, confirmPassword) {
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

/* ── Rate Limiting Helpers (client-side convenience only) ── */
function getAttemptCount() {
  return parseInt(localStorage.getItem(AUTH_KEYS.ATTEMPTS) || '0');
}

function incrementAttempts() {
  const count = getAttemptCount() + 1;
  localStorage.setItem(AUTH_KEYS.ATTEMPTS, count.toString());
}

function clearAttempts() {
  localStorage.removeItem(AUTH_KEYS.ATTEMPTS);
  localStorage.removeItem(AUTH_KEYS.LOCKOUT);
}

function setLockout() {
  localStorage.setItem(AUTH_KEYS.LOCKOUT, (Date.now() + AUTH_CONFIG.lockoutDuration * 1000).toString());
}

function getLockoutStatus() {
  const lockoutUntil = parseInt(localStorage.getItem(AUTH_KEYS.LOCKOUT) || '0');
  if (lockoutUntil > Date.now()) {
    return {
      locked: true,
      remainingSeconds: Math.ceil((lockoutUntil - Date.now()) / 1000)
    };
  }
  if (lockoutUntil > 0) {
    clearAttempts();
  }
  return { locked: false, remainingSeconds: 0 };
}

/* ── Validation Helpers ── */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ── Initialize ── */
initAuth();