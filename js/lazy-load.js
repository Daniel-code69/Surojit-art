/* ===================================================
   LAZY LOADING — Intersection Observer
   =================================================== */

function initLazyLoading() {
  const lazyImages = document.querySelectorAll('img[data-src]');

  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          loadImage(img);
          observer.unobserve(img);
        }
      });
    }, {
      rootMargin: '100px 0px',
      threshold: 0.01
    });

    lazyImages.forEach(img => imageObserver.observe(img));
  } else {
    // Fallback for older browsers
    lazyImages.forEach(img => loadImage(img));
  }
}

function loadImage(img) {
  const src = img.getAttribute('data-src');
  if (!src) return;

  img.src = src;
  img.removeAttribute('data-src');

  img.onload = () => {
    img.classList.add('loaded');
    // Remove skeleton placeholder
    const skeleton = img.parentElement.querySelector('.skeleton-img');
    if (skeleton) {
      skeleton.style.opacity = '0';
      setTimeout(() => skeleton.remove(), 300);
    }
  };

  img.onerror = () => {
    // Fallback gradient on error
    img.style.display = 'none';
    const wrapper = img.parentElement;
    if (wrapper) {
      wrapper.style.background = 'linear-gradient(135deg, #E2E8F0, #CBD5E1)';
    }
  };
}

// Re-initialize after dynamic content loads
function refreshLazyLoading() {
  setTimeout(initLazyLoading, 100);
}
