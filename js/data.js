/* ===================================================
   DATA LAYER — Course Data & localStorage Manager
   =================================================== */

const DATA_KEYS = {
  COURSES: 'spa_courses',
  CATEGORIES: 'spa_categories',
  REVIEWS: 'spa_reviews',
  WISHLIST: 'spa_wishlist',
  THEME: 'spa_theme',
  LESSON_COMMENTS: 'spa_lesson_comments'
};

// ── Default Categories ──
const DEFAULT_CATEGORIES = [
  'Painting',
  'Acrylic Painting',
  'Colour Pencil Painting',
  'Portrait Painting',
  'Oil Painting',
  'Realism Painting',
  'Charcoal Drawing',
  'Watercolor Painting',
  'Sketching Basics'
];

// ── Sample Course Data ──
const SAMPLE_COURSES = [
  {
    id: 1,
    title: 'Portrait Mastery Course',
    about: 'Complete 4-Level Training Program for portrait artists. Learn anatomy, proportions, shading, and color theory.',
    syllabus: 'Level 1: Basics of Face Structure\nLevel 2: Eye, Nose, Lips Detail\nLevel 3: Hair & Skin Textures\nLevel 4: Complete Portrait Composition',
    description: 'A complete roadmap to becoming a professional portrait artist with personalized mentorship from Sarojit Pal.',
    thumbnail: 'assets/images/course_portrait.png',
    category: 'Portrait Painting',
    level: 'Advanced',
    pricing: 'paid',
    originalPrice: 8999,
    discountPrice: 4999,
    duration: '9 Months',
    enrollments: 347,
    createdAt: '2024-06-15',
    lessons: [
      { id: 1, title: 'Introduction to Portrait Drawing', videoUrl: 'https://www.youtube.com/watch?v=PVN0dvdzwmQ' },
      { id: 2, title: 'Understanding Face Proportions', videoUrl: 'https://www.youtube.com/watch?v=II4cSVIrNHY' },
      { id: 3, title: 'Drawing Eyes in Detail', videoUrl: 'https://www.youtube.com/watch?v=rTy8rCuutkc' },
      { id: 4, title: 'Nose & Lips Techniques', videoUrl: 'https://www.youtube.com/watch?v=FEKfY63IAZg' },
      { id: 5, title: 'Hair Texture Mastery', videoUrl: 'https://www.youtube.com/watch?v=bUTajU8SGF4' }
    ]
  },
  {
    id: 2,
    title: 'Advance Batch — Monthly Mentorship',
    about: 'Advanced monthly training for serious artists who want professional-level output.',
    syllabus: 'Monthly structured assignments\nPersonal 1-on-1 feedback\nAdvanced rendering techniques\nPortfolio building',
    description: 'Monthly fees | Online — A complete roadmap to becoming a professional portrait artist.',
    thumbnail: 'assets/images/course_charcoal.png',
    category: 'Realism Painting',
    level: 'Advanced',
    pricing: 'paid',
    originalPrice: 4900,
    discountPrice: 1999,
    duration: 'Monthly',
    enrollments: 512,
    createdAt: '2024-03-10',
    lessons: [
      { id: 1, title: 'Welcome & Assessment', videoUrl: 'https://www.youtube.com/watch?v=H9eD722cIFE' },
      { id: 2, title: 'Advanced Shading Methods', videoUrl: 'https://www.youtube.com/watch?v=eO3K6kXW1mE' },
      { id: 3, title: 'Realism Rendering Deep Dive', videoUrl: 'https://www.youtube.com/watch?v=M_QXQhq7VGs' }
    ]
  },
  {
    id: 3,
    title: 'Colour Creation Batch',
    about: 'Focused training to improve your colored pencil realism and color theory skills.',
    syllabus: 'Color Wheel & Theory\nBlending Techniques\nLayering with Prismacolor\nCreating Realistic Skin Tones\nFinal Project',
    description: 'Monthly | Online — Focused training to improve your colored pencil realism.',
    thumbnail: 'assets/images/course_colour_pencil.png',
    category: 'Colour Pencil Painting',
    level: 'Intermediate',
    pricing: 'paid',
    originalPrice: 5000,
    discountPrice: 3200,
    duration: '2 Months',
    enrollments: 289,
    createdAt: '2024-08-20',
    lessons: [
      { id: 1, title: 'Color Theory Fundamentals', videoUrl: 'https://www.youtube.com/watch?v=DQohqBJO34o' },
      { id: 2, title: 'Blending & Layering', videoUrl: 'https://www.youtube.com/watch?v=b2itvHPgApw' },
      { id: 3, title: 'Skin Tone Techniques', videoUrl: 'https://www.youtube.com/watch?v=NkFYBA6jH2k' }
    ]
  },
  {
    id: 4,
    title: 'Acrylic Painting for Beginners',
    about: 'Start your acrylic painting journey with structured lessons on brushwork, mixing, and composition.',
    syllabus: 'Materials & Setup\nBrush Techniques\nColor Mixing\nLandscape Painting\nAbstract Basics',
    description: 'Learn acrylic painting from scratch with easy-to-follow lessons and hands-on practice.',
    thumbnail: 'assets/images/course_acrylic.png',
    category: 'Acrylic Painting',
    level: 'Beginner',
    pricing: 'paid',
    originalPrice: 3500,
    discountPrice: 1999,
    duration: '6 Weeks',
    enrollments: 198,
    createdAt: '2025-01-05',
    lessons: [
      { id: 1, title: 'Setting Up Your Palette', videoUrl: 'https://www.youtube.com/watch?v=mQDwZx9fvuc' },
      { id: 2, title: 'Basic Brush Strokes', videoUrl: 'https://www.youtube.com/watch?v=HAjvBLGIKI8' },
      { id: 3, title: 'Color Mixing Masterclass', videoUrl: 'https://www.youtube.com/watch?v=_Feu5wU0Dds' }
    ]
  },
  {
    id: 5,
    title: 'Oil Painting — Classical Techniques',
    about: 'Master oil painting with classical approaches including glazing, impasto, and underpainting.',
    syllabus: 'Oil Paint Properties\nUnderpainting\nGlazing Technique\nImpasto Method\nStill Life Project',
    description: 'Deep dive into classical oil painting techniques used by the old masters.',
    thumbnail: 'assets/images/course_oil.png',
    category: 'Oil Painting',
    level: 'Intermediate',
    pricing: 'paid',
    originalPrice: 10500,
    discountPrice: 6500,
    duration: '4 Months',
    enrollments: 156,
    createdAt: '2024-11-12',
    lessons: [
      { id: 1, title: 'Understanding Oil Paints', videoUrl: 'https://www.youtube.com/watch?v=xIJhIboY7YU' },
      { id: 2, title: 'Underpainting Techniques', videoUrl: 'https://www.youtube.com/watch?v=UmCSgxmrSBw' },
      { id: 3, title: 'Glazing for Depth', videoUrl: 'https://www.youtube.com/watch?v=YjENacAQn_k' },
      { id: 4, title: 'Impasto Texture Effects', videoUrl: 'https://www.youtube.com/watch?v=awHSjHT6_do' }
    ]
  },
  {
    id: 6,
    title: 'Charcoal Drawing Masterclass',
    about: 'Create dramatic charcoal artworks with professional-grade techniques in value and contrast.',
    syllabus: 'Charcoal Types & Papers\nValue Scale Exercises\nPortrait in Charcoal\nDramatic Lighting\nFinal Exhibition Piece',
    description: 'Learn to create stunning charcoal portraits with dramatic contrast and emotion.',
    thumbnail: 'assets/images/course_charcoal.png',
    category: 'Charcoal Drawing',
    level: 'Intermediate',
    pricing: 'paid',
    originalPrice: 3000,
    discountPrice: 1500,
    duration: '1 Month',
    enrollments: 421,
    createdAt: '2024-09-01',
    lessons: [
      { id: 1, title: 'Materials & Mark Making', videoUrl: 'https://www.youtube.com/watch?v=_flQYCtqU5w' },
      { id: 2, title: 'Value & Contrast', videoUrl: 'https://www.youtube.com/watch?v=oRwCECMQ7ko' },
      { id: 3, title: 'Portrait Workshop', videoUrl: 'https://www.youtube.com/watch?v=ZAh1M-u5mkI' }
    ]
  },
  {
    id: 7,
    title: 'Sketching Fundamentals — Free Course',
    about: 'Free introductory course covering the basics of sketching, observation, and line work.',
    syllabus: 'Holding the Pencil\nBasic Shapes\nPerspective Intro\nLight & Shadow Basics',
    description: 'Start your art journey with this free course on sketching fundamentals and observation.',
    thumbnail: 'assets/images/course_portrait.png',
    category: 'Sketching Basics',
    level: 'Beginner',
    pricing: 'free',
    originalPrice: 1500,
    discountPrice: 0,
    duration: '2 Weeks',
    enrollments: 872,
    createdAt: '2024-01-01',
    lessons: [
      { id: 1, title: 'Getting Started with Sketching', videoUrl: 'https://www.youtube.com/watch?v=SJDr8XaKr9I' },
      { id: 2, title: 'Basic Shapes & Forms', videoUrl: 'https://www.youtube.com/watch?v=eejD5qzgLvU' }
    ]
  },
  {
    id: 8,
    title: 'Watercolor Painting Essentials',
    about: 'Explore the beauty of watercolors with wet-on-wet, wet-on-dry, and blending techniques.',
    syllabus: 'Watercolor Basics\nWet-on-Wet Technique\nWet-on-Dry Technique\nFloral Painting\nLandscape Project',
    description: 'Discover the fluid beauty of watercolor painting with guided lessons and projects.',
    thumbnail: 'assets/images/course_acrylic.png',
    category: 'Watercolor Painting',
    level: 'Beginner',
    pricing: 'paid',
    originalPrice: 4000,
    discountPrice: 2500,
    duration: '6 Weeks',
    enrollments: 234,
    createdAt: '2025-02-14',
    lessons: [
      { id: 1, title: 'Watercolor Materials Guide', videoUrl: 'https://www.youtube.com/watch?v=mAxocySRjlE' },
      { id: 2, title: 'Wet-on-Wet Magic', videoUrl: 'https://www.youtube.com/watch?v=iW_fXUrQvNs' },
      { id: 3, title: 'Painting Flowers', videoUrl: 'https://www.youtube.com/watch?v=CxHgV1IWasc' }
    ]
  },
  {
    id: 9,
    title: 'Realism Drawing — Photorealistic Art',
    about: 'Push your art to photorealistic levels with precision rendering techniques.',
    syllabus: 'Observation Training\nGrid Method\nTexture Rendering\nMetal & Glass Surfaces\nHyperrealism Project',
    description: 'Learn the secrets of photorealistic drawing with advanced rendering methods.',
    thumbnail: 'assets/images/course_colour_pencil.png',
    category: 'Realism Painting',
    level: 'Advanced',
    pricing: 'paid',
    originalPrice: 12000,
    discountPrice: 8900,
    duration: '5 Months',
    enrollments: 178,
    createdAt: '2024-07-22',
    lessons: [
      { id: 1, title: 'The Art of Observation', videoUrl: 'https://www.youtube.com/watch?v=ZCU1LSly6Rk' },
      { id: 2, title: 'Grid Technique for Accuracy', videoUrl: 'https://www.youtube.com/watch?v=yATeQAsscJA' },
      { id: 3, title: 'Rendering Textures', videoUrl: 'https://www.youtube.com/watch?v=2ojo5w1PTl0' },
      { id: 4, title: 'Reflective Surfaces', videoUrl: 'https://www.youtube.com/watch?v=toBpRR1KsGM' },
      { id: 5, title: 'Final Hyperrealism Project', videoUrl: 'https://www.youtube.com/watch?v=Asir4z-5_Dw' }
    ]
  },
  {
    id: 10,
    title: 'Painting Composition & Design',
    about: 'Master the art of composition — rule of thirds, golden ratio, color harmony, and visual flow.',
    syllabus: 'Rule of Thirds\nGolden Ratio\nLeading Lines\nColor Harmony\nComposition in Practice',
    description: 'Understand how great paintings are designed — composition principles for all mediums.',
    thumbnail: 'assets/images/course_oil.png',
    category: 'Painting',
    level: 'Intermediate',
    pricing: 'paid',
    originalPrice: 6000,
    discountPrice: 4500,
    duration: '3 Months',
    enrollments: 302,
    createdAt: '2024-05-10',
    lessons: [
      { id: 1, title: 'Introduction to Composition', videoUrl: 'https://www.youtube.com/watch?v=Qb83wWSj0_Q' },
      { id: 2, title: 'Rule of Thirds & Golden Ratio', videoUrl: 'https://www.youtube.com/watch?v=lH4eXEaWXpk' },
      { id: 3, title: 'Color Harmony in Paintings', videoUrl: 'https://www.youtube.com/watch?v=iUHCJ-nSwVw' }
    ]
  },
  {
    id: 11,
    title: 'Portrait Painting with Acrylics',
    about: 'Combine portrait skills with acrylic medium for vibrant, expressive portrait paintings.',
    syllabus: 'Acrylic Portrait Setup\nSkin Tone Mixing\nFacial Features in Color\nBackground Design\nFinal Portrait',
    description: 'Create stunning acrylic portraits with professional color techniques.',
    thumbnail: 'assets/images/course_acrylic.png',
    category: 'Acrylic Painting',
    level: 'Advanced',
    pricing: 'paid',
    originalPrice: 8000,
    discountPrice: 5500,
    duration: '3 Months',
    enrollments: 145,
    createdAt: '2025-03-01',
    lessons: [
      { id: 1, title: 'Acrylic Portrait Foundations', videoUrl: 'https://www.youtube.com/watch?v=E0gkauIPqg8' },
      { id: 2, title: 'Mixing Skin Tones', videoUrl: 'https://www.youtube.com/watch?v=z_LYi5kGEjo' },
      { id: 3, title: 'Painting Eyes & Lips', videoUrl: 'https://www.youtube.com/watch?v=E6u-oW2Q7Uo' }
    ]
  },
  {
    id: 12,
    title: 'Graphite Pencil Mastery — Free Workshop',
    about: 'Free workshop covering essential graphite pencil techniques for realistic drawings.',
    syllabus: 'Pencil Grades Explained\nShading Techniques\nBlending Methods\nSimple Portrait Exercise',
    description: 'A free hands-on workshop to master graphite pencil drawing fundamentals.',
    thumbnail: 'assets/images/course_charcoal.png',
    category: 'Sketching Basics',
    level: 'Beginner',
    pricing: 'free',
    originalPrice: 2000,
    discountPrice: 0,
    duration: '1 Week',
    enrollments: 1043,
    createdAt: '2024-04-01',
    lessons: [
      { id: 1, title: 'Pencil Grades & Uses', videoUrl: 'https://www.youtube.com/watch?v=PVN0dvdzwmQ' },
      { id: 2, title: 'Shading Practice', videoUrl: 'https://www.youtube.com/watch?v=II4cSVIrNHY' }
    ]
  }
];

