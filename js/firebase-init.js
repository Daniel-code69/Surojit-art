
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

  const res = await fetch(url, { ...options, headers, body: options.body ? JSON.stringify(options.body) : undefined });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}
