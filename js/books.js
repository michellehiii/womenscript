(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    console.log('[books.js] loaded');

    // ===== Config =====
    const AUTO_FULLSCREEN = false;   // do NOT auto-enter fullscreen
    const COMPACT_BREAKPOINT = 420;  // px; compact labels below this
    const DEFAULT_ZOOM = 1;        // starting zoom (also used by Reset)
    const ZOOM_MIN = 0.5;
    const ZOOM_MAX = 4;
    const ZOOM_STEP = 0.1;

    // ===== Elements =====
    const $ = (sel, root = document) => root.querySelector(sel);
    const panel  = $('#flipPanel');
    const dialog = panel ? $('.panel__dialog', panel) : null;
    if (!panel || !dialog) { console.error('Flip panel HTML not found.'); return; }

    const closePanelBtn = $('#closePanel');
    const titleEl       = $('#panelTitle');
    const metaEl        = $('#panelMeta');
    const counterText   = $('#counterText');
    const pagesWrap     = $('.flipbook__pages', panel);
    const pageLeft      = $('#pageLeft');
    const pageRight     = $('#pageRight'); // kept for compatibility (hidden via CSS)

    const prevBtn       = $('#prevBtn');
    const nextBtn       = $('#nextBtn');
    const zoomInBtn     = $('#zoomIn');
    const zoomOutBtn    = $('#zoomOut');
    const zoomLabel     = $('#zoomLabel');
    const resetBtn      = $('#resetZoom');
    const maximizeBtn   = $('#maximizeBtn');
    const minimizeBtn   = $('#minimizeBtn');
    const gotoBtn       = $('#gotoBtn');   // NEW

    // ===== State =====
    let pages = [];
    let index = 0;
    let zoom  = DEFAULT_ZOOM;

    // Single-page everywhere
    const isSpread = () => false;

    // ===== Utils =====
    function applyZoom() {
      zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
      panel.style.setProperty('--zoom', String(zoom));
      if (zoomLabel) zoomLabel.textContent = Math.round(zoom * 100) + '%';
    }
    function resetZoom() {
      zoom = DEFAULT_ZOOM;
      applyZoom();
      if (pagesWrap) { pagesWrap.scrollTop = 0; pagesWrap.scrollLeft = 0; }
    }
    function zeroPad(num, width) {
      const s = String(num);
      return width ? s.padStart(width, '0') : s;
    }

    // Build page URLs from dataset
    function buildPagesFromDataset(el) {
      const pattern = el.dataset.pagesPattern;
      const zp = (n, w) => (w ? String(n).padStart(w, '0') : String(n));

      // A) RANGE-FOLDER MODE
      if (pattern && pattern.includes('{range}')) {
        const total       = parseInt(el.dataset.pagesCount || '0', 10);
        const perFolder   = parseInt(el.dataset.pagesPerFolder || '50', 10);
        const globalStart = parseInt(el.dataset.globalStart || '1', 10);
        const numPad      = parseInt(el.dataset.zeroPad || '0', 10);
        const rangePad    = parseInt(el.dataset.rangePad || '3', 10);
        const numbering   = (el.dataset.numbering || 'local').toLowerCase();  // local|global
        if (!total || !perFolder) return [];
        const urls = [];
        for (let i = 0; i < total; i++) {
          const folderIndex = Math.floor(i / perFolder);
          const low  = globalStart + folderIndex * perFolder;
          const high = Math.min(low + perFolder - 1, globalStart + total - 1);
          const rangeLabel = `${zp(low, rangePad)}-${zp(high, rangePad)}`;
          const globalNum   = globalStart + i;
          const inFolderNum = (i % perFolder) + 1;
          const fileNum     = numbering === 'global' ? globalNum : inFolderNum;
          const fileNumStr  = zp(fileNum, numPad);
          urls.push(pattern.replace('{range}', rangeLabel).replace('{num}', fileNumStr));
        }
        return urls;
      }

      // B) NUMERIC-FOLDER MODE
      if (pattern && pattern.includes('{folder}')) {
        const total       = parseInt(el.dataset.pagesCount || '0', 10);
        const perFolder   = parseInt(el.dataset.pagesPerFolder || '50', 10);
        const folderStart = parseInt(el.dataset.folderStart || '1', 10);
        const numPad      = parseInt(el.dataset.zeroPad || '0', 10);
        const folderPad   = parseInt(el.dataset.folderPad || '0', 10);
        if (!total || !perFolder) return [];
        const urls = [];
        for (let i = 0; i < total; i++) {
          const folder = folderStart + Math.floor(i / perFolder);
          const num    = (i % perFolder) + 1;
          urls.push(
            pattern.replace('{folder}', zp(folder, folderPad))
                   .replace('{num}',    zp(num, numPad))
          );
        }
        return urls;
      }

      // D) explicit list
      if (el.dataset.pages) {
        try {
          const arr = JSON.parse(el.dataset.pages);
          return Array.isArray(arr) ? arr : [];
        } catch (e) {
          console.error('Bad data-pages JSON:', e);
          return [];
        }
      }

      // C) prefix mode
      const prefix = el.dataset.pagesPrefix || '';
      const count  = parseInt(el.dataset.pagesCount || '0', 10);
      const start  = parseInt(el.dataset.start || '1', 10);
      const ext    = (el.dataset.pagesExt || 'jpg').replace(/^\./, '');
      const pad    = parseInt(el.dataset.zeroPad || '0', 10);
      if (!prefix || !count) return [];
      const urls = [];
      for (let i = 0; i < count; i++) {
        const n = start + i;
        urls.push(`${prefix}${zeroPad(n, pad)}.${ext}`);
      }
      return urls;
    }

    function lockScroll(lock) { document.documentElement.style.overflow = lock ? 'hidden' : ''; }
    function clampIndex(i) { const max = pages.length - 1; return Math.max(0, Math.min(max, i)); }
    const currentLeftIndex = () => index;

    // ===== Rendering =====
    function setNavDisabled(disablePrev, disableNext) {
      if (prevBtn) {
        prevBtn.disabled = !!disablePrev;
        prevBtn.setAttribute('aria-disabled', String(!!disablePrev));
      }
      if (nextBtn) {
        nextBtn.disabled = !!disableNext;
        nextBtn.setAttribute('aria-disabled', String(!!disableNext));
      }
      if (gotoBtn) {
        gotoBtn.disabled = !pages.length;
        gotoBtn.setAttribute('aria-disabled', String(!pages.length));
      }
    }

    function render() {
      if (!pages.length) {
        if (pageLeft) pageLeft.innerHTML = '<div style="padding:20px;color:#666">No pages found.</div>';
        if (pageRight) pageRight.style.display = 'none';
        if (metaEl) metaEl.textContent = 'Page — / —';
        if (counterText) counterText.textContent = 'Page — / —';
        setNavDisabled(true, true);
        return;
      }

      const leftIdx = currentLeftIndex();

      // Left page image
      if (pageLeft) {
        pageLeft.innerHTML = '';
        const li = new Image();
        li.alt = `Page ${leftIdx + 1}`;
        li.src = pages[leftIdx];
        li.draggable = false;

        // Ensure the IMAGE itself scales with zoom
        li.style.width = '100%';
        li.style.height = '100%';
        li.style.objectFit = 'contain';

        pageLeft.appendChild(li);
      }

      // Hide right page (single-page mode)
      if (pageRight) { pageRight.innerHTML = ''; pageRight.style.display = 'none'; }

      // Counters
      const total = pages.length;
      const label = `Page ${leftIdx + 1} / ${total}`;
      if (metaEl) metaEl.textContent = label;
      if (counterText) counterText.textContent = label;

      // Buttons
      const atStart = leftIdx === 0;
      const atEnd   = leftIdx >= total - 1;
      setNavDisabled(atStart, atEnd);
    }

    // ===== Open / Close =====
    function openPanel(title, pageUrls, openerEl) {
      if (titleEl) titleEl.textContent = title || 'Untitled';
      pages = pageUrls.slice();
      index = 0;

      // Optional per-book aspect overrides
      if (openerEl) {
        const pw = parseFloat(openerEl.dataset.pageW);
        const ph = parseFloat(openerEl.dataset.pageH);
        if (!Number.isNaN(pw) && !Number.isNaN(ph)) {
          panel.style.setProperty('--page-w', pw);
          panel.style.setProperty('--page-h', ph);
        } else {
          panel.style.removeProperty('--page-w');
          panel.style.removeProperty('--page-h');
        }
      }

      // Start nicely sized (slightly smaller on tiny phones)
      zoom = (window.innerWidth < 380) ? Math.min(DEFAULT_ZOOM, 1.25) : DEFAULT_ZOOM;
      applyZoom();
      render();

      panel.setAttribute('aria-hidden', 'false');
      panel.classList.add('is-open');
      panel.style.display = 'block';
      dialog.style.transform = 'translateX(0)';
      lockScroll(true);
      closePanelBtn?.focus();

      console.log('[books.js] panel opened with', pages.length, 'pages');
      updateFullscreenButtons();
    }

    function closePanel() {
      panel.setAttribute('aria-hidden', 'true');
      panel.classList.remove('is-open');
      panel.style.display = '';
      dialog.style.transform = '';
      lockScroll(false);
      if (pageLeft) pageLeft.innerHTML = '';
      if (pageRight) pageRight.innerHTML = '';
      pages = [];
      if (document.fullscreenElement) { document.exitFullscreen?.().catch(() => {}); }
      console.log('[books.js] panel closed');
    }

    // ===== Navigation =====
    function nextPage() { if (!pages.length || (nextBtn && nextBtn.disabled)) return; index = clampIndex(index + 1); render(); }
    function prevPage() { if (!pages.length || (prevBtn && prevBtn.disabled)) return; index = clampIndex(index - 1); render(); }

    // NEW: go to page (1-based)
    function goToPage(p) {
      if (!pages.length) return;
      const n = parseInt(p, 10);
      if (!Number.isFinite(n)) return;
      index = clampIndex(n - 1);
      render();
    }

    // ===== Responsive labels (compact) =====
    const fullText = {
      prev: '上一页', next: '下一页',
      zoomOut: '缩小 −', zoomIn: '放大 +',
      reset: '重置',
      maximize: '全屏', minimize: '退出',
      goto: '跳页'
    };
    const compactText = {
      prev: '上一页', next: '下一页',
      zoomOut: '−', zoomIn: '+',
      reset: '重置',
      maximize: '全屏', minimize: '退出',
      goto: '跳页'
    };
    let compactMode = false;

    function setButtonLabels(compact) {
      compactMode = !!compact;
      const t = compact ? compactText : fullText;
      if (prevBtn) prevBtn.textContent = t.prev;
      if (nextBtn) nextBtn.textContent = t.next;
      if (zoomOutBtn) zoomOutBtn.textContent = t.zoomOut;
      if (zoomInBtn) zoomInBtn.textContent = t.zoomIn;
      if (resetBtn) resetBtn.textContent = t.reset;
      if (maximizeBtn) maximizeBtn.textContent = t.maximize;
      if (minimizeBtn) minimizeBtn.textContent = t.minimize;
      if (gotoBtn) gotoBtn.textContent = t.goto;
    }
    function updateCompactControls() {
      const compact = window.innerWidth <= COMPACT_BREAKPOINT;
      panel.classList.toggle('is-compact', compact);
      setButtonLabels(compact);
    }

    // ===== Fullscreen helpers =====
    function updateFullscreenButtons() {
      const inFs = !!document.fullscreenElement;
      if (maximizeBtn) maximizeBtn.disabled = inFs;
      if (minimizeBtn) minimizeBtn.disabled = !inFs;
    }

    // ===== Wire up books =====
    const books = document.querySelectorAll('.book');
    if (!books.length) console.warn('No .book elements found.');
    books.forEach(book => {
      const title = book.getAttribute('data-title') || book.querySelector('.book__title')?.textContent || 'Untitled';
      const open  = () => {
        const pageUrls = buildPagesFromDataset(book);
        openPanel(title, pageUrls, book);
      };
      book.addEventListener('click', open);
      book.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });

    // ===== Controls =====
    closePanelBtn?.addEventListener('click', closePanel);
    panel.addEventListener('click', e => { if (!e.target.closest('.panel__dialog')) closePanel(); });

    // --- Zoom helpers so all buttons (Chinese or +/-) call the same thing ---
    function doZoomIn()  { zoom = Math.min(ZOOM_MAX, zoom + ZOOM_STEP); applyZoom(); }
    function doZoomOut() { zoom = Math.max(ZOOM_MIN, zoom - ZOOM_STEP); applyZoom(); }

    // Main zoom buttons
    zoomInBtn?.addEventListener('click',  (e) => { e.preventDefault(); doZoomIn();  });
    zoomOutBtn?.addEventListener('click', (e) => { e.preventDefault(); doZoomOut(); });

    // Aliases for mobile: if you add separate small-screen buttons, they’ll work too
    const zoomInAliases  = ['#zoomInSm', '#zoomPlus', '.zoom-plus',  '[data-zoom="in"]',  '[data-action="zoom-in"]'];
    const zoomOutAliases = ['#zoomOutSm','#zoomMinus','.zoom-minus','[data-zoom="out"]','[data-action="zoom-out"]'];
    zoomInAliases.forEach(sel => document.querySelectorAll(sel).forEach(el =>
      el.addEventListener('click', (e) => { e.preventDefault(); doZoomIn(); })
    ));
    zoomOutAliases.forEach(sel => document.querySelectorAll(sel).forEach(el =>
      el.addEventListener('click', (e) => { e.preventDefault(); doZoomOut(); })
    ));

    resetBtn?.addEventListener('click', resetZoom);

    // NEW: goto button handler (uses a simple prompt)
    gotoBtn?.addEventListener('click', () => {
      if (!pages.length) return;
      const raw = prompt(`跳转到页码 (1 - ${pages.length})`, String(index + 1));
      if (raw == null) return; // cancel
      const num = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
      if (Number.isFinite(num)) goToPage(num);
    });

    // Keyboard shortcuts: + / - (skip if typing in an input/textarea)
    window.addEventListener('keydown', (e) => {
      const target = e.target;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing) return;

      if (panel.getAttribute('aria-hidden') === 'false') {
        if (e.key === 'Escape') closePanel();
        if (e.key === 'ArrowRight' && (!nextBtn || !nextBtn.disabled)) { e.preventDefault(); nextPage(); }
        if (e.key === 'ArrowLeft'  && (!prevBtn || !prevBtn.disabled)) { e.preventDefault(); prevPage(); }

        // +/- zoom
        if (e.key === '+' || (e.key === '=' && e.shiftKey)) { e.preventDefault(); doZoomIn(); }
        if (e.key === '-') { e.preventDefault(); doZoomOut(); }

        // Optional: press 'g' to jump
        if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          if (!pages.length) return;
          const raw = prompt(`跳转到页码 (1 - ${pages.length})`, String(index + 1));
          if (raw != null) {
            const num = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
            if (Number.isFinite(num)) goToPage(num);
          }
        }
      }
    });

    // Original fullscreen (kept)
    maximizeBtn?.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement) { await dialog.requestFullscreen?.(); }
      } catch (e) { console.warn('Fullscreen not available:', e); }
    });
    minimizeBtn?.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) { await document.exitFullscreen?.(); }
      } catch (e) { console.warn('Exit fullscreen failed:', e); }
    });

    document.addEventListener('fullscreenchange', () => {
      updateFullscreenButtons();
    });

    window.addEventListener('resize', () => {
      updateCompactControls();
      render();
    });

    // Init
    updateCompactControls();
    applyZoom();

    // === Max/Min actual zoom: fit to width / fit to height (override) ===
    (function overrideMaxMinZoom() {
      if (!maximizeBtn || !minimizeBtn || !pagesWrap) return;

      const getVarPx = (el, name, fallback) => {
        const v = getComputedStyle(el).getPropertyValue(name).trim();
        if (!v) return fallback;
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : fallback;
      };
      const getVarNum = (el, name, fallback) => {
        const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
        return Number.isFinite(v) ? v : fallback;
      };

      function getFitWidthZoom() {
        const baseH = window.innerHeight - getVarPx(document.documentElement, '--page-vert-pad', 110);
        if (baseH <= 0) return zoom;

        const pageW = getVarNum(panel, '--page-w', 15.26);
        const pageH = getVarNum(panel, '--page-h', 22);
        const ratioHperW = pageH / pageW;

        const st = getComputedStyle(pagesWrap);
        const padL = parseFloat(st.paddingLeft)  || 0;
        const padR = parseFloat(st.paddingRight) || 0;
        const availW = pagesWrap.clientWidth - padL - padR;
        if (availW <= 0) return zoom;

        const neededH = availW * ratioHperW;
        const z = neededH / baseH;
        return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
      }

      function updateZoomButtons() {
        const fitW = getFitWidthZoom();
        if (maximizeBtn) maximizeBtn.disabled = (zoom >= fitW - 0.01);
        if (minimizeBtn) minimizeBtn.disabled = (zoom <= 1.01);
      }

      minimizeBtn.removeAttribute('disabled');

      maximizeBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopImmediatePropagation();
        zoom = getFitWidthZoom();
        applyZoom();
        updateZoomButtons();
      }, true);

      minimizeBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopImmediatePropagation();
        zoom = 1;
        applyZoom();
        updateZoomButtons();
      }, true);

      const mo = new MutationObserver(() => {
        if (panel.getAttribute('aria-hidden') === 'false') {
          minimizeBtn.removeAttribute('disabled');
          updateZoomButtons();
        }
      });
      mo.observe(panel, { attributes: true, attributeFilter: ['aria-hidden', 'class'] });

      window.addEventListener('resize', updateZoomButtons);
      updateZoomButtons();
    })();

    // Debug helpers
    window.debugFirstUrls = function (selector) {
      const el = selector ? document.querySelector(selector) : document.querySelector('.book');
      if (!el) return console.warn('No .book element found for', selector);
      const urls = buildPagesFromDataset(el);
      console.log(urls.slice(0, 3));
      return urls.slice(0, 3);
    };
    window.debugOpenPanel = function () {
      console.log('debugOpenPanel()');
      openPanel('Test Book', ['img/book1/cover.jpg', 'img/book1/cover.jpg']);
    };
  } // end init

  // === A11y focus fix (unchanged) ===
  (function () {
    function attach() {
      var panel   = document.getElementById('flipPanel');
      var closeBtn = document.getElementById('closePanel');
      if (!panel) return;

      var lastFocusedTrigger = null;

      document.querySelectorAll('.book').forEach(function (b) {
        b.addEventListener('click', function (e) { lastFocusedTrigger = e.currentTarget; }, true);
        b.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { lastFocusedTrigger = e.currentTarget; }
        }, true);
      });

      function moveFocusOutOfPanel() {
        if (!panel.contains(document.activeElement)) return;

        var fallback =
          (lastFocusedTrigger && document.contains(lastFocusedTrigger))
            ? lastFocusedTrigger
            : document.querySelector('.book') || document.body;

        if (fallback && typeof fallback.focus === 'function' && fallback !== document.body) {
          try { fallback.focus({ preventScroll: true }); } catch (_) { /* noop */ }
        } else {
          var tmp = document.createElement('button');
          tmp.tabIndex = -1;
          tmp.style.position = 'fixed';
          tmp.style.top = '-10000px';
          document.body.appendChild(tmp);
          tmp.focus({ preventScroll: true });
          document.body.removeChild(tmp);
        }
      }

      if (closeBtn) {
        closeBtn.addEventListener('click', function () { moveFocusOutOfPanel(); }, true);
      }
      panel.addEventListener('click', function (e) {
        if (!e.target.closest('.panel__dialog')) { moveFocusOutOfPanel(); }
      }, true);
      window.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && panel.getAttribute('aria-hidden') === 'false') {
          moveFocusOutOfPanel();
        }
      }, true);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attach);
    } else {
      attach();
    }
  })();

})();