// ── Sample Reviews ──
const SAMPLE_REVIEWS = [
  {
    id: 1,
    studentName: 'Vijit Ganguly',
    courseId: 1,
    rating: 5,
    text: "In just a few months at Sarojit Pal's art class, I've grown from basic sketching to creating realistic portraits with a good understanding of color theory. He's patient, caring, and gives every student equal attention. Truly an inspiring teacher who makes art feel alive.",
    date: '2024-12-10'
  },
  {
    id: 2,
    studentName: 'Girisha',
    courseId: 2,
    rating: 5,
    text: "Highly Recommended Art Class! Joining this art class has been one of the best decisions of my life. When I started, I only knew basic sketching, but with the teacher's constant guidance, patience, and motivation, I learned how to create realistic and detailed portraits.",
    date: '2025-01-15'
  },
  {
    id: 3,
    studentName: 'Ashlesha',
    courseId: 1,
    rating: 5,
    text: "I have been learning from Sarojit Sir for some time and I can clearly see how much I have improved. He explains every concept with patience and always motivates us to do better. He makes the class interesting and enjoyable.",
    date: '2025-02-20'
  },
  {
    id: 4,
    studentName: 'Rina Dasgupta',
    courseId: 3,
    rating: 4,
    text: "The colour pencil course is amazing! The blending techniques I learned here transformed my artwork completely. Sarojit Sir's approach to teaching color theory is both scientific and artistic.",
    date: '2025-03-05'
  },
  {
    id: 5,
    studentName: 'Arjun Mehta',
    courseId: 6,
    rating: 5,
    text: "The charcoal drawing class was transformative. I never knew I could create such dramatic pieces. The value studies and contrast exercises really opened my eyes to a new way of seeing.",
    date: '2025-03-20'
  },
  {
    id: 6,
    studentName: 'Priya Sharma',
    courseId: 4,
    rating: 4,
    text: "As a complete beginner, I was nervous about starting acrylic painting. But the structured approach and patient guidance made it so easy to follow along. I've already completed 3 paintings I'm proud of!",
    date: '2025-02-28'
  },
  {
    id: 7,
    studentName: 'Debasish Roy',
    courseId: 5,
    rating: 5,
    text: "The oil painting course covers classical techniques I couldn't find anywhere else online. The glazing lessons alone were worth the entire course fee. Exceptional quality instruction.",
    date: '2025-01-10'
  },
  {
    id: 8,
    studentName: 'Sneha Banerjee',
    courseId: 7,
    rating: 5,
    text: "I started with the free sketching course and it gave me such a strong foundation. Now I've enrolled in the portrait mastery course. Sarojit Sir truly cares about each student's growth.",
    date: '2025-04-01'
  }
];

