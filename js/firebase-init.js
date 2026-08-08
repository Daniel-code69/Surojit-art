/* ===================================================
   API CLIENT — Firebase Auth + Backend API Integration
   Single source of truth for the frontend.
   =================================================== */

const API_BASE = '/api/v1';

const firebaseConfig = {
  apiKey: "AIzaSyCZ8FReG72BmSKvR3bK_rNpzCgJKykTW7k",
  authDomain: "sarojitpalart.firebaseapp.com",
  projectId: "sarojitpalart",
  storageBucket: "sarojitpalart.firebasestorage.app",
  messagingSenderId: "186163471242",
  appId: "1:186163471242:web:40ca5f6f526f7f1e863fe1"
};

let firebaseApp = null;
let firebaseAuth = null;

function initFirebase() {
  if (firebaseApp) return;
  firebaseApp = firebase.initializeApp(firebaseConfig);
  firebaseAuth = firebase.auth(firebaseApp);
  firebaseAuth.useDeviceLanguage();
}

/**
 * Get current signed-in user planning to attach an ID token to authenticated calls.
 */
async function getFirebaseToken() {
  if (!firebaseAuth) initFirebase();
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

function getCurrentFirebaseUser() {
  if (!firebaseAuth) initFirebase();
  return firebaseAuth.currentUser;
}

/**
 * Generic fetch to the backend API. Attaches a Firebase ID token by default.
 * options: { method, body, auth (true|false), headers }
 */
async function apiFetch(path, options = {}) {
  const url = API_BASE + path;
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  if (options.auth !== false) {
    try {
      const token = await getFirebaseToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {
      if (options.auth === true) throw e;
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let errMessage = res.statusText;
    try {
      const err = await res.json();
      if (err && err.error) errMessage = err.error;
    } catch (e) { /* ignore */ }
    const error = new Error(errMessage);
    error.status = res.status;
    throw error;
  }
  const contentType = res.headers.get('content-type') || '';
  return contentType.includes('application/json') ? res.json() : res.text();
}

// ── Auth State Observer ──
function onAuthStateChanged(callback) {
  if (!firebaseAuth) initFirebase();
  return firebaseAuth.onAuthStateChanged(callback);
}

// ── Student Auth ──
async function registerStudent(name, email, password) {
  if (!firebaseAuth) initFirebase();
  const cred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
  await cred.user.updateProfile({ displayName: name });
  await apiFetch('/student/profile/create', {
    method: 'POST',
    body: { name, email, uid: cred.user.uid },
  });
  return { uid: cred.user.uid, email, name };
}

async function loginStudent(email, password) {
  if (!firebaseAuth) initFirebase();
  const cred = await firebaseAuth.signInWithEmailAndPassword(email, password);
  return { uid: cred.user.uid, email: cred.user.email, name: cred.user.displayName };
}

function logoutStudent() {
  if (firebaseAuth) return firebaseAuth.signOut();
  return Promise.resolve();
}

async function resetStudentPassword(email) {
  if (!firebaseAuth) initFirebase();
  return firebaseAuth.sendPasswordResetEmail(email);
}

// ── Admin Auth (Firebase custom claims) ──
async function loginAdmin(email, password) {
  if (!firebaseAuth) initFirebase();
  const cred = await firebaseAuth.signInWithEmailAndPassword(email, password);
  try {
    const me = await apiFetch('/admin/auth/me', { auth: true });
    if (!me.admin) {
      await firebaseAuth.signOut();
      throw new Error('This account is not an admin');
    }
    return { uid: cred.user.uid, email: cred.user.email, ...me };
  } catch (err) {
    await firebaseAuth.signOut();
    throw err;
  }
}

async function isAdminAuthenticated() {
  const user = getCurrentFirebaseUser();
  if (!user) return false;
  try {
    const me = await apiFetch('/admin/auth/me', { auth: true });
    return !!me.admin;
  } catch (e) {
    return false;
  }
}

// ── Exports for browser pages ──
window.API = {
  initFirebase,
  apiFetch,
  onAuthStateChanged,
  getCurrentFirebaseUser,
  getFirebaseToken,
  registerStudent,
  loginStudent,
  logoutStudent,
  resetStudentPassword,
  loginAdmin,
  isAdminAuthenticated,
};