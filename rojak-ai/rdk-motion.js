/* ============================================================
   RDK MOTION JS — Fase 1: Foundation
   Interaction layer. Ringan, tidak ada framework.
============================================================ */

(function () {
  "use strict";

  /* ---------- REDUCED MOTION CHECK ---------- */

  const prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) return;

  /* ---------- LOADING SCREEN EXIT ---------- */

  function setupLoadingExit(el) {
    if (!el) return;

    const observer = new MutationObserver(function () {
      const computed = getComputedStyle(el).display;
      if (computed === "none") {
        el.classList.add("rdk-loading-exit");
        observer.disconnect();
      }
    });

    observer.observe(el, {
      attributes: true,
      attributeFilter: ["style", "class"]
    });
  }

  const loading = document.getElementById("loadingScreen");
  if (loading) {
    setupLoadingExit(loading);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      setupLoadingExit(document.getElementById("loadingScreen"));
    }, { once: true });
  }

  /* ---------- MICRO FEEDBACK — RIPPLE-LIKE ---------- */

  document.addEventListener("pointerdown", function (e) {
    const target = e.target.closest("button, .tab, .google-login");
    if (!target || target.disabled) return;

    // Skip kalau sudah ada animasi
    if (target.dataset.rdkPressed === "1") return;
    target.dataset.rdkPressed = "1";

    try {
      const anim = target.animate(
        [
          { transform: "translateY(0) scale(1)" },
          { transform: "translateY(1px) scale(.985)" },
          { transform: "translateY(0) scale(1)" }
        ],
        {
          duration: 200,
          easing: "cubic-bezier(.16, 1, .3, 1)"
        }
      );

      anim.onfinish = function () {
        target.dataset.rdkPressed = "0";
      };
    } catch (err) {
      target.dataset.rdkPressed = "0";
    }
  }, { passive: true });

  /* ---------- REVEAL ON SCROLL ---------- */

  if ("IntersectionObserver" in window) {
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

    document.addEventListener("DOMContentLoaded", function () {
      const items = document.querySelectorAll(
        ".spotify-section, .footer, .rdk-music-section, .rdk-music-mini"
      );
      items.forEach(function (el) { io.observe(el); });
    }, { once: true });
  }

  /* ---------- CURSOR SPOTLIGHT (DESKTOP ONLY) ---------- */

  if (window.matchMedia("(pointer: fine)").matches) {
    let rafId = 0;
    let mouseX = -9999;
    let mouseY = -9999;

    document.addEventListener("pointermove", function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (rafId) return;

      rafId = requestAnimationFrame(function () {
        document.documentElement.style.setProperty("--rdk-mx", mouseX + "px");
        document.documentElement.style.setProperty("--rdk-my", mouseY + "px");
        rafId = 0;
      });
    }, { passive: true });
  }

  /* ---------- BUTTON PRESS RIPPLE (SUBTLE) ---------- */

  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".google-login, .create-button, .open-drive-button");
    if (!btn || btn.disabled) return;

    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");

    ripple.style.cssText =
      "position:absolute;" +
      "border-radius:50%;" +
      "background:rgba(255,255,255,.18);" +
      "pointer-events:none;" +
      "transform:scale(0);" +
      "animation:rdkRipple 500ms cubic-bezier(.16,1,.3,1) forwards;" +
      "width:12px;height:12px;" +
      "left:" + (e.clientX - rect.left - 6) + "px;" +
      "top:" + (e.clientY - rect.top - 6) + "px;";

    // Pastikan parent punya position relative
    const computedPos = getComputedStyle(btn).position;
    if (computedPos === "static") {
      btn.style.position = "relative";
    }

    btn.appendChild(ripple);

    setTimeout(function () {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 600);
  });

  // Inject keyframe ripple ke head
  if (!document.getElementById("rdkRippleKeyframe")) {
    const style = document.createElement("style");
    style.id = "rdkRippleKeyframe";
    style.textContent =
      "@keyframes rdkRipple {" +
      "to { transform: scale(6); opacity: 0; }" +
      "}";
    document.head.appendChild(style);
  }

})();