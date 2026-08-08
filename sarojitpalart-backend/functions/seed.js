/**
 * Firestore seed script — populates categories, published courses and lessons
 * so the site has real backend content on first deploy.
 *
 * Usage (from functions/):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json node seed.js
 */
const admin = require('firebase-admin');
const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else if (process.env.FIRESTORE_EMULATOR_HOST) {
  // Local development against the Firebase emulator suite
  admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'sarojitpalart' });
} else {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS (or run with FIRESTORE_EMULATOR_HOST for local dev).');
  process.exit(1);
}

const db = admin.firestore();

// ── Categories ──
const CATEGORIES = [
  'Painting',
  'Acrylic Painting',
  'Colour Pencil Painting',
  'Portrait Painting',
  'Oil Painting',
  'Realism Painting',
  'Charcoal Drawing',
  'Watercolor Painting',
  'Sketching Basics',
];

// ── Courses ──
// Fields match the backend course schema: title, slug, description,
// shortDescription, thumbnail, price, discountedPrice, level, status,
// categoryId, categoryName, enrollmentCount, demoVideoUrl, lessons[].
const COURSES = [
  {
    title: 'Portrait Mastery Course',
    description:
      'A complete roadmap to becoming a professional portrait artist with personalized mentorship from Sarojit Pal. Learn anatomy, proportions, shading, and color theory.',
    shortDescription: 'Complete 4-Level Training Program for portrait artists.',
    thumbnail: 'assets/images/course_portrait.png',
    price: 8999,
    discountedPrice: 4999,
    level: 'ADVANCED',
    categoryName: 'Portrait Painting',
    duration: '9 Months',
    demoVideoUrl: 'https://www.youtube.com/watch?v=PVN0dvdzwmQ',
    lessons: [
      { title: 'Introduction to Portrait Drawing', videoUrl: 'https://www.youtube.com/watch?v=PVN0dvdzwmQ', order: 1 },
      { title: 'Understanding Face Proportions', videoUrl: 'https://www.youtube.com/watch?v=II4cSVIrNHY', order: 2 },
      { title: 'Drawing Eyes in Detail', videoUrl: 'https://www.youtube.com/watch?v=rTy8rCuutkc', order: 3 },
      { title: 'Nose & Lips Techniques', videoUrl: 'https://www.youtube.com/watch?v=FEKfY63IAZg', order: 4 },
      { title: 'Hair Texture Mastery', videoUrl: 'https://www.youtube.com/watch?v=bUTajU8SGF4', order: 5 },
    ],
  },
  {
    title: 'Advance Batch — Monthly Mentorship',
    slug: 'advance-batch-monthly-mentorship',
    description: 'Advanced monthly training for serious artists who want professional-level output.',
    shortDescription: 'Advanced monthly training with personal 1-on-1 feedback.',
    thumbnail: 'assets/images/course_charcoal.png',
    price: 4900,
    discountedPrice: 1999,
    level: 'ADVANCED',
    categoryName: 'Realism Painting',
    duration: 'Monthly',
    demoVideoUrl: 'https://www.youtube.com/watch?v=H9eD722cIFE',
    lessons: [
      { title: 'Welcome & Assessment', videoUrl: 'https://www.youtube.com/watch?v=H9eD722cIFE', order: 1 },
      { title: 'Advanced Shading Methods', videoUrl: 'https://www.youtube.com/watch?v=eO3K6kXW1mE', order: 2 },
      { title: 'Realism Rendering Deep Dive', videoUrl: 'https://www.youtube.com/watch?v=M_QXQhq7VGs', order: 3 },
    ],
  },
  {
    title: 'Colour Creation Batch',
    slug: 'colour-creation-batch',
    description: 'Focused training to improve your colored pencil realism and color theory skills.',
    shortDescription: 'Improve colored-pencil realism and master color theory.',
    price: 5000,
    discountedPrice: 3200,
    level: 'INTERMEDIATE',
    categoryName: 'Colour Pencil Painting',
    duration: '2 Months',
    demoVideoUrl: 'https://www.youtube.com/watch?v=DQohqBJO34o',
    lessons: [
      { title: 'Color Theory Fundamentals', videoUrl: 'https://www.youtube.com/watch?v=DQohqBJO34o', order: 1 },
      { title: 'Blending & Layering', videoUrl: 'https://www.youtube.com/watch?v=b2itvHPgApw', order: 2 },
      { title: 'Skin Tone Techniques', videoUrl: 'https://www.youtube.com/watch?v=NkFYBA6jH2k', order: 3 },
    ],
  },
  {
    title: 'Acrylic Painting for Beginners',
    slug: 'acrylic-painting-beginners',
    description: 'Learn acrylic painting from scratch with easy-to-follow lessons on brushwork, mixing, and composition.',
    shortDescription: 'Start your acrylic painting journey with structured lessons.',
    price: 3500,
    discountedPrice: 1999,
    level: 'BEGINNER',
    categoryName: 'Acrylic Painting',
    duration: '6 Weeks',
    demoVideoUrl: 'https://www.youtube.com/watch?v=mQDwZx9fvuc',
    lessons: [
      { title: 'Setting Up Your Palette', videoUrl: 'https://www.youtube.com/watch?v=mQDwZx9fvuc', order: 1 },
      { title: 'Basic Brush Strokes', videoUrl: 'https://www.youtube.com/watch?v=HAjvBLGIKI8', order: 2 },
      { title: 'Color Mixing Masterclass', videoUrl: 'https://www.youtube.com/watch?v=_Feu5wU0Dds', order: 3 },
    ],
  },
  {
    title: 'Oil Painting — Classical Techniques',
    slug: 'oil-painting-classical-techniques',
    description: 'Deep dive into classical oil painting techniques including glazing, impasto, and underpainting.',
    shortDescription: 'Master classical oil painting techniques of the old masters.',
    price: 10500,
    discountedPrice: 6500,
    level: 'INTERMEDIATE',
    categoryName: 'Oil Painting',
    duration: '4 Months',
    demoVideoUrl: 'https://www.youtube.com/watch?v=_Feu5wU0Dds',
    lessons: [
      { title: 'Oil Paint Properties', videoUrl: 'https://www.youtube.com/watch?v=_Feu5wU0Dds', order: 1 },
      { title: 'Underpainting', videoUrl: 'https://www.youtube.com/watch?v=PVN0dvdzwmQ', order: 2 },
      { title: 'Glazing Technique', videoUrl: 'https://www.youtube.com/watch?v=PVN0dvdzwmQ', order: 3 },
    ],
  },
];

