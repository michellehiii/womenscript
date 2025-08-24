(function attachCarousel(id){
    const root = document.getElementById(id);
    if(!root) return;
    const vp   = root.querySelector('.viewport');
    const prev = root.querySelector('.prev');
    const next = root.querySelector('.next');

    function cardStep(){
      const first = vp.querySelector('.card');
      if(!first) return 0;
      const rect = first.getBoundingClientRect();
      const styles = getComputedStyle(vp);
      const gap = parseFloat(styles.columnGap || styles.gap) || 0;
      return rect.width + gap; // exactly one card at a time
    }

    function go(dir){ vp.scrollBy({ left: dir * cardStep(), behavior: 'smooth' }); }
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(+1));

    // Keyboard support
    vp.tabIndex = 0;
    vp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft')  go(-1);
      if (e.key === 'ArrowRight') go(+1);
    });
  })('carousel1');