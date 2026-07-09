/* ===================================================
   ADMIN PANEL — CRUD Operations
   =================================================== */

let currentEditCourseId = null;
let currentSection = 'dashboard';

document.addEventListener('DOMContentLoaded', () => {
  initAdminPanel();
});

function initAdminPanel() {
  initializeData();
  setupAdminNavigation();
  setupSidebarToggle();
  setupCourseForm();
  setupCategoryForm();
  setupLessonForm();
  setupPricingToggle();
  setupImageUpload();
  showSection('dashboard');
  initThemeToggleAdmin();
}

/* ── Navigation ── */
function setupAdminNavigation() {
  document.querySelectorAll('.admin-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      if (section) showSection(section);
    });
  });
}

function showSection(section) {
  currentSection = section;

  // Update active nav
  document.querySelectorAll('.admin-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === section);
  });

  // Update active section
  document.querySelectorAll('.admin-section').forEach(el => {
    el.classList.toggle('active', el.id === `section-${section}`);
  });

  // Update topbar title
  const titles = {
    dashboard: 'Dashboard',
    courses: 'Manage Courses',
    categories: 'Manage Categories',
    reviews: 'Manage Reviews',
    settings: 'Settings'
  };
  const topTitle = document.getElementById('adminTopbarTitle');
  if (topTitle) topTitle.textContent = titles[section] || 'Dashboard';

  // Refresh section data
  switch (section) {
    case 'dashboard': renderDashboard(); break;
    case 'courses': renderCoursesList(); break;
    case 'categories': renderCategories(); break;
    case 'reviews': renderAdminReviews(); break;
  }

  // Close sidebar on mobile
  closeSidebar();
}

/* ── Sidebar Toggle (Mobile) ── */
function setupSidebarToggle() {
  const hamburger = document.getElementById('adminHamburger');
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
}

/* ── Dashboard ── */
function renderDashboard() {
  const courses = getCourses();
  const reviews = getReviews();
  const categories = getCategories();

  const totalCourses = courses.length;
  const totalEnrollments = courses.reduce((sum, c) => sum + (c.enrollments || 0), 0);
  const avgRating = calculateOverallRating();
  const totalCategories = categories.length;

  document.getElementById('statCourses').textContent = totalCourses;
  document.getElementById('statEnrollments').textContent = totalEnrollments.toLocaleString();
  document.getElementById('statRating').textContent = avgRating || '—';
  document.getElementById('statCategories').textContent = totalCategories;

  // Recent courses table
  const recentTable = document.getElementById('recentCoursesBody');
  if (recentTable) {
    const recent = [...courses].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    recentTable.innerHTML = recent.map(c => `
      <tr>
        <td><img src="${c.thumbnail}" alt="" class="admin-table__thumb"></td>
        <td><strong>${c.title}</strong></td>
        <td>${c.category}</td>
        <td>${c.level}</td>
        <td>${c.pricing === 'free' ? '<span style="color:var(--color-success);font-weight:600;">Free</span>' : formatPrice(c.discountPrice)}</td>
        <td>${c.enrollments}</td>
      </tr>
    `).join('');
  }
}

/* ── Course Management ── */
function renderCoursesList() {
  const tbody = document.getElementById('coursesTableBody');
  if (!tbody) return;

  const courses = determineBestSellers(getCourses());

  tbody.innerHTML = courses.map(c => {
    const rating = calculateAverageRating(c.id);
    return `
      <tr>
        <td><img src="${c.thumbnail}" alt="" class="admin-table__thumb"></td>
        <td>
          <strong>${c.title}</strong>
          ${c.isBestSeller ? '<span style="color:var(--color-warning);font-size:11px;margin-left:4px;">⭐ Best Seller</span>' : ''}
        </td>
        <td>${c.category}</td>
        <td>${c.level}</td>
        <td>${c.pricing === 'free' ? '<span style="color:var(--color-success);font-weight:600;">Free</span>' : formatPrice(c.discountPrice)}</td>
        <td>${c.enrollments}</td>
        <td>${rating.average} (${rating.count})</td>
        <td>
          <div class="admin-table__actions">
            <button class="btn btn--outline btn--sm" onclick="editCourse(${c.id})" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn--danger btn--sm" onclick="confirmDeleteCourse(${c.id})" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function setupCourseForm() {
  const form = document.getElementById('courseForm');
  if (!form) return;

  // Populate category dropdown
  populateCategoryDropdown();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveCourseForm();
  });
}

function populateCategoryDropdown() {
  const select = document.getElementById('courseCategory');
  if (!select) return;

  const categories = getCategories();
  select.innerHTML = '<option value="">Select Category</option>' +
    categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

function showCourseForm(editId = null) {
  const formPanel = document.getElementById('courseFormPanel');
  const listPanel = document.getElementById('courseListPanel');
  const formTitle = document.getElementById('courseFormTitle');

  if (formPanel) formPanel.style.display = 'block';
  if (listPanel) listPanel.style.display = 'none';

  populateCategoryDropdown();

  if (editId) {
    currentEditCourseId = editId;
    formTitle.textContent = 'Edit Course';
    const course = getCourse(editId);
    if (course) {
      document.getElementById('courseTitle').value = course.title;
      document.getElementById('courseAbout').value = course.about || '';
      document.getElementById('courseSyllabus').value = course.syllabus || '';
      document.getElementById('courseDescription').value = course.description;
      document.getElementById('courseCategory').value = course.category;
      document.getElementById('courseDuration').value = course.duration;
      document.getElementById('courseThumbnailUrl').value = course.thumbnail || '';
      document.getElementById('courseDemoVideoUrl').value = course.demoVideoUrl || '';

      // Level
      const levelRadio = document.querySelector(`input[name="courseLevel"][value="${course.level}"]`);
      if (levelRadio) levelRadio.checked = true;

      // Pricing
      const isPaid = course.pricing === 'paid';
      document.getElementById('pricingToggle').checked = isPaid;
      document.getElementById('priceFields').classList.toggle('visible', isPaid);
      if (isPaid) {
        document.getElementById('originalPrice').value = course.originalPrice;
        document.getElementById('discountPrice').value = course.discountPrice;
      }

      // Lessons
      renderLessonsEditor(course.lessons || []);

      // Thumbnail preview
      const preview = document.getElementById('thumbnailPreview');
      if (preview && course.thumbnail) {
        preview.innerHTML = `<img src="${course.thumbnail}" alt="Preview">`;
        preview.style.display = 'block';
      }
    }
  } else {
    currentEditCourseId = null;
    formTitle.textContent = 'Add New Course';
    document.getElementById('courseForm').reset();
    document.getElementById('priceFields').classList.remove('visible');
    document.getElementById('thumbnailPreview').style.display = 'none';
    renderLessonsEditor([]);
  }
}

function hideCourseForm() {
  const formPanel = document.getElementById('courseFormPanel');
  const listPanel = document.getElementById('courseListPanel');

  if (formPanel) formPanel.style.display = 'none';
  if (listPanel) listPanel.style.display = 'block';

  currentEditCourseId = null;
  document.getElementById('courseForm').reset();
}

function saveCourseForm() {
  const title = document.getElementById('courseTitle').value.trim();
  const about = document.getElementById('courseAbout').value.trim();
  const syllabus = document.getElementById('courseSyllabus').value.trim();
  const description = document.getElementById('courseDescription').value.trim();
  const category = document.getElementById('courseCategory').value;
  const duration = document.getElementById('courseDuration').value.trim();
  const level = document.querySelector('input[name="courseLevel"]:checked')?.value;
  const isPaid = document.getElementById('pricingToggle').checked;
  const thumbnail = document.getElementById('courseThumbnailUrl').value.trim() || 'assets/images/course_portrait.png';
  const demoVideoUrl = document.getElementById('courseDemoVideoUrl').value.trim();

  // Validation
  if (!title || !description || !category || !level) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  const courseData = {
    title,
    about,
    syllabus,
    description,
    category,
    duration: duration || '1 Month',
    level,
    thumbnail,
    demoVideoUrl,
    pricing: isPaid ? 'paid' : 'free',
    originalPrice: isPaid ? parseInt(document.getElementById('originalPrice').value) || 0 : 0,
    discountPrice: isPaid ? parseInt(document.getElementById('discountPrice').value) || 0 : 0,
    lessons: getCurrentLessons()
  };

  if (currentEditCourseId) {
    updateCourse(currentEditCourseId, courseData);
    showToast('Course updated successfully!', 'success');
  } else {
    addCourse(courseData);
    showToast('Course added successfully!', 'success');
  }

  hideCourseForm();
  renderCoursesList();
  renderDashboard();
}

function editCourse(id) {
  showCourseForm(id);
}

function confirmDeleteCourse(id) {
  const course = getCourse(id);
  if (!course) return;

  const modal = document.getElementById('deleteModal');
  const msg = document.getElementById('deleteModalMessage');
  if (msg) msg.textContent = `Are you sure you want to delete "${course.title}"? This action cannot be undone.`;

  document.getElementById('confirmDeleteBtn').onclick = () => {
    deleteCourse(id);
    showToast('Course deleted', 'success');
    renderCoursesList();
    renderDashboard();
    closeModal('deleteModal');
  };

  openModal('deleteModal');
}

/* ── Pricing Toggle ── */
function setupPricingToggle() {
  const toggle = document.getElementById('pricingToggle');
  if (!toggle) return;

  toggle.addEventListener('change', () => {
    document.getElementById('priceFields').classList.toggle('visible', toggle.checked);
  });
}

/* ── Image Upload ── */
function setupImageUpload() {
  const uploadArea = document.getElementById('thumbnailUpload');
  const fileInput = document.getElementById('thumbnailFile');
  const urlInput = document.getElementById('courseThumbnailUrl');
  const preview = document.getElementById('thumbnailPreview');

  if (!uploadArea) return;

  uploadArea.addEventListener('click', () => fileInput?.click());

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--primary-blue)';
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = '';
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '';
    const file = e.dataTransfer?.files[0];
    if (file) handleImageFile(file);
  });

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleImageFile(fileInput.files[0]);
    });
  }
}

function handleImageFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('thumbnailPreview');
    const urlInput = document.getElementById('courseThumbnailUrl');
    if (preview) {
      preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
      preview.style.display = 'block';
    }
    if (urlInput) urlInput.value = e.target.result;
  };
  reader.readAsDataURL(file);
}

/* ── Lessons ── */
let tempLessons = [];

function setupLessonForm() {
  const addBtn = document.getElementById('addLessonBtn');
  if (addBtn) {
    addBtn.addEventListener('click', addNewLesson);
  }
}

function renderLessonsEditor(lessons) {
  tempLessons = [...lessons];
  const container = document.getElementById('lessonsContainer');
  if (!container) return;

  container.innerHTML = tempLessons.map((lesson, i) => `
    <div class="lesson-item">
      <span class="lesson-item__number">${i + 1}</span>
      <input type="text" class="form-input" value="${lesson.title}" 
        onchange="updateLessonTitle(${i}, this.value)" placeholder="Lesson title" 
        style="flex:1;padding:6px 10px;">
      <input type="text" class="form-input" value="${lesson.videoUrl || ''}" 
        onchange="updateLessonVideo(${i}, this.value)" placeholder="Video URL" 
        style="flex:1;padding:6px 10px;">
      <div class="lesson-item__actions">
        <button type="button" class="btn btn--danger btn--sm" onclick="removeLesson(${i})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

function addNewLesson() {
  const newId = tempLessons.length > 0 ? Math.max(...tempLessons.map(l => l.id || 0)) + 1 : 1;
  tempLessons.push({ id: newId, title: '', videoUrl: '' });
  renderLessonsEditor(tempLessons);
}

function updateLessonTitle(index, value) {
  if (tempLessons[index]) tempLessons[index].title = value;
}

function updateLessonVideo(index, value) {
  if (tempLessons[index]) tempLessons[index].videoUrl = value;
}

function removeLesson(index) {
  tempLessons.splice(index, 1);
  renderLessonsEditor(tempLessons);
}

function getCurrentLessons() {
  return tempLessons.filter(l => l.title.trim() !== '');
}

/* ── Categories ── */
function setupCategoryForm() {
  const form = document.getElementById('categoryForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('newCategoryInput');
    const name = input.value.trim();
    if (!name) return;

    if (addCategory(name)) {
      showToast(`Category "${name}" added!`, 'success');
      input.value = '';
      renderCategories();
      populateCategoryDropdown();
    } else {
      showToast('Category already exists', 'error');
    }
  });
}

function renderCategories() {
  const container = document.getElementById('categoryTagsList');
  if (!container) return;

  const categories = getCategories();
  container.innerHTML = categories.map(cat => `
    <span class="category-tag">
      ${cat}
      <button type="button" class="category-tag__remove" onclick="removeCategory('${cat}')" title="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </span>
  `).join('');
}

function removeCategory(name) {
  deleteCategory(name);
  showToast(`Category "${name}" removed`, 'info');
  renderCategories();
  populateCategoryDropdown();
}

/* ── Reviews Management ── */
function renderAdminReviews() {
  const tbody = document.getElementById('reviewsTableBody');
  if (!tbody) return;

  const reviews = getReviews();
  const courses = getCourses();

  tbody.innerHTML = reviews.map(r => {
    const course = courses.find(c => c.id === r.courseId);
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--gradient-button);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700;flex-shrink:0;">${getInitials(r.studentName)}</div>
            <strong>${r.studentName}</strong>
          </div>
        </td>
        <td>${course ? course.title : '—'}</td>
        <td>${generateStarHTML(r.rating, 14)}</td>
        <td style="max-width:300px;"><span style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${r.text}</span></td>
        <td>${r.date}</td>
        <td>
          <button class="btn btn--danger btn--sm" onclick="confirmDeleteReview(${r.id})" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function confirmDeleteReview(id) {
  const modal = document.getElementById('deleteModal');
  const msg = document.getElementById('deleteModalMessage');
  if (msg) msg.textContent = 'Are you sure you want to delete this review?';

  document.getElementById('confirmDeleteBtn').onclick = () => {
    deleteReview(id);
    showToast('Review deleted', 'success');
    renderAdminReviews();
    closeModal('deleteModal');
  };

  openModal('deleteModal');
}

/* ── Modal Helpers ── */
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

/* ── Theme Toggle for Admin ── */
function initThemeToggleAdmin() {
  const theme = getTheme();
  document.documentElement.setAttribute('data-theme', theme);

  const toggleBtn = document.getElementById('adminThemeToggle');
  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });
}

/* ── Data Export/Import ── */
function exportData() {
  const data = {
    courses: getCourses(),
    categories: getCategories(),
    reviews: getReviews(),
    exportDate: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sarojit-pal-art-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported successfully!', 'success');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.courses) saveCourses(data.courses);
        if (data.categories) saveCategories(data.categories);
        if (data.reviews) saveReviews(data.reviews);
        showToast('Data imported successfully!', 'success');
        showSection(currentSection);
      } catch (err) {
        showToast('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
