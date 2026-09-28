
/* ============================================================
   RDK PREMIUM MOTION JS
   Lightweight interaction layer — no framework.
============================================================ */
(function(){
  "use strict";

  const reduce = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  // Make the loading screen leave smoothly when the existing app
  // tells it to hide. We keep the original loading logic intact.
  const loading = document.getElementById("loadingScreen");
  if (loading) {
    const observer = new MutationObserver(function(){
      if (getComputedStyle(loading).display === "none") {
        loading.classList.add("rdk-loading-exit");
      }
    });
    observer.observe(loading,{attributes:true,attributeFilter:["style","class"]});
  }

  // Ripple-like micro feedback without changing button markup.
  document.addEventListener("pointerdown", function(e){
    const target = e.target.closest("button,.tab");
    if (!target || target.disabled) return;
    target.animate(
      [{transform:"translateY(0) scale(1)"},{transform:"translateY(1px) scale(.985)"},{transform:"translateY(0) scale(1)"}],
      {duration:180,easing:"ease-out"}
    );
  }, {passive:true});

  // Reveal elements that enter the viewport. Elements already animated
  // by the stylesheet remain untouched.
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add("rdk-in-view");
          io.unobserve(entry.target);
        }
      });
    },{threshold:.08});
    document.querySelectorAll(".spotify-section,.footer").forEach(function(el){io.observe(el)});
  }

  // Desktop cursor spotlight — extremely subtle, no glow-heavy UI.
  if (window.matchMedia("(pointer:fine)").matches) {
    let raf = 0, x = -9999, y = -9999;
    document.addEventListener("pointermove",function(e){
      x=e.clientX; y=e.clientY;
      if(raf) return;
      raf=requestAnimationFrame(function(){
        document.documentElement.style.setProperty("--rdk-mx",x+"px");
        document.documentElement.style.setProperty("--rdk-my",y+"px");
        raf=0;
      });
    },{passive:true});
  }
})();
