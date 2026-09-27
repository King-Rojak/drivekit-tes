/* ============================================================
   ROJAK DRIVEK1T — Custom Music Player
   Main player + Sticky Mini Player (muncul saat scroll)
   Gain boost 2.5x, waveform bell curve, lirik typewriter.
============================================================ */

(function () {
  "use strict";

  const TRACK = {
    title: "Tante Culik Aku Dong",
    artist: "King Rojak",
    src: "./music/tante-culik-aku-dong.mp3"
  };

  const LYRICS = [
    { t: 0,  text: "Tanteee" },
    { t: 2,  text: "Sudah Terbiasa" },
    { t: 4,  text: "Terjadi Tante" },
    { t: 5,  text: "Teman Datang" },
    { t: 7,  text: "Ketika Lagi" },
    { t: 8,  text: "Butuh Sajaaa" },
    { t: 10, text: "Coba Kalo" },
    { t: 11, text: "Lagi Susahh" },
    { t: 13, text: "Mereka Semua" },
    { t: 15, text: "Menghilaang" }
  ];

  const TYPE_SPEED_MS = 55;
  const ERASE_SPEED_MS = 25;
  const HOLD_AFTER_TYPE = 300;

  const WAVE_BARS = 72;
  const WAVE_GAP = 3;
  const WAVE_MIN_H = 3;
  const WAVE_ENVELOPE = true;
  const WAVE_ENVELOPE_POWER = 1.35;

  const GAIN_BOOST = 2.5;

  // Mini player
  const MINI_BARS = 14;
  const MINI_GAP = 2;

  const state = {
    audio: null,
    audioCtx: null,
    analyser: null,
    sourceNode: null,
    gainNode: null,
    waveAnimId: null,
    miniAnimId: null,
    duration: 0,
    isPlaying: false,
    loop: false,
    ready: false,
    analyserOK: false,
    fallbackTime: 0,
    freqData: null,
    miniOpen: false,
    miniDismissed: false,
    currentLyricIndex: -1,
    typewriterTimer: null,
    typewriterPhase: "idle",
    typedChars: 0,
    activeLyricText: ""
  };

  const ICON_MUSIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
  const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;
  const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
  const ICON_LOOP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") node.className = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k.startsWith("on") && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(c => {
        if (c == null) return;
        node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  /* ---------------------------------------------------------
     BUILD MAIN PLAYER
  --------------------------------------------------------- */

  function buildPlayer() {
    const section = el("section", {
      class: "rdk-music-section",
      id: "rdkMusicSection"
    });

    const playBtn = el("button", {
      class: "rdk-music-play",
      type: "button",
      id: "rdkMusicPlay",
      title: "Play",
      "aria-label": "Play",
      html: ICON_PLAY
    });

    const loopBtn = el("button", {
      class: "rdk-music-btn",
      type: "button",
      id: "rdkMusicLoop",
      title: "Loop",
      "aria-label": "Loop",
      html: ICON_LOOP
    });

    const headerActions = el("div", { class: "rdk-music-header-actions" }, [
      loopBtn,
      playBtn
    ]);

    const header = el("div", { class: "rdk-music-header" }, [
      el("div", { class: "rdk-music-icon", html: ICON_MUSIC }),
      el("div", { class: "rdk-music-meta" }, [
        el("div", { class: "rdk-music-title", text: TRACK.title }),
        el("div", { class: "rdk-music-artist", text: TRACK.artist })
      ]),
      headerActions
    ]);

    const waveWrap = el("div", { class: "rdk-music-wave-wrap" }, [
      el("canvas", { class: "rdk-music-wave", id: "rdkMusicWave" }),
      el("div", {
        class: "rdk-music-wave-empty",
        id: "rdkMusicWaveEmpty",
        text: "Tekan play untuk memulai"
      })
    ]);

    const lyricLine = el("div", {
      class: "rdk-music-lyric-line",
      id: "rdkMusicLyricLine"
    }, [
      el("span", {
        class: "rdk-music-lyric-text",
        id: "rdkMusicLyricText",
        text: ""
      }),
      el("span", {
        class: "rdk-music-cursor",
        id: "rdkMusicCursor",
        text: "|"
      })
    ]);

    const lyricWrap = el("div", { class: "rdk-music-lyric-wrap" }, [
      el("div", { class: "rdk-music-lyric-title", text: "Lirik" }),
      lyricLine
    ]);

    section.appendChild(header);
    section.appendChild(waveWrap);
    section.appendChild(lyricWrap);

    return section;
  }

  /* ---------------------------------------------------------
     BUILD MINI PLAYER
  --------------------------------------------------------- */

  function buildMiniPlayer() {
    const mini = el("div", {
      class: "rdk-music-mini",
      id: "rdkMusicMini"
    });

    const icon = el("div", {
      class: "rdk-music-mini-icon",
      html: ICON_MUSIC
    });

    const meta = el("div", { class: "rdk-music-mini-meta" }, [
      el("div", { class: "rdk-music-mini-title", text: TRACK.title }),
      el("div", { class: "rdk-music-mini-artist", text: TRACK.artist })
    ]);

    const miniWave = el("canvas", {
      class: "rdk-music-mini-wave",
      id: "rdkMusicMiniWave"
    });

    const loopBtn = el("button", {
      class: "rdk-music-mini-btn",
      type: "button",
      id: "rdkMusicMiniLoop",
      title: "Loop",
      "aria-label": "Loop",
      html: ICON_LOOP
    });

    const playBtn = el("button", {
      class: "rdk-music-mini-btn rdk-music-mini-play",
      type: "button",
      id: "rdkMusicMiniPlay",
      title: "Play",
      "aria-label": "Play",
      html: ICON_PLAY
    });

    const closeBtn = el("button", {
      class: "rdk-music-mini-close",
      type: "button",
      id: "rdkMusicMiniClose",
      title: "Sembunyikan",
      "aria-label": "Sembunyikan mini player",
      html: "×"
    });

    const controls = el("div", { class: "rdk-music-mini-controls" }, [
      loopBtn,
      playBtn,
      closeBtn
    ]);

    mini.appendChild(icon);
    mini.appendChild(meta);
    mini.appendChild(miniWave);
    mini.appendChild(controls);

    return mini;
  }

  /* ---------------------------------------------------------
     MOUNT
  --------------------------------------------------------- */

  function mount() {
    // Ganti spotify-section kalau ada
    const oldSpotify = document.querySelector(".spotify-section");
    const player = buildPlayer();

    if (oldSpotify && oldSpotify.parentNode) {
      oldSpotify.parentNode.replaceChild(player, oldSpotify);
    } else {
      const footer = document.querySelector(".footer");
      if (footer && footer.parentNode) {
        footer.parentNode.insertBefore(player, footer);
      } else {
        document.body.appendChild(player);
      }
    }

    // Tambahkan mini player ke body
    const mini = buildMiniPlayer();
    document.body.appendChild(mini);

    // Setup audio
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = TRACK.src;
    audio.volume = 1.0;
    state.audio = audio;

    audio.addEventListener("loadedmetadata", () => {
      state.duration = audio.duration || 0;
    });

    audio.addEventListener("canplay", () => {
      state.ready = true;
      const emptyEl = document.getElementById("rdkMusicWaveEmpty");
      if (emptyEl) emptyEl.classList.add("rdk-music-hidden");
    });

    audio.addEventListener("timeupdate", () => {
      updateLyricForTime(audio.currentTime);
    });

    audio.addEventListener("play", () => {
      state.isPlaying = true;
      updatePlayButtons();
      ensureAudioContext();
      startWaveAnimation();
      startMiniWaveAnimation();
      updateLyricForTime(audio.currentTime, true);
    });

    audio.addEventListener("pause", () => {
      state.isPlaying = false;
      updatePlayButtons();
      stopWaveAnimation();
      stopMiniWaveAnimation();
      stopTypewriter();
    });

    audio.addEventListener("ended", () => {
      state.isPlaying = false;
      updatePlayButtons();
      stopWaveAnimation();
      stopMiniWaveAnimation();
      stopTypewriter();
      if (state.loop) {
        audio.currentTime = 0;
        resetLyricState();
        audio.play().catch(() => {});
      }
    });

    audio.addEventListener("error", () => {
      console.error("[Music] Gagal load:", TRACK.src, audio.error);
      const emptyEl = document.getElementById("rdkMusicWaveEmpty");
      if (emptyEl) {
        emptyEl.textContent = "Lagu tidak ditemukan. Cek folder music/";
        emptyEl.classList.remove("rdk-music-hidden");
      }
    });

    /* Main player controls */
    const playBtn = document.getElementById("rdkMusicPlay");
    if (playBtn) playBtn.addEventListener("click", togglePlay);

    const loopBtn = document.getElementById("rdkMusicLoop");
    if (loopBtn) {
      loopBtn.addEventListener("click", toggleLoop);
    }

    /* Mini player controls */
    const miniPlayBtn = document.getElementById("rdkMusicMiniPlay");
    if (miniPlayBtn) {
      miniPlayBtn.addEventListener("click", e => {
        e.stopPropagation();
        togglePlay();
      });
    }

    const miniLoopBtn = document.getElementById("rdkMusicMiniLoop");
    if (miniLoopBtn) {
      miniLoopBtn.addEventListener("click", e => {
        e.stopPropagation();
        toggleLoop();
      });
    }

    const miniCloseBtn = document.getElementById("rdkMusicMiniClose");
    if (miniCloseBtn) {
      miniCloseBtn.addEventListener("click", e => {
        e.stopPropagation();
        state.miniDismissed = true;
        closeMini();
      });
    }

    // Klik mini player (bukan tombol) → scroll ke main player
    mini.addEventListener("click", e => {
      // Jika klik di tombol, abaikan
      if (e.target.closest("button")) return;
      scrollToMainPlayer();
    });

    /* Scroll listener untuk mini player */
    setupMiniVisibility();

    /* Resize */
    window.addEventListener("resize", () => {
      resizeCanvas();
      resizeMiniCanvas();
      if (!state.isPlaying) {
        drawIdleWave();
        drawMiniIdleWave();
      }
    });

    requestAnimationFrame(() => {
      resizeCanvas();
      resizeMiniCanvas();
      drawIdleWave();
      drawMiniIdleWave();
    });
  }

  /* ---------------------------------------------------------
     MINI VISIBILITY (IntersectionObserver)
  --------------------------------------------------------- */

  function setupMiniVisibility() {
    const section = document.getElementById("rdkMusicSection");
    if (!section) return;

    // Kalau browser support IntersectionObserver
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            // Kalau main player TIDAK kelihatan → tampilkan mini
            if (!entry.isIntersecting && !state.miniDismissed) {
              openMini();
            } else {
              closeMini();
            }
          }
        },
        { threshold: 0.15 }
      );
      observer.observe(section);
    } else {
      // Fallback: scroll listener
      window.addEventListener("scroll", () => {
        if (state.miniDismissed) return;
        const rect = section.getBoundingClientRect();
        const visible = rect.bottom > 0 && rect.top < window.innerHeight;
        visible ? closeMini() : openMini();
      }, { passive: true });
    }
  }

  function openMini() {
    const mini = document.getElementById("rdkMusicMini");
    if (!mini) return;
    if (state.miniOpen) return;

    state.miniOpen = true;
    mini.classList.add("rdk-music-mini-open");

    // Kalau musik sedang main, jalankan wave mini
    if (state.isPlaying) startMiniWaveAnimation();
    else drawMiniIdleWave();
  }

  function closeMini() {
    const mini = document.getElementById("rdkMusicMini");
    if (!mini) return;
    if (!state.miniOpen) return;

    state.miniOpen = false;
    mini.classList.remove("rdk-music-mini-open");
  }

  function scrollToMainPlayer() {
    const section = document.getElementById("rdkMusicSection");
    if (!section) return;

    // Reset dismissed saat user klik mini
    state.miniDismissed = false;

    section.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  /* ---------------------------------------------------------
     PLAY / PAUSE / LOOP
  --------------------------------------------------------- */

  function togglePlay() {
    const audio = state.audio;
    if (!audio) return;

    if (audio.paused) {
      ensureAudioContext(true);
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(err => console.error("[Music] Play error:", err));
      }
    } else {
      audio.pause();
    }
  }

  function toggleLoop() {
    state.loop = !state.loop;
    if (state.audio) state.audio.loop = state.loop;

    const mainLoop = document.getElementById("rdkMusicLoop");
    if (mainLoop) mainLoop.classList.toggle("rdk-music-btn-active", state.loop);

    const miniLoop = document.getElementById("rdkMusicMiniLoop");
    if (miniLoop) miniLoop.classList.toggle("rdk-music-btn-active", state.loop);
  }

  function updatePlayButtons() {
    const icon = state.isPlaying ? ICON_PAUSE : ICON_PLAY;
    const label = state.isPlaying ? "Pause" : "Play";

    const mainBtn = document.getElementById("rdkMusicPlay");
    if (mainBtn) {
      mainBtn.innerHTML = icon;
      mainBtn.title = label;
      mainBtn.setAttribute("aria-label", label);
    }

    const miniBtn = document.getElementById("rdkMusicMiniPlay");
    if (miniBtn) {
      miniBtn.innerHTML = icon;
      miniBtn.title = label;
      miniBtn.setAttribute("aria-label", label);
    }
  }

  /* ---------------------------------------------------------
     AUDIO CONTEXT + GAIN
  --------------------------------------------------------- */

  function ensureAudioContext() {
    if (state.audioCtx) {
      if (state.audioCtx.state === "suspended") {
        state.audioCtx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      const source = ctx.createMediaElementSource(state.audio);
      const analyser = ctx.createAnalyser();
      const gainNode = ctx.createGain();

      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.65;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      gainNode.gain.value = GAIN_BOOST;

      source.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(ctx.destination);

      state.freqData = new Uint8Array(analyser.frequencyBinCount);

      state.audioCtx = ctx;
      state.analyser = analyser;
      state.sourceNode = source;
      state.gainNode = gainNode;
      state.analyserOK = true;
    } catch (err) {
      console.error("[Music] AudioContext error:", err);
      state.analyserOK = false;
    }
  }

  /* ---------------------------------------------------------
     CANVAS RESIZE
  --------------------------------------------------------- */

  function resizeCanvas() {
    const canvas = document.getElementById("rdkMusicWave");
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    const dpr = window.devicePixelRatio || 1;

    const newW = Math.floor(w * dpr);
    const newH = Math.floor(h * dpr);

    if (canvas.width !== newW || canvas.height !== newH) {
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function resizeMiniCanvas() {
    const canvas = document.getElementById("rdkMusicMiniWave");
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    const dpr = window.devicePixelRatio || 1;

    const newW = Math.floor(w * dpr);
    const newH = Math.floor(h * dpr);

    if (canvas.width !== newW || canvas.height !== newH) {
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  /* ---------------------------------------------------------
     ENVELOPE
  --------------------------------------------------------- */

  function envelope(i, total) {
    if (!WAVE_ENVELOPE) return 1;
    const x = (i / (total - 1)) * 2 - 1;
    const bell = Math.cos((x * Math.PI) / 2);
    return Math.pow(Math.max(0, bell), WAVE_ENVELOPE_POWER);
  }

  /* ---------------------------------------------------------
     MAIN WAVE DRAW
  --------------------------------------------------------- */

  function drawIdleWave() {
    const canvas = document.getElementById("rdkMusicWave");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const mid = h / 2;

    ctx.clearRect(0, 0, w, h);

    const bars = WAVE_BARS;
    const gap = WAVE_GAP;
    const barW = Math.max(1, (w - gap * (bars - 1)) / bars);

    ctx.fillStyle = "#3a3b37";

    for (let i = 0; i < bars; i++) {
      const x = i * (barW + gap);
      const env = envelope(i, bars);
      const barH = Math.max(2, WAVE_MIN_H + env * 6);
      ctx.fillRect(x, mid - barH / 2, barW, barH);
    }
  }

  function startWaveAnimation() {
    if (state.waveAnimId) return;
    const canvas = document.getElementById("rdkMusicWave");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    resizeCanvas();

    function frame() {
      state.waveAnimId = requestAnimationFrame(frame);

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const mid = h / 2;

      ctx.clearRect(0, 0, w, h);

      const bars = WAVE_BARS;
      const gap = WAVE_GAP;
      const barW = Math.max(1, (w - gap * (bars - 1)) / bars);

      let usedAnalyser = false;

      if (state.analyser && state.analyserOK && state.freqData) {
        state.analyser.getByteFrequencyData(state.freqData);
        let maxVal = 0;
        for (let i = 0; i < state.freqData.length; i++) {
          if (state.freqData[i] > maxVal) maxVal = state.freqData[i];
        }

        if (maxVal > 0) {
          usedAnalyser = true;
          const usable = Math.floor(state.freqData.length * 0.55);

          for (let i = 0; i < bars; i++) {
            const norm = i / (bars - 1);
            const idx = Math.floor(Math.pow(norm, 0.85) * (usable - 1));
            const v = state.freqData[idx] / 255;
            const env = envelope(i, bars);
            const barH = Math.max(WAVE_MIN_H, WAVE_MIN_H + (v * env) * (h * 0.92));
            const x = i * (barW + gap);
            const alpha = 0.4 + v * 0.6;
            ctx.fillStyle = `rgba(228, 86, 50, ${alpha})`;
            ctx.fillRect(x, mid - barH / 2, barW, barH);
          }
        }
      }

      if (!usedAnalyser) {
        state.fallbackTime += 0.12;
        for (let i = 0; i < bars; i++) {
          const env = envelope(i, bars);
          const base =
            Math.sin(state.fallbackTime + i * 0.35) * 0.5 +
            Math.sin(state.fallbackTime * 1.7 + i * 0.18) * 0.3 +
            Math.sin(state.fallbackTime * 0.6 + i * 0.9) * 0.2;
          const v = Math.abs(base) * env;
          const barH = Math.max(WAVE_MIN_H, WAVE_MIN_H + v * (h * 0.75));
          const x = i * (barW + gap);
          const alpha = 0.4 + v * 0.5;
          ctx.fillStyle = `rgba(228, 86, 50, ${alpha})`;
          ctx.fillRect(x, mid - barH / 2, barW, barH);
        }
      }
    }

    frame();
  }

  function stopWaveAnimation() {
    if (state.waveAnimId) {
      cancelAnimationFrame(state.waveAnimId);
      state.waveAnimId = null;
    }
    drawIdleWave();
  }

  /* ---------------------------------------------------------
     MINI WAVE DRAW
  --------------------------------------------------------- */

  function drawMiniIdleWave() {
    const canvas = document.getElementById("rdkMusicMiniWave");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const mid = h / 2;

    ctx.clearRect(0, 0, w, h);

    const bars = MINI_BARS;
    const gap = MINI_GAP;
    const barW = Math.max(1, (w - gap * (bars - 1)) / bars);

    ctx.fillStyle = "#3a3b37";

    for (let i = 0; i < bars; i++) {
      const x = i * (barW + gap);
      const env = envelope(i, bars);
      const barH = Math.max(2, 2 + env * 4);
      ctx.fillRect(x, mid - barH / 2, barW, barH);
    }
  }

  function startMiniWaveAnimation() {
    if (state.miniAnimId) return;
    const canvas = document.getElementById("rdkMusicMiniWave");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    resizeMiniCanvas();

    function frame() {
      state.miniAnimId = requestAnimationFrame(frame);

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const mid = h / 2;

      ctx.clearRect(0, 0, w, h);

      const bars = MINI_BARS;
      const gap = MINI_GAP;
      const barW = Math.max(1, (w - gap * (bars - 1)) / bars);

      let usedAnalyser = false;

      if (state.analyser && state.analyserOK && state.freqData) {
        state.analyser.getByteFrequencyData(state.freqData);
        let maxVal = 0;
        for (let i = 0; i < state.freqData.length; i++) {
          if (state.freqData[i] > maxVal) maxVal = state.freqData[i];
        }

        if (maxVal > 0) {
          usedAnalyser = true;
          const usable = Math.floor(state.freqData.length * 0.55);

          for (let i = 0; i < bars; i++) {
            const norm = i / (bars - 1);
            const idx = Math.floor(Math.pow(norm, 0.85) * (usable - 1));
            const v = state.freqData[idx] / 255;
            const env = envelope(i, bars);
            const barH = Math.max(2, 2 + (v * env) * (h * 0.9));
            const x = i * (barW + gap);
            const alpha = 0.5 + v * 0.5;
            ctx.fillStyle = `rgba(228, 86, 50, ${alpha})`;
            ctx.fillRect(x, mid - barH / 2, barW, barH);
          }
        }
      }

      if (!usedAnalyser) {
        state.fallbackTime += 0.14;
        for (let i = 0; i < bars; i++) {
          const env = envelope(i, bars);
          const base = Math.sin(state.fallbackTime + i * 0.5) * 0.7;
          const v = Math.abs(base) * env;
          const barH = Math.max(2, 2 + v * (h * 0.7));
          const x = i * (barW + gap);
          const alpha = 0.5 + v * 0.5;
          ctx.fillStyle = `rgba(228, 86, 50, ${alpha})`;
          ctx.fillRect(x, mid - barH / 2, barW, barH);
        }
      }
    }

    frame();
  }

  function stopMiniWaveAnimation() {
    if (state.miniAnimId) {
      cancelAnimationFrame(state.miniAnimId);
      state.miniAnimId = null;
    }
    drawMiniIdleWave();
  }

  /* ---------------------------------------------------------
     LIRIK TYPEWRITER (MAIN)
  --------------------------------------------------------- */

  function resetLyricState() {
    stopTypewriter();
    state.currentLyricIndex = -1;
    state.typedChars = 0;
    state.activeLyricText = "";
    state.typewriterPhase = "idle";
    renderLyricText("");
  }

  function stopTypewriter() {
    if (state.typewriterTimer) {
      clearTimeout(state.typewriterTimer);
      state.typewriterTimer = null;
    }
  }

  function renderLyricText(text) {
    const textEl = document.getElementById("rdkMusicLyricText");
    if (textEl) textEl.textContent = text;
  }

  function setCursorVisible(visible) {
    const cursor = document.getElementById("rdkMusicCursor");
    if (cursor) cursor.style.opacity = visible ? "1" : "0";
  }

  function findLyricIndexForTime(time) {
    let idx = -1;
    for (let i = 0; i < LYRICS.length; i++) {
      if (time >= LYRICS[i].t) idx = i;
      else break;
    }
    return idx;
  }

  function updateLyricForTime(time, force) {
    const idx = findLyricIndexForTime(time);
    if (idx === state.currentLyricIndex && !force) return;
    state.currentLyricIndex = idx;

    if (idx < 0) {
      stopTypewriter();
      state.activeLyricText = "";
      state.typedChars = 0;
      state.typewriterPhase = "idle";
      renderLyricText("");
      setCursorVisible(false);
      return;
    }

    startTypewriterForIndex(idx);
  }

  function startTypewriterForIndex(idx) {
    stopTypewriter();

    const fullText = LYRICS[idx].text || "";
    state.activeLyricText = fullText;
    state.typedChars = 0;
    state.typewriterPhase = "typing";
    setCursorVisible(true);
    renderLyricText("");

    typeNextChar();
  }

  function typeNextChar() {
    if (state.typewriterPhase !== "typing") return;

    const full = state.activeLyricText;
    if (state.typedChars >= full.length) {
      state.typewriterPhase = "holding";
      state.typewriterTimer = setTimeout(() => {
        state.typewriterPhase = "erasing";
        eraseNextChar();
      }, HOLD_AFTER_TYPE);
      return;
    }

    state.typedChars++;
    renderLyricText(full.slice(0, state.typedChars));

    if (!state.isPlaying) return;
    state.typewriterTimer = setTimeout(typeNextChar, TYPE_SPEED_MS);
  }

  function eraseNextChar() {
    if (state.typewriterPhase !== "erasing") return;

    if (state.typedChars <= 0) {
      state.typewriterPhase = "idle";
      renderLyricText("");
      return;
    }

    state.typedChars--;
    renderLyricText(state.activeLyricText.slice(0, state.typedChars));

    if (!state.isPlaying) return;
    state.typewriterTimer = setTimeout(eraseNextChar, ERASE_SPEED_MS);
  }

  /* ---------------------------------------------------------
     INIT
  --------------------------------------------------------- */

  function init() {
    if (document.getElementById("rdkMusicSection")) return;
    mount();
    setCursorVisible(false);

    setTimeout(() => {
      resizeCanvas();
      resizeMiniCanvas();
      if (!state.isPlaying) {
        drawIdleWave();
        drawMiniIdleWave();
      }
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();