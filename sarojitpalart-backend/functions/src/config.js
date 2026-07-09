const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

const config = {
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'SarojitPalArtBot',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  },
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'Sarojit Pal Art <palsorojit194@gmail.com>',
  },
  adminSetupSecret: process.env.ADMIN_SETUP_SECRET || '',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'sarojitpalart',
  corsOrigins: [
    'https://sarojitpalart.com',
    'http://localhost:5500',
    'http://localhost:5000',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5000',
  ],
};

module.exports = { admin, db, auth, storage, config };