// ── Data Access Functions ──

function initializeData() {
  if (!localStorage.getItem(DATA_KEYS.COURSES)) {
    localStorage.setItem(DATA_KEYS.COURSES, JSON.stringify(SAMPLE_COURSES));
  }
  if (!localStorage.getItem(DATA_KEYS.CATEGORIES)) {
    localStorage.setItem(DATA_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
  }
  if (!localStorage.getItem(DATA_KEYS.REVIEWS)) {
    localStorage.setItem(DATA_KEYS.REVIEWS, JSON.stringify(SAMPLE_REVIEWS));
  }
  if (!localStorage.getItem(DATA_KEYS.WISHLIST)) {
    localStorage.setItem(DATA_KEYS.WISHLIST, JSON.stringify([]));
  }
}

function getCourses() {
  return JSON.parse(localStorage.getItem(DATA_KEYS.COURSES) || '[]');
}

function saveCourses(courses) {
  localStorage.setItem(DATA_KEYS.COURSES, JSON.stringify(courses));
}

function getCourse(id) {
  return getCourses().find(c => c.id === parseInt(id));
}

function addCourse(course) {
  const courses = getCourses();
  course.id = courses.length > 0 ? Math.max(...courses.map(c => c.id)) + 1 : 1;
  course.enrollments = 0;
  course.createdAt = new Date().toISOString().split('T')[0];
  courses.push(course);
  saveCourses(courses);
  return course;
}

function updateCourse(id, updatedData) {
  const courses = getCourses();
  const index = courses.findIndex(c => c.id === parseInt(id));
  if (index !== -1) {
    courses[index] = { ...courses[index], ...updatedData };
    saveCourses(courses);
    return courses[index];
  }
  return null;
}

function deleteCourse(id) {
  const courses = getCourses().filter(c => c.id !== parseInt(id));
  saveCourses(courses);
}

function getCategories() {
  return JSON.parse(localStorage.getItem(DATA_KEYS.CATEGORIES) || '[]');
}

function saveCategories(categories) {
  localStorage.setItem(DATA_KEYS.CATEGORIES, JSON.stringify(categories));
}

function addCategory(name) {
  const categories = getCategories();
  if (!categories.includes(name)) {
    categories.push(name);
    saveCategories(categories);
    return true;
  }
  return false;
}

function deleteCategory(name) {
  const categories = getCategories().filter(c => c !== name);
  saveCategories(categories);
}

function getReviews() {
  return JSON.parse(localStorage.getItem(DATA_KEYS.REVIEWS) || '[]');
}

function saveReviews(reviews) {
  localStorage.setItem(DATA_KEYS.REVIEWS, JSON.stringify(reviews));
}

function addReview(review) {
  const reviews = getReviews();
  review.id = reviews.length > 0 ? Math.max(...reviews.map(r => r.id)) + 1 : 1;
  review.date = new Date().toISOString().split('T')[0];
  reviews.push(review);
  saveReviews(reviews);
  return review;
}

function deleteReview(id) {
  const reviews = getReviews().filter(r => r.id !== parseInt(id));
  saveReviews(reviews);
}

function getWishlist() {
  return JSON.parse(localStorage.getItem(DATA_KEYS.WISHLIST) || '[]');
}

function saveWishlist(wishlist) {
  localStorage.setItem(DATA_KEYS.WISHLIST, JSON.stringify(wishlist));
}

function toggleWishlistItem(courseId) {
  const wishlist = getWishlist();
  const index = wishlist.indexOf(courseId);
  if (index === -1) {
    wishlist.push(courseId);
  } else {
    wishlist.splice(index, 1);
  }
  saveWishlist(wishlist);
  return wishlist.includes(courseId);
}

function getTheme() {
  return localStorage.getItem(DATA_KEYS.THEME) || 'light';
}

function setTheme(theme) {
  localStorage.setItem(DATA_KEYS.THEME, theme);
  document.documentElement.setAttribute('data-theme', theme);
}

// ── Lesson Comments ──
function getAllLessonComments() {
  return JSON.parse(localStorage.getItem(DATA_KEYS.LESSON_COMMENTS) || '[]');
}

function saveAllLessonComments(comments) {
  localStorage.setItem(DATA_KEYS.LESSON_COMMENTS, JSON.stringify(comments));
}

function getLessonComments(courseId, lessonIndex) {
  const allComments = getAllLessonComments();
  return allComments.filter(c => c.courseId == courseId && c.lessonIndex == lessonIndex).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function addLessonComment(courseId, lessonIndex, comment) {
  const allComments = getAllLessonComments();
  const newComment = {
    id: Date.now(),
    courseId: courseId,
    lessonIndex: lessonIndex,
    studentName: comment.studentName,
    text: comment.text,
    rating: comment.rating,
    image: comment.image || null,
    date: new Date().toISOString()
  };
  allComments.push(newComment);
  saveAllLessonComments(allComments);
  return newComment;
}

function deleteLessonCommentPhoto(commentId) {
  const allComments = getAllLessonComments();
  const index = allComments.findIndex(c => c.id == commentId);
  if (index !== -1) {
    allComments[index].image = null;
    if (!allComments[index].text && !allComments[index].rating) {
      allComments.splice(index, 1);
    }
    saveAllLessonComments(allComments);
  }
}

// Initialize on load
initializeData();
