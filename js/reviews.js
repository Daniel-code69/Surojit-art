/* ===================================================
   REVIEWS — Slider / Carousel
   =================================================== */

function initReviews() {
  renderReviews();
  setupReviewNavigation();
}

function renderReviews() {
  const track = document.getElementById('reviewsTrack');
  if (!track) return;

  const reviews = getReviews();

  if (reviews.length === 0) {
    track.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-tertiary);">No reviews yet.</p>';
    return;
  }

  track.innerHTML = reviews.map(review => {
    const courses = getCourses();
    const course = courses.find(c => c.id === review.courseId);
    const courseName = course ? course.title : 'Art Course';

    return `
      <div class="review-card">
        <div class="review-card__header">
          <div class="review-card__avatar">${getInitials(review.studentName)}</div>
          <div class="review-card__info">
            <span class="review-card__name">${review.studentName}</span>
            <span class="review-card__role">Student — ${courseName}</span>
          </div>
        </div>
        <div class="review-card__stars">
          ${generateStarHTML(review.rating, 16)}
        </div>
        <p class="review-card__text">${review.text}</p>
      </div>
    `;
  }).join('');

  // Setup dots
  setupReviewDots(reviews.length);
}

function setupReviewNavigation() {
  const prevBtn = document.getElementById('reviewPrev');
  const nextBtn = document.getElementById('reviewNext');
  const track = document.getElementById('reviewsTrack');

  if (!track) return;

  const scrollAmount = 380;

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
  }

  // Auto-scroll
  let autoScrollInterval = setInterval(() => {
    if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 10) {
      track.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }, 5000);

  // Pause on hover
  track.addEventListener('mouseenter', () => clearInterval(autoScrollInterval));
  track.addEventListener('mouseleave', () => {
    autoScrollInterval = setInterval(() => {
      if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 10) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }, 5000);
  });

  // Touch swipe support
  let touchStartX = 0;
  track.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  track.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      }
    }
  }, { passive: true });

  // Update dots on scroll
  track.addEventListener('scroll', debounce(() => {
    updateReviewDots(track);
  }, 100));
}

function setupReviewDots(count) {
  const dotsContainer = document.getElementById('reviewDots');
  if (!dotsContainer) return;

  const visibleCards = Math.min(3, count);
  const dotCount = Math.ceil(count / visibleCards);

  dotsContainer.innerHTML = '';
  for (let i = 0; i < Math.min(dotCount, 5); i++) {
    const dot = document.createElement('button');
    dot.className = `reviews-slider__dot ${i === 0 ? 'active' : ''}`;
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.addEventListener('click', () => {
      const track = document.getElementById('reviewsTrack');
      if (track) {
        track.scrollTo({ left: i * 380, behavior: 'smooth' });
      }
    });
    dotsContainer.appendChild(dot);
  }
}

function updateReviewDots(track) {
  const dots = document.querySelectorAll('.reviews-slider__dot');
  if (dots.length === 0) return;

  const scrollPosition = track.scrollLeft;
  const cardWidth = 380;
  const activeIndex = Math.round(scrollPosition / cardWidth);

  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === Math.min(activeIndex, dots.length - 1));
  });
}

document.addEventListener('DOMContentLoaded', initReviews);
