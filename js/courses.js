/* ===================================================
   COURSES — Rendering, Filtering, Sorting, Search
   =================================================== */

let currentFilters = {
  category: '',
  price: '',
  level: '',
  sort: 'popularity',
  search: ''
};

function initCourses() {
  renderCourses();
  setupFilterListeners();
  setupSearchListener();
  setupStickyFilters();
  initWishlist();
  initLazyLoading();
}

/**
 * Get filtered & sorted courses
 */
function getFilteredCourses() {
  let courses = getCourses();

  // Apply best seller logic
  courses = determineBestSellers(courses);

  // Attach rating data
  courses = courses.map(c => {
    const ratingData = calculateAverageRating(c.id);
    return { ...c, avgRating: ratingData.average, reviewCount: ratingData.count };
  });

  // Filter by search
  if (currentFilters.search) {
    const q = currentFilters.search.toLowerCase();
    courses = courses.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  }

  // Filter by category
  if (currentFilters.category) {
    courses = courses.filter(c => c.category === currentFilters.category);
  }

  // Filter by price
  if (currentFilters.price === 'free') {
    courses = courses.filter(c => c.pricing === 'free');
  } else if (currentFilters.price === 'paid') {
    courses = courses.filter(c => c.pricing === 'paid');
  }

  // Filter by level
  if (currentFilters.level) {
    courses = courses.filter(c => c.level === currentFilters.level);
  }

  // Sort
  switch (currentFilters.sort) {
    case 'popularity':
      courses.sort((a, b) => b.enrollments - a.enrollments);
      break;
    case 'newest':
      courses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      break;
    case 'price-low':
      courses.sort((a, b) => {
        const priceA = a.pricing === 'free' ? 0 : a.discountPrice;
        const priceB = b.pricing === 'free' ? 0 : b.discountPrice;
        return priceA - priceB;
      });
      break;
    case 'price-high':
      courses.sort((a, b) => {
        const priceA = a.pricing === 'free' ? 0 : a.discountPrice;
        const priceB = b.pricing === 'free' ? 0 : b.discountPrice;
        return priceB - priceA;
      });
      break;
  }

  return courses;
}

/**
 * Render course cards to the grid
 */
