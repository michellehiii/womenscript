// contact.js

document.addEventListener("DOMContentLoaded", () => {
  const form =
    document.getElementById("contact-form") ||
    document.querySelector("form.contact-left");

  if (!form) return;

  // ✅ Clear AFTER submitting to Web3Forms
  form.addEventListener("submit", () => {
    // small delay so Web3Forms API can read the values before clearing
    setTimeout(() => {
      form.reset();
    }, 500);
  });

  // ✅ Clear when returning via Back/Forward navigation (bfcache)
  window.addEventListener("pageshow", (event) => {
    const nav = performance.getEntriesByType("navigation")[0];
    const cameFromBFCache =
      event.persisted || (nav && nav.type === "back_forward");

    if (cameFromBFCache) {
      form.reset();
      form.querySelectorAll(".contact-inputs").forEach((el) => {
        el.value = "";
      });
    }
  });
});
