/* ===================================================
   WISHLIST — Heart Toggle
   =================================================== */

function initWishlist() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.course-card__wishlist');
    if (!btn) return;

    const courseId = parseInt(btn.dataset.courseId);
    const isWishlisted = toggleWishlistItem(courseId);

    btn.classList.toggle('active', isWishlisted);
    showToast(
      isWishlisted ? 'Added to wishlist ❤️' : 'Removed from wishlist',
      isWishlisted ? 'success' : 'info'
    );
  });
}

function updateWishlistButtons() {
  const wishlist = getWishlist();
  document.querySelectorAll('.course-card__wishlist').forEach(btn => {
    const courseId = parseInt(btn.dataset.courseId);
    btn.classList.toggle('active', wishlist.includes(courseId));
  });
}
