/* ============================================================
   RDK PREMIUM — Signature motion layer
   Bukan library. Bukan framework. Hanya detail yang bikin beda.
============================================================ */

(function () {
  "use strict";

  /* ---------- GUARD ---------- */

  const prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) return;

  const isDesktop =
    window.matchMedia && window.matchMedia("(pointer: fine)").matches;

  /* ============================================================
     1. RAIL — dua garis bergerak diagonal
  ============================================================ */

  function injectRails() {
    if (document.querySelector(".rdk-rail")) return;

    const rail1 = document.createElement("div");
    rail1.className = "rdk-rail";
    rail1.setAttribute("aria-hidden", "true");

    const rail2 = document.createElement("div");
    rail2.className = "rdk-rail rdk-rail-2";
    rail2.setAttribute("aria-hidden", "true");

    document.body.appendChild(rail1);
    document.body.appendChild(rail2);
  }

  /* ============================================================
     2. CURSOR — dot + ring dengan lerp
  ============================================================ */

  function setupCursor() {
    if (!isDesktop) return;
    if (document.querySelector(".rdk-cursor-dot")) return;

    const dot = document.createElement("div");
    dot.className = "rdk-cursor-dot";
    dot.setAttribute("aria-hidden", "true");

    const ring = document.createElement("div");
    ring.className = "rdk-cursor-ring";
    ring.setAttribute("aria-hidden", "true");

    document.body.appendChild(dot);
    document.body.appendChild(ring);
    document.body.classList.add("rdk-cursor-active");

    let mouseX = -100;
    let mouseY = -100;
    let dotX = -100;
    let dotY = -100;
    let ringX = -100;
    let ringY = -100;
    let raf = 0;

    document.addEventListener("pointermove", function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (!raf) {
        raf = requestAnimationFrame(tick);
      }
    }, { passive: true });

    function tick() {
      // Dot — responsif cepat
      dotX += (mouseX - dotX) * 0.55;
      dotY += (mouseY - dotY) * 0.55;

      // Ring — trailing
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;

      dot.style.transform = `translate(${dotX}px, ${dotY}px)`;
      ring.style.transform = `translate(${ringX}px, ${ringY}px)`;

      raf = requestAnimationFrame(tick);
    }

    // Hover state
    const interactiveSelector =
      "a, button, input, textarea, select, .tab, .admin-tab, .drive-card, .user-card, .rdk-music-track, .summary-card";

    document.addEventListener("pointerover", function (e) {
      const target = e.target.closest(interactiveSelector);
      if (target) {
        document.body.classList.add("rdk-cursor-hover");
      }
    });

    document.addEventListener("pointerout", function (e) {
      const target = e.target.closest(interactiveSelector);
      if (target) {
        const stillInside = e.relatedTarget && e.relatedTarget.closest(interactiveSelector);
        if (!stillInside) {
          document.body.classList.remove("rdk-cursor-hover");
        }
      }
    });

    // Hide saat keluar window
    document.addEventListener("mouseleave", function () {
      dot.style.opacity = "0";
      ring.style.opacity = "0";
    });

    document.addEventListener("mouseenter", function () {
      dot.style.opacity = "1";
      ring.style.opacity = "1";
    });
  }

  /* ============================================================
     3. MAGNETIC BUTTON — button utama mengikuti cursor sedikit
  ============================================================ */

  function setupMagnetic() {
    if (!isDesktop) return;

    const selector =
      ".create-button, .google-login, .broadcast-send, .open-drive-button, .rojak-ai-fab";

    document.querySelectorAll(selector).forEach(function (btn) {
      btn.classList.add("rdk-magnetic");

      let rect = null;

      btn.addEventListener("pointerenter", function () {
        rect = btn.getBoundingClientRect();
      });

      btn.addEventListener("pointermove", function (e) {
        if (!rect) rect = btn.getBoundingClientRect();

        const relX = e.clientX - rect.left - rect.width / 2;
        const relY = e.clientY - rect.top - rect.height / 2;

        // Max geser 20% dari ukuran
        const maxX = rect.width * 0.18;
        const maxY = rect.height * 0.18;

        const moveX = Math.max(-maxX, Math.min(maxX, relX * 0.28));
        const moveY = Math.max(-maxY, Math.min(maxY, relY * 0.28));

        btn.style.transform = `translate(${moveX}px, ${moveY}px)`;
      }, { passive: true });

      btn.addEventListener("pointerleave", function () {
        btn.style.transform = "";
        rect = null;
      });
    });
  }

  /* ============================================================
     4. STAGGER REVEAL — untuk list
  ============================================================ */

  function applyStagger(container, step) {
    if (!container) return;
    step = step || 40;

    Array.from(container.children).forEach(function (child, i) {
      child.style.animationDelay = (i * step) + "ms";
    });
  }

  function setupStagger() {
    // Container yang kita tahu berisi list
    const containers = document.querySelectorAll(
      ".user-list, .broadcast-list, .summary, .login-features"
    );

    containers.forEach(function (c) {
      c.classList.add("rdk-stagger");
    });

    // Kalau list berubah (misal user refresh), apply ulang delay
    if ("MutationObserver" in window) {
      const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          if (m.type === "childList" && m.target.classList.contains("rdk-stagger")) {
            applyStagger(m.target);
          }
        });
      });

      containers.forEach(function (c) {
        observer.observe(c, { childList: true });
      });
    }
  }

  /* ============================================================
     5. REVEAL ON SCROLL
  ============================================================ */

  function setupReveal() {
    if (!("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("rdk-in-view");
          io.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.08,
      rootMargin: "0px 0px -40px 0px"
    });

    document.querySelectorAll(
      ".spotify-section, .footer, .rdk-music-section, .broadcast-form, .drive-card, .panel"
    ).forEach(function (el) {
      io.observe(el);
    });
  }

  /* ============================================================
     6. COUNT-UP — angka berubah dengan animasi
  ============================================================ */

  function animateCount(el, to, duration) {
    if (!el) return;
    const from = Number(el.textContent) || 0;
    if (from === to) return;

    duration = duration || 700;
    const start = performance.now();

    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      // ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (to - from) * eased);
      el.textContent = String(current);

      if (t < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  function setupCountUp() {
    // Patch summary value
    const summaryIds = ["totalUsers", "totalAdmins", "totalMembers"];
    summaryIds.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;

      const target = Number(el.textContent) || 0;
      el.textContent = "0";
      setTimeout(function () { animateCount(el, target); }, 200);
    });
  }

  /* ============================================================
     7. SMOOTH ANCHOR — kalau ada internal link
  ============================================================ */

  function setupSmoothScroll() {
    document.addEventListener("click", function (e) {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;

      const id = a.getAttribute("href");
      if (!id || id === "#") return;

      const target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* ============================================================
     8. TAB CHANGE — micro animation
  ============================================================ */

  function setupTabChange() {
    document.addEventListener("click", function (e) {
      const tab = e.target.closest(".tab, .admin-tab");
      if (!tab) return;

      // Reset sheen pada tombol send supaya tetap smooth
      tab.style.transform = "";
    });
  }

  /* ============================================================
     9. FORM FEEDBACK — subtle
  ============================================================ */

  function setupFormFeedback() {
    document.addEventListener("focusin", function (e) {
      const field = e.target.closest(".input, .textarea, .search-input");
      if (!field) return;

      const parent = field.closest(".field") || field.parentElement;
      if (parent) parent.style.transition = "transform 240ms var(--rdk-ease-out)";
    });

    document.addEventListener("focusout", function (e) {
      const field = e.target.closest(".input, .textarea, .search-input");
      if (!field) return;

      const parent = field.closest(".field") || field.parentElement;
      if (parent) parent.style.transform = "";
    });
  }

  /* ============================================================
     10. INIT
  ============================================================ */

  function init() {
    injectRails();
    setupCursor();
    setupMagnetic();
    setupStagger();
    setupReveal();
    setupCountUp();
    setupSmoothScroll();
    setupTabChange();
    setupFormFeedback();

    // Re-apply magnetic ke button baru (misal user card di-render ulang)
    if ("MutationObserver" in window) {
      const mo = new MutationObserver(function () {
        setupMagnetic();
      });

      // Throttle biar tidak berat
      let scheduled = false;
      const scheduleMagnetic = function () {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(function () {
          scheduled = false;
          setupMagnetic();
        });
      };

      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose helper kalau perlu dari luar
  window.RDK_PREMIUM = {
    animateCount: animateCount,
    applyStagger: applyStagger
  };

})();