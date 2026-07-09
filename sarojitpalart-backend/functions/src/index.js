const functions = require('firebase-functions');
const app = require('./app');
const { onStudentCreate } = require('./student/profile');

// Export the Express app as a single Cloud Function (minimizes cold starts)
exports.api = functions.https.onRequest(app);

// Auth onCreate trigger - creates Firestore student doc on new sign-up
exports.onStudentCreate = functions.auth.user().onCreate(async (userRecord) => {
  try {
    await onStudentCreate(userRecord);
  } catch (err) {
    console.error('onStudentCreate error:', err);
  }
});
