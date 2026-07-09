/* ===================================================
   AUTH — Authentication System
   SHA-256 hashing, session tokens, route protection
   =================================================== */

const AUTH_KEYS = {
  SESSION: 'spa_auth_session',
  REMEMBER: 'spa_auth_remember',
  ATTEMPTS: 'spa_auth_attempts',
  LOCKOUT: 'spa_auth_lockout',
  ADMIN_HASH: 'spa_admin_hash'
};

// ── Configuration ──
const AUTH_CONFIG = {
  maxAttempts: 5,
  lockoutDuration: 60, // seconds
  sessionDuration: 30 * 60 * 1000, // 30 minutes
  rememberDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
  tokenPrefix: 'SPA_TOKEN_'
};

// ── Default Admin Credentials (SHA-256 hashed) ──
// Default: email = admin@sarojitpalart.com, password = admin123
const DEFAULT_ADMIN = {
  email: 'admin@sarojitpalart.com',
  name: 'Sarojit Pal',
  role: 'admin'
};

// Pre-computed SHA-256 hash of "admin123"
const DEFAULT_PASSWORD_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

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
  return AUTH_CONFIG.tokenPrefix + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Initialize admin credentials on first visit
 */
function initAuth() {
  if (!localStorage.getItem(AUTH_KEYS.ADMIN_HASH)) {
    localStorage.setItem(AUTH_KEYS.ADMIN_HASH, JSON.stringify({
      email: DEFAULT_ADMIN.email,
      passwordHash: DEFAULT_PASSWORD_HASH,
      name: DEFAULT_ADMIN.name,
      role: DEFAULT_ADMIN.role
    }));
  }
}

/**
 * Attempt login
 * @returns {Object} { success, message, redirect }
 */
async function attemptLogin(email, password, rememberMe = false) {
  // Check lockout
  const lockout = getLockoutStatus();
  if (lockout.locked) {
    return {
      success: false,
      message: `Too many attempts. Try again in ${lockout.remainingSeconds} seconds.`,
      locked: true,
      remainingSeconds: lockout.remainingSeconds
    };
  }

  // Validate inputs
  if (!email || !password) {
    return { success: false, message: 'Please fill in all fields.' };
  }

  if (!isValidEmail(email)) {
    return { success: false, message: 'Please enter a valid email address.' };
  }

  // Get stored admin
  const admin = JSON.parse(localStorage.getItem(AUTH_KEYS.ADMIN_HASH));
  if (!admin) {
    return { success: false, message: 'Authentication system error.' };
  }

  // Hash the input password and compare
  const inputHash = await hashPassword(password);

  if (email.toLowerCase() === admin.email.toLowerCase() && inputHash === admin.passwordHash) {
    // Success — clear attempts
    clearAttempts();

    // Create session
    const token = generateToken();
    const session = {
      token,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      createdAt: Date.now(),
      expiresAt: Date.now() + (rememberMe ? AUTH_CONFIG.rememberDuration : AUTH_CONFIG.sessionDuration)
    };

    // Store session
    if (rememberMe) {
      localStorage.setItem(AUTH_KEYS.SESSION, JSON.stringify(session));
      localStorage.setItem(AUTH_KEYS.REMEMBER, 'true');
    } else {
      sessionStorage.setItem(AUTH_KEYS.SESSION, JSON.stringify(session));
      localStorage.removeItem(AUTH_KEYS.REMEMBER);
    }

    return {
      success: true,
      message: 'Login successful! Redirecting...',
      redirect: 'admin.html'
    };
  } else {
    // Failed — increment attempts
    incrementAttempts();
    const remaining = AUTH_CONFIG.maxAttempts - getAttemptCount();

    if (remaining <= 0) {
      setLockout();
      return {
        success: false,
        message: `Too many failed attempts. Account locked for ${AUTH_CONFIG.lockoutDuration} seconds.`,
        locked: true,
        remainingSeconds: AUTH_CONFIG.lockoutDuration
      };
    }

    return {
      success: false,
      message: `Invalid credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
    };
  }
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  // Check sessionStorage first, then localStorage (remember me)
  let session = sessionStorage.getItem(AUTH_KEYS.SESSION);
  if (!session) {
    session = localStorage.getItem(AUTH_KEYS.SESSION);
  }

  if (!session) return false;

  try {
    const data = JSON.parse(session);

    // Check token format
    if (!data.token || !data.token.startsWith(AUTH_CONFIG.tokenPrefix)) return false;

    // Check expiration
    if (Date.now() > data.expiresAt) {
      logout();
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Get current session data
 */
function getSession() {
  let session = sessionStorage.getItem(AUTH_KEYS.SESSION);
  if (!session) {
    session = localStorage.getItem(AUTH_KEYS.SESSION);
  }

  if (!session) return null;

  try {
    const data = JSON.parse(session);
    if (Date.now() > data.expiresAt) {
      logout();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Logout — clear all session data
 */
function logout() {
  sessionStorage.removeItem(AUTH_KEYS.SESSION);
  localStorage.removeItem(AUTH_KEYS.SESSION);
  localStorage.removeItem(AUTH_KEYS.REMEMBER);
}

/**
 * Protect route — redirect to login if not authenticated
 */
function protectRoute() {
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

/**
 * Change admin password
 */
async function changePassword(currentPassword, newPassword) {
  const admin = JSON.parse(localStorage.getItem(AUTH_KEYS.ADMIN_HASH));
  if (!admin) return { success: false, message: 'System error.' };

  const currentHash = await hashPassword(currentPassword);
  if (currentHash !== admin.passwordHash) {
    return { success: false, message: 'Current password is incorrect.' };
  }

  if (newPassword.length < 6) {
    return { success: false, message: 'New password must be at least 6 characters.' };
  }

  const newHash = await hashPassword(newPassword);
  admin.passwordHash = newHash;
  localStorage.setItem(AUTH_KEYS.ADMIN_HASH, JSON.stringify(admin));

  return { success: true, message: 'Password changed successfully!' };
}

/**
 * Reset password (forgot password flow)
 * In a real app, this would send an email. Here we simulate with a security check.
 */
async function resetPassword(email, newPassword, confirmPassword) {
  const admin = JSON.parse(localStorage.getItem(AUTH_KEYS.ADMIN_HASH));
  if (!admin) return { success: false, message: 'System error.' };

  if (email.toLowerCase() !== admin.email.toLowerCase()) {
    return { success: false, message: 'Email address not found.' };
  }

  if (newPassword.length < 6) {
    return { success: false, message: 'Password must be at least 6 characters.' };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, message: 'Passwords do not match.' };
  }

  const newHash = await hashPassword(newPassword);
  admin.passwordHash = newHash;
  localStorage.setItem(AUTH_KEYS.ADMIN_HASH, JSON.stringify(admin));

  return { success: true, message: 'Password reset successfully! You can now login.' };
}

/* ── Rate Limiting Helpers ── */

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

  // Lockout expired — clear it
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
