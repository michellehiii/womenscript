// Enable :active on iOS Safari
document.addEventListener('touchstart', function(){}, {passive: true});

document.querySelectorAll('.btn-outline-white').forEach(btn => {
  const press = () => btn.classList.add('is-pressed');
  const release = () => btn.classList.remove('is-pressed');

  btn.addEventListener('touchstart', press, {passive: true});
  btn.addEventListener('touchend', release);
  btn.addEventListener('touchcancel', release);
  btn.addEventListener('blur', release);
});