async function slugExists(slug) {
  const snap = await db.collection('courses').where('slug', '==', slug).limit(1).get();
  return !snap.empty;
}

async function seed() {
  const categoryIds = {};
  const batch = db.batch();

  // Categories — only create ones that don't exist yet.
  for (const name of CATEGORIES) {
    const snap = await db.collection('categories').where('name', '==', name).limit(1).get();
    if (!snap.empty) {
      categoryIds[name] = snap.docs[0].id;
      continue;
    }
    const ref = db.collection('categories').doc();
    batch.set(ref, {
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    categoryIds[name] = ref.id;
  }
  await batch.commit();
  console.log('Categories ready:', Object.keys(categoryIds).length);

  // Courses — skip ones that already exist (by slug).
  for (const course of COURSES) {
    const slug = course.slug || course.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (await slugExists(slug)) {
      console.log(`Skip (exists): ${course.title}`);
      continue;
    }

    const courseRef = db.collection('courses').doc();
    const { lessons, slug: _slug, ...courseData } = course;

    await db.runTransaction(async (tx) => {
      tx.set(courseRef, {
        ...courseData,
        slug,
        categoryId: categoryIds[course.categoryName] || '',
        status: 'PUBLISHED',
        enrollmentCount: 0,
        syllabus: '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // Lessons as a subcollection
      for (const lesson of lessons) {
        tx.set(courseRef.collection('lessons').doc(), {
          ...lesson,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });
    console.log(`Created: ${course.title} (${courseRef.id})`);
  }

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});