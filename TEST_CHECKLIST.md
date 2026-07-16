# Manual Test Checklist — Video Access Security

## Prerequisites
- Deploy the backend: `firebase deploy --only functions`
- Ensure Firestore rules are deployed: `firebase deploy --only firestore:rules`
- The frontend can be served locally or from Firebase Hosting

---

### 1. Logged-out visitor cannot access videoUrl

**API test:**
- Open browser DevTools, run:
  ```js
  fetch('/api/v1/courses/{courseId}/lessons-preview')
    .then(r => r.json())
    .then(console.log)
  ```
- EXPECTED: Returns lesson titles/thumbnails only — NO `videoUrl` field.

- Run:
  ```js
  fetch('/api/v1/courses/{courseId}/lessons')
    .then(r => r.json())
    .then(console.log)
  ```
- EXPECTED: Returns 403 or 401 error (no auth token).

**Firestore SDK test (browser console):**
  ```js
  firebase.firestore().collection('courses').doc('{courseId}')
    .collection('lessons').get()
    .then(snap => snap.forEach(d => console.log(d.data())))
  ```
- EXPECTED: Permission denied (Firestore rules deny read on lessons for non-enrolled users).

---

### 2. Logged-in, non-enrolled student cannot fetch videoUrl

- Log in as a student who has NOT purchased course X.
- Open course player for course X (`course-player.html?id={courseId}`).
- EXPECTED: Alert "You are not enrolled in this course" and redirect to dashboard.

**API test (console):**
  ```js
  const token = await firebase.auth().currentUser.getIdToken();
  fetch('/api/v1/courses/{courseId}/lessons', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(r => r.json()).then(console.log)
  ```
- EXPECTED: 403 — `"You are not enrolled in this course"`.

**Firestore SDK test:**
  ```js
  firebase.firestore().collection('courses').doc('{courseId}')
    .collection('lessons').get()
    .then(snap => snap.forEach(d => console.log(d.data())))
  ```
- EXPECTED: Permission denied (isEnrolled returns false).

---

### 3. Enrolled student can fetch and play videoUrl

- Log in as a student enrolled in course Y.
- Open `course-player.html?id={courseId}`.
- EXPECTED: Lesson list loads, clicking a lesson plays the YouTube video.
- Verify the API response includes `videoUrl`:
  ```js
  const token = await firebase.auth().currentUser.getIdToken();
  fetch('/api/v1/courses/{courseId}/lessons', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(r => r.json()).then(console.log)
  ```
- EXPECTED: 200, each lesson object has `videoUrl`.

---

### 4. Enrolling in course A does NOT leak course B's videoUrl

- Student is enrolled in course A but NOT course B.
- Fetch course B's lessons via API:
  ```js
  const token = await firebase.auth().currentUser.getIdToken();
  fetch('/api/v1/courses/{courseBId}/lessons', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(r => r.json()).then(console.log)
  ```
- EXPECTED: 403 — not enrolled.

---

### 5. Direct Firestore writes to enrolledCourseIds are rejected

**As a signed-in student (browser console):**
  ```js
  const uid = firebase.auth().currentUser.uid;
  firebase.firestore().collection('students').doc(uid).update({
    enrolledCourseIds: firebase.firestore.FieldValue.arrayUnion('fake-course-id')
  }).then(() => console.log('ALLOWED'), err => console.log('REJECTED:', err.message))
  ```
- EXPECTED: Permission denied — the Firestore rules only allow updates to `name`, `email`, `telegramUserId`, `telegramUsername`, `isVerified`, `updatedAt`. `enrolledCourseIds` is not in the allowed list.

**Direct Firestore write to enrollments:**
  ```js
  firebase.firestore().collection('enrollments').add({
    studentId: uid,
    courseId: 'fake-course-id',
    enrolledAt: new Date()
  }).then(() => console.log('ALLOWED'), err => console.log('REJECTED:', err.message))
  ```
- EXPECTED: Permission denied (`allow create, update, delete: if false`).

---

### 6. Public course preview modal does not show videoUrl

- As a logged-out visitor, open `index.html` and click on a course card.
- EXPECTED: The modal shows course metadata, syllabus, and (if configured) a `demoVideoUrl` promo video. It does NOT show any lesson `videoUrl`. Lesson previews show locked icons with "Enroll to unlock" messaging.

---

### 7. Admin lesson editor includes videoUrl field

- Log in to `login.html` as admin.
- Navigate to Manage Courses → Edit a course.
- In the Lessons section, each lesson row has:
  - Title input
  - **Video URL input** (for pasting unlisted YouTube link)
- Create/edit a lesson, set the videoUrl, save.
- Verify the enrolled student's API response includes the new videoUrl.

---

## Notes

- VideoUrl is an unlisted YouTube link only. No video bytes touch Firebase Storage.
- Enrolled students can share raw YouTube links (accepted limitation of YouTube-based delivery).
- To re-enable Telegram notifications (not video delivery), uncomment the `telegramService` imports in functions/src/app.js and add back the route mounts.
