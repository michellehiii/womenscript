// ==========================
// Breadcrumb: back-with-fallback
// ==========================
(function () {
  const backLink = document.querySelector('[data-back]');
  if (!backLink) return;

  // Fallback destination when there's no usable history entry
  const FALLBACK_URL = backLink.getAttribute('href') || 'about.html';

  function sameOrigin(u) {
    try { return new URL(u, location.href).origin === location.origin; }
    catch { return false; }
  }

  function goBackWithFallback(e) {
    e.preventDefault();

    // Navigation entry (for redirect detection)
    const nav = performance.getEntriesByType('navigation')[0];
    const cameFromRedirect = !!(nav && nav.redirectCount > 0);

    const hasHistory = history.length > 1;
    const hasReferrer = !!document.referrer && sameOrigin(document.referrer);

    if (!cameFromRedirect && hasHistory && hasReferrer) {
      history.back();
    } else {
      location.href = FALLBACK_URL;
    }
  }

  backLink.addEventListener('click', goBackWithFallback);
})();

// ==========================
// Half-page Flipbook Logic
// ==========================

// Controls
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

// Book + leaves
const book   = document.getElementById('book');
const leaves = Array.from(document.querySelectorAll('#book .leaf'));

let index = 0;                 // number of leaves turned (0..leaves.length)
const max = leaves.length;

function updateButtons() {
  if (!prevBtn || !nextBtn) return;
  prevBtn.disabled = index === 0;
  nextBtn.disabled = index === max;
}

function updateBookStateClasses() {
  if (!book) return;
  book.classList.remove('at-start', 'at-middle', 'at-end');
  if (index === 0) book.classList.add('at-start');
  else if (index === max) book.classList.add('at-end');
  else book.classList.add('at-middle');
}

/**
 * If the book has an odd total number of pages, ensure the final spread
 * shows a white blank on the left by guaranteeing the LAST leaf's .back face
 * has some content (or a clean white background if missing).
 */
function ensureEvenPages() {
  if (leaves.length === 0) return;

  const lastLeaf = leaves[leaves.length - 1];
  const back = lastLeaf.querySelector('.back');
  if (!back) return;

  const hasMedia = back.querySelector('img, picture, video, canvas, svg');
  const hasText = back.textContent && back.textContent.trim().length > 0;

  if (!hasMedia && !hasText) {
    back.innerHTML = '';
    back.style.background = '#fff';
    back.style.borderLeft = '1px solid var(--page-border, #ddd)';
  }
}

/**
 * Stacking rules:
 * - Unturned leaves (i >= index): high z-index so the current right page is on top.
 * - Turned leaves (i < index): lower z-index; the most recently turned highest among them.
 */
function setStacking() {
  const N = leaves.length;
  leaves.forEach((leaf, i) => {
    if (i < index) {
      leaf.style.zIndex = String(i + 1); // 1..index
    } else {
      leaf.style.zIndex = String(100 + (N - i)); // 100+N .. 101
    }
    leaf.style.transformOrigin = 'left center';
  });
}

function goNext() {
  if (index >= max) return;
  leaves[index].classList.add('turned');  // rotateY(-180deg) via CSS
  index++;
  setStacking();
  updateButtons();
  updateBookStateClasses();
}

function goPrev() {
  if (index <= 0) return;
  index--;
  leaves[index].classList.remove('turned');
  setStacking();
  updateButtons();
  updateBookStateClasses();
}

// --- Init ---
ensureEvenPages();
setStacking();
updateButtons();
updateBookStateClasses();

// Controls
nextBtn?.addEventListener('click', goNext);
prevBtn?.addEventListener('click', goPrev);

// Keyboard
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') goNext();
  if (e.key === 'ArrowLeft')  goPrev();
});

// Click right half = next, left half = prev
book?.addEventListener('click', (e) => {
  const r = book.getBoundingClientRect();
  const mid = r.left + r.width / 2;
  if (e.clientX >= mid) goNext(); else goPrev();
});

// Helpful warning if markup is missing
if (!book || leaves.length === 0) {
  console.warn('Flipbook: #book or .leaf elements not found. Check your HTML structure.');
}

// Show/hide prev & next buttons only when book is in view
const flipbookObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!prevBtn || !nextBtn) return;
    if (entry.isIntersecting) {
      prevBtn.style.display = "block";
      nextBtn.style.display = "block";
    } else {
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";
    }
  });
}, { threshold: 0.2 });

if (book) {
  flipbookObserver.observe(book);
}