function renderCourses() {
  const grid = document.getElementById('coursesGrid');
  const countEl = document.getElementById('coursesCount');
  if (!grid) return;

  const courses = getFilteredCourses();

  // Update count
  if (countEl) {
    countEl.innerHTML = `Showing <span>${courses.length}</span> course${courses.length !== 1 ? 's' : ''}`;
  }

  if (courses.length === 0) {
    grid.innerHTML = `
      <div class="courses-empty">
        <div class="courses-empty__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <h3 class="courses-empty__title">No courses found</h3>
        <p class="courses-empty__text">Try adjusting your filters or search query</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = courses.map((course, index) => {
    const wishlist = getWishlist();
    const isWishlisted = wishlist.includes(course.id);
    const rating = course.avgRating || 4.5;
    const reviewCount = course.reviewCount || 0;

    // Badge
    let badgeHTML = '';
    if (course.isBestSeller) {
      badgeHTML = '<span class="course-card__badge course-card__badge--bestseller">Best Seller</span>';
    }

    // Price
    let priceHTML = '';
    if (course.pricing === 'free') {
      priceHTML = `
        <div class="course-card__price">
          <span class="course-card__price-current free">Free</span>
          ${course.originalPrice > 0 ? `<span class="course-card__price-original">${formatPrice(course.originalPrice)}</span>` : ''}
        </div>
      `;
    } else {
      priceHTML = `
        <div class="course-card__price">
          <span class="course-card__price-current">${formatPrice(course.discountPrice)}</span>
          ${course.originalPrice > course.discountPrice ? `<span class="course-card__price-original">${formatPrice(course.originalPrice)}</span>` : ''}
        </div>
      `;
    }

    // Enroll Button Logic
    let enrollBtnHTML = '';
    if (typeof isStudentAuthenticated === 'function' && isStudentAuthenticated()) {
      if (typeof isEnrolled === 'function' && isEnrolled(course.id)) {
        enrollBtnHTML = `<button class="course-card__enroll" style="background:var(--bg-card);color:var(--primary-blue);border:1px solid var(--primary-blue);" onclick="window.location.href='student-dashboard.html'">Go to Course</button>`;
      } else {
        enrollBtnHTML = `<button class="course-card__enroll" onclick="handleEnroll('${course.id}')">Enroll Now</button>`;
      }
    } else {
      enrollBtnHTML = `<a href="student-login.html" class="course-card__enroll" style="text-decoration:none;text-align:center;">Enroll Now</a>`;
    }

    return `
      <article class="course-card" style="animation-delay: ${Math.min(index * 0.06, 0.5)}s" id="course-${course.id}" onclick="openCourseModal('${course.id}', event)">
        <div class="course-card__image-wrapper">
          <div class="skeleton-img"></div>
          <img data-src="${course.thumbnail}" alt="${course.title}" class="course-card__image" loading="lazy">
          ${badgeHTML}
          <button class="course-card__wishlist ${isWishlisted ? 'active' : ''}" data-course-id="${course.id}" aria-label="Add to wishlist">
            <svg viewBox="0 0 24 24" fill="${isWishlisted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>
        <div class="course-card__body">
          <span class="course-card__category" data-category="${course.category}">${course.category.toUpperCase()}</span>
          <h3 class="course-card__title">${course.title}</h3>
          <p class="course-card__desc">${course.description}</p>
          <div class="course-card__rating">
            <span class="course-card__rating-value">${rating}</span>
            <div class="course-card__stars">${generateStarHTML(rating)}</div>
            <span class="course-card__reviews">(${reviewCount.toLocaleString()})</span>
          </div>
          <div class="course-card__meta">
            <span class="course-card__duration">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${course.duration}
            </span>
            <span class="course-card__level-badge">${course.level}</span>
          </div>
          <div class="course-card__footer">
            ${priceHTML}
            ${enrollBtnHTML}
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Refresh lazy loading for newly added images
  refreshLazyLoading();
  updateWishlistButtons();
}

/**
 * Setup filter dropdown listeners
 */
function setupFilterListeners() {
  const categoryFilter = document.getElementById('filterCategory');
  const priceFilter = document.getElementById('filterPrice');
  const levelFilter = document.getElementById('filterLevel');
  const sortFilter = document.getElementById('filterSort');

  // Populate category options dynamically
  if (categoryFilter) {
    const categories = getCategories();
    categoryFilter.innerHTML = '<option value="">All Categories</option>' +
      categories.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      currentFilters.category = e.target.value;
      renderCourses();
    });
  }

  if (priceFilter) {
    priceFilter.addEventListener('change', (e) => {
      currentFilters.price = e.target.value;
      renderCourses();
    });
  }

  if (levelFilter) {
    levelFilter.addEventListener('change', (e) => {
      currentFilters.level = e.target.value;
      renderCourses();
    });
  }

  if (sortFilter) {
    sortFilter.addEventListener('change', (e) => {
      currentFilters.sort = e.target.value;
      renderCourses();
    });
  }
}

/**
 * Setup search bar listener
 */
function setupSearchListener() {
  const searchInput = document.getElementById('heroSearch');
  if (!searchInput) return;

  const debouncedSearch = debounce((value) => {
    currentFilters.search = value;
    renderCourses();
  }, 300);

  searchInput.addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
  });

  // Also search on form submit
  const searchForm = document.getElementById('heroSearchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      currentFilters.search = searchInput.value;
      renderCourses();
      // Scroll to courses
      document.getElementById('coursesSection')?.scrollIntoView({ behavior: 'smooth' });
    });
  }
}

/**
 * Make filter bar sticky with shadow on scroll
 */
function setupStickyFilters() {
  const filters = document.querySelector('.filters');
  if (!filters) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      filters.classList.toggle('scrolled', !entry.isIntersecting);
    },
    { rootMargin: '-1px 0px 0px 0px', threshold: [1] }
  );

  // Observe a sentinel element just above the filters
  const sentinel = document.createElement('div');
  sentinel.style.height = '1px';
  filters.parentNode.insertBefore(sentinel, filters);
  observer.observe(sentinel);
}

