// Half-page flipbook: right side flips; left side shows the latest turned back face

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
 * has *some* content (or a clean white background if missing).
 *
 * In your structure:
 *   - .leaf .front  = right page (odd page number)
 *   - .leaf .back   = left page (even page number) revealed after turning
 *
 * If the last .back is empty (no <img> or content), we inject a blank.
 */
function ensureEvenPages() {
  if (leaves.length === 0) return;

  const lastLeaf = leaves[leaves.length - 1];
  const back = lastLeaf.querySelector('.back');
  if (!back) return;

  // Detect if there's meaningful content in the back face
  const hasImage = back.querySelector('img, picture, video, canvas, svg');
  const hasNonWhitespace = back.textContent && back.textContent.trim().length > 0;

  if (!hasImage && !hasNonWhitespace) {
    // Make this face a clean blank page
    back.innerHTML = '';                 // ensure no stray nodes
    back.style.background = '#fff';      // white background
    back.style.borderLeft = '1px solid var(--page-border)';
    // Optional small watermark for debugging; comment out when done:
    // const note = document.createElement('div');
    // note.style.position = 'absolute';
    // note.style.bottom = '8px';
    // note.style.left = '12px';
    // note.style.fontSize = '12px';
    // note.style.opacity = '.35';
    // note.textContent = '(blank)';
    // back.appendChild(note);
  }
}

/**
 * Stacking rules:
 * - Unturned leaves (i >= index): high z-index so the current right page is on top.
 *   The next-to-turn leaf (i === index) must be the highest of all.
 * - Turned leaves (i < index): lower z-index tiers; the most recently turned (i === index-1)
 *   should be highest among turned so it covers older left pages.
 */
function setStacking() {
  const N = leaves.length;
  leaves.forEach((leaf, i) => {
    if (i < index) {
      // Already turned (left stack). Newest turned on top.
      leaf.style.zIndex = String(i + 1); // 1..index
    } else {
      // Not yet turned (right stack). Next-to-turn highest overall.
      leaf.style.zIndex = String(100 + (N - i)); // 100+N .. 101
    }
    // Flip pivot at the spine (left edge of the right half)
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
ensureEvenPages();      // add a blank if needed
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
    if (entry.isIntersecting) {
      prevBtn.style.display = "block";
      nextBtn.style.display = "block";
    } else {
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";
    }
  });
}, { threshold: 0.2 }); // at least 20% of book visible

if (book) {
  flipbookObserver.observe(book);
}