// Theme toggle
function initThemeToggle() {
  const theme = getTheme();
  document.documentElement.setAttribute('data-theme', theme);

  const toggleBtn = document.getElementById('themeToggle');
  if (!toggleBtn) return;

  updateThemeIcon(theme);

  toggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    updateThemeIcon(next);
  });
}

function updateThemeIcon(theme) {
  const toggleBtn = document.getElementById('themeToggle');
  if (!toggleBtn) return;

  if (theme === 'dark') {
    toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  } else {
    toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initCourses();
  initThemeToggle();
});

// Global enroll handler
window.handleEnroll = function(courseId) {
  if (typeof isStudentAuthenticated === 'function' && !isStudentAuthenticated()) {
    window.location.href = 'student-login.html';
    return;
  }

  if (typeof enrollInCourse === 'function') {
    const result = enrollInCourse(courseId);
    if (result.success) {
      if (typeof showToast === 'function') {
        showToast(result.message, 'success');
      } else {
        alert(result.message);
      }
      // Re-render to update button state
      renderCourses();
    } else {
      if (typeof showToast === 'function') {
        showToast(result.message, 'error');
      } else {
        alert(result.message);
      }
    }
  }
};

window.openCourseModal = async function(courseId, event) {
  if (event.target.closest('.course-card__enroll') || event.target.closest('.course-card__wishlist')) {
    return;
  }

  const course = getCourses().find(c => String(c.id) === String(courseId));
  if (!course) return;

  const modal = document.getElementById('courseDetailsModal');
  if (!modal) return;

  const content = modal.querySelector('.modal-content');

  // Fetch lesson previews (public — titles & thumbnails only, no videoUrl)
  let lessonPreviewHTML = '';
  try {
    if (typeof apiFetch === 'function') {
      const previewLessons = await apiFetch('/courses/' + courseId + '/lessons-preview', { auth: false });
      if (previewLessons && previewLessons.length > 0) {
        lessonPreviewHTML = '<h4 style="font-size:1.1rem; margin-bottom:var(--space-3); color:var(--text-primary); margin-top:var(--space-4);">Course Lessons</h4>' +
          '<div style="display:flex; flex-direction:column; gap:var(--space-2);">' +
          previewLessons.map(function(l, i) {
            return '<div style="display:flex; align-items:center; gap:var(--space-3); padding:var(--space-2) var(--space-3); background:var(--bg-primary); border-radius:var(--radius-md); border:1px solid var(--border-light);">' +
              '<div style="width:36px;height:36px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;color:var(--text-secondary);flex-shrink:0;">' + (i + 1) + '</div>' +
              '<div style="flex:1;font-size:0.9rem;font-weight:600;">' + escapeHtml(l.title) + '</div>' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="color:var(--text-tertiary);flex-shrink:0;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
            '</div>';
          }).join('') +
          '</div>';
      }
    }
  } catch (e) {
    // Non-critical — preview just won't show
  }

  // Only use demoVideoUrl for preview — NEVER fall back to lesson.videoUrl
  let videoHTML = '';
  if (course.demoVideoUrl) {
    let embedUrl = course.demoVideoUrl;
    if (embedUrl.includes('youtube.com/watch?v=')) {
      const videoId = new URL(embedUrl).searchParams.get('v');
      embedUrl = 'https://www.youtube.com/embed/' + videoId + '?autoplay=0&rel=0&modestbranding=1&showinfo=0';
    } else if (embedUrl.includes('youtu.be/')) {
      const videoId = embedUrl.split('youtu.be/')[1].split('?')[0];
      embedUrl = 'https://www.youtube.com/embed/' + videoId + '?autoplay=0&rel=0&modestbranding=1&showinfo=0';
    }
    videoHTML =
      '<div style="margin-top:var(--space-4); margin-bottom:var(--space-4);">' +
        '<h4 style="font-size:1.1rem; margin-bottom:var(--space-2);">Demo Video</h4>' +
        '<div style="aspect-ratio:16/9; background:#000; border-radius:var(--radius-lg); overflow:hidden; position:relative;">' +
          '<iframe width="100%" height="100%" src="' + embedUrl + '" title="Demo Video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>' +
          '<div style="position:absolute; top:0; left:0; width:100%; height:70px; z-index:10; background:transparent;" title="Video Title"></div>' +
          '<div style="position:absolute; bottom:40px; right:0; width:200px; height:70px; z-index:10; background:transparent;" title="Watch on YouTube"></div>' +
        '</div>' +
      '</div>';
  }

  content.innerHTML =
    '<button onclick="closeCourseModal()" style="position:absolute; top:16px; right:16px; background:rgba(0,0,0,0.5); border:none; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; color:white; z-index:10;">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
    '</button>' +
    '<div style="height:220px; overflow:hidden; position:relative; flex-shrink:0;">' +
      '<img src="' + (course.thumbnail || '') + '" style="width:100%; height:100%; object-fit:cover;" alt="' + escapeHtml(course.title) + '">' +
      '<div style="position:absolute; inset:0; background:linear-gradient(to top, var(--bg-card), transparent);"></div>' +
    '</div>' +
    '<div style="padding:var(--space-6); margin-top:-60px; position:relative; z-index:2;">' +
      '<span style="font-size:0.75rem; font-weight:bold; text-transform:uppercase; color:var(--primary-blue); background:rgba(37,99,235,0.1); padding:4px 8px; border-radius:4px;">' + escapeHtml(course.category) + '</span>' +
      '<h2 style="font-size:1.8rem; font-weight:800; margin-top:0.5rem; margin-bottom:0.5rem; color:var(--text-primary); line-height:1.2;">' + escapeHtml(course.title) + '</h2>' +
      '<p style="color:var(--text-secondary); line-height:1.6; margin-bottom:var(--space-4);">' + escapeHtml(course.about || course.description) + '</p>' +
      '<div style="display:flex; gap:1.2rem; margin-bottom:var(--space-5); font-size:0.9rem; color:var(--text-secondary); flex-wrap:wrap;">' +
        '<span style="display:flex; align-items:center; gap:0.25rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ' + (course.duration || 'Flexible') + '</span>' +
        '<span style="display:flex; align-items:center; gap:0.25rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> ' + (course.avgRating || 4.5) + '</span>' +
        '<span style="display:flex; align-items:center; gap:0.25rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> ' + (course.enrollments || 0) + ' Students</span>' +
      '</div>' +
      '<div style="border-top:1px solid var(--border-light); padding-top:var(--space-4); margin-bottom:var(--space-4);">' +
        '<h4 style="font-size:1.1rem; margin-bottom:var(--space-3); color:var(--text-primary);">What you will learn</h4>' +
        '<ul style="list-style:none; padding:0; color:var(--text-secondary); font-size:0.95rem;">' +
          (course.syllabus ? course.syllabus.split('\n').map(function(item) {
            return '<li style="margin-bottom:0.5rem; display:flex; gap:0.5rem;">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary-blue)" stroke-width="2" width="16" height="16" style="flex-shrink:0; margin-top:2px;"><polyline points="20 6 9 17 4 12"/></svg>' +
              '<span>' + escapeHtml(item) + '</span>' +
            '</li>';
          }).join('') : '<li>No syllabus available</li>') +
        '</ul>' +
      '</div>' +
      lessonPreviewHTML +
      videoHTML +
      '<div style="margin-top:var(--space-6); display:flex; gap:1rem; align-items:center; padding-top:var(--space-4); border-top:1px solid var(--border-light);">' +
        '<div style="font-size:1.5rem; font-weight:800; color:var(--text-primary);">' +
          (course.pricing === 'free' ? '<span style="color:var(--color-free);">Free</span>' : formatPrice(course.discountPrice)) +
        '</div>' +
        '<button class="btn btn--primary" style="flex:1; padding:12px; font-size:1rem;" onclick="handleEnroll(\'' + course.id + '\'); closeCourseModal();">Enroll Now</button>' +
      '</div>' +
    '</div>';

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.closeCourseModal = function() {
  const modal = document.getElementById('courseDetailsModal');
  if (modal) {
    modal.style.display = 'none';
    modal.querySelector('.modal-content').innerHTML = ''; // Stop video
  }
  document.body.style.overflow = '';
};

