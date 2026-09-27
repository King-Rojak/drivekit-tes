/* ============================================================
   ROJAK DRIVEK1T — Custom Music Player
   FIX FINAL: canvas dijamin selalu render waveform.
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

  const state = {
    audio: null,
    audioCtx: null,
    analyser: null,
    sourceNode: null,
    waveAnimId: null,
    duration: 0,
    volume: 1,
    isPlaying: false,
    loop: false,
    ready: false,
    analyserOK: false,
    fallbackTime: 0,
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
  const ICON_VOL_HIGH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
  const ICON_VOL_MUTE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;

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

  function buildPlayer() {
    const section = el("section", {
      class: "rdk-music-section",
      id: "rdkMusicSection"
    });

    const playBtn = el("button", {
      class: "rdk-music-play", type: "button",
      id: "rdkMusicPlay", title: "Play", html: ICON_PLAY
    });

    const loopBtn = el("button", {
      class: "rdk-music-btn", type: "button",
      id: "rdkMusicLoop", title: "Loop", html: ICON_LOOP
    });

    const headerActions = el("div", { class: "rdk-music-header-actions" }, [
      loopBtn, playBtn
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

    const volIcon = el("span", { id: "rdkMusicVolIcon", html: ICON_VOL_HIGH });

    const volSlider = el("input", {
      type: "range", id: "rdkMusicVolume",
      min: "0", max: "1", step: "0.01", value: "1"
    });

    const volValue = el("span", {
      class: "rdk-music-volume-value",
      id: "rdkMusicVolValue", text: "100"
    });

    const volume = el("div", { class: "rdk-music-volume" }, [
      volIcon, volSlider, volValue
    ]);

    const lyricLine = el("div", {
      class: "rdk-music-lyric-line", id: "rdkMusicLyricLine"
    }, [
      el("span", {
        class: "rdk-music-lyric-text", id: "rdkMusicLyricText", text: ""
      }),
      el("span", {
        class: "rdk-music-cursor", id: "rdkMusicCursor", text: "|"
      })
    ]);

    const lyricWrap = el("div", { class: "rdk-music-lyric-wrap" }, [
      el("div", { class: "rdk-music-lyric-title", text: "LIRIK" }),
      lyricLine
    ]);

    section.appendChild(header);
    section.appendChild(waveWrap);
    section.appendChild(volume);
    section.appendChild(lyricWrap);

    return section;
  }

  function mount() {
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

    const audio = new Audio();
    audio.preload = "auto";
    audio.src = TRACK.src;
    state.audio = audio;

    audio.addEventListener("loadedmetadata", () => {
      state.duration = audio.duration || 0;
      console.log("[Music] duration:", state.duration);
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
      updatePlayButton();
      ensureAudioContext();
      // Selalu jalankan animasi (fallback kalau analyser gagal)
      startWaveAnimation();
      updateLyricForTime(audio.currentTime, true);
    });

    audio.addEventListener("pause", () => {
      state.isPlaying = false;
      updatePlayButton();
      stopWaveAnimation();
      stopTypewriter();
    });

    audio.addEventListener("ended", () => {
      state.isPlaying = false;
      updatePlayButton();
      stopWaveAnimation();
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

    const playBtn = document.getElementById("rdkMusicPlay");
    if (playBtn) playBtn.addEventListener("click", togglePlay);

    const loopBtn = document.getElementById("rdkMusicLoop");
    if (loopBtn) {
      loopBtn.addEventListener("click", () => {
        state.loop = !state.loop;
        audio.loop = state.loop;
        loopBtn.classList.toggle("rdk-music-btn-active", state.loop);
      });
    }

    const volSlider = document.getElementById("rdkMusicVolume");
    const volValue = document.getElementById("rdkMusicVolValue");
    const volIcon = document.getElementById("rdkMusicVolIcon");

    if (volSlider) {
      volSlider.addEventListener("input", e => {
        const v = parseFloat(e.target.value);
        state.volume = v;
        audio.volume = v;
        if (volValue) volValue.textContent = Math.round(v * 100);
        if (volIcon) volIcon.innerHTML = v === 0 ? ICON_VOL_MUTE : ICON_VOL_HIGH;
      });
    }

    window.addEventListener("resize", () => {
      resizeCanvas();
      if (!state.isPlaying) drawIdleWave();
    });

    // Panggil resizeCanvas SETELAH frame berikutnya biar layout sudah settle
    requestAnimationFrame(() => {
      resizeCanvas();
      drawIdleWave();
    });
  }

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

  function updatePlayButton() {
    const btn = document.getElementById("rdkMusicPlay");
    if (!btn) return;
    btn.innerHTML = state.isPlaying ? ICON_PAUSE : ICON_PLAY;
    btn.title = state.isPlaying ? "Pause" : "Play";
  }

  function ensureAudioContext(forceResume) {
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

      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const source = ctx.createMediaElementSource(state.audio);
      const analyser = ctx.createAnalyser();

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;

      source.connect(analyser);
      analyser.connect(ctx.destination);

      state.audioCtx = ctx;
      state.analyser = analyser;
      state.sourceNode = source;
      state.analyserOK = true;

      console.log("[Music] AudioContext OK, state:", ctx.state);
    } catch (err) {
      console.error("[Music] AudioContext error:", err);
      state.analyserOK = false;
    }
  }

  function resizeCanvas() {
    const canvas = document.getElementById("rdkMusicWave");
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));

    // Hanya resize kalau ukuran benar-benar beda (biar nggak reset terus)
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

  /**
   * Gambar waveform statis (saat idle / paused).
   * Pakai ukuran dari canvas element langsung.
   */
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

    const bars = 64;
    const gap = 3;
    const barW = Math.max(1, (w - gap * (bars - 1)) / bars);

    ctx.fillStyle = "#3a3b37";

    for (let i = 0; i < bars; i++) {
      const x = i * (barW + gap);
      const barH = 4;
      ctx.fillRect(x, mid - barH / 2, barW, barH);
    }
  }

  function startWaveAnimation() {
    if (state.waveAnimId) return;

    const canvas = document.getElementById("rdkMusicWave");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Pastikan ukuran canvas sudah benar
    resizeCanvas();

    function frame() {
      state.waveAnimId = requestAnimationFrame(frame);

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const mid = h / 2;

      ctx.clearRect(0, 0, w, h);

      const bars = 64;
      const gap = 3;
      const barW = Math.max(1, (w - gap * (bars - 1)) / bars);

      // Coba pakai analyser dulu
      let usedAnalyser = false;
      if (state.analyser && state.analyserOK) {
        const data = new Uint8Array(state.analyser.frequencyBinCount);
        state.analyser.getByteFrequencyData(data);

        // Cek apakah ada data (bukan semua nol)
        let maxVal = 0;
        for (let i = 0; i < data.length; i++) {
          if (data[i] > maxVal) maxVal = data[i];
        }

        if (maxVal > 0) {
          usedAnalyser = true;
          const usable = Math.floor(data.length * 0.7);

          for (let i = 0; i < bars; i++) {
            const idx = Math.floor((i / bars) * usable);
            const v = data[idx] / 255;
            const barH = Math.max(4, v * (h * 0.92));
            const x = i * (barW + gap);
            const alpha = 0.55 + v * 0.45;
            ctx.fillStyle = `rgba(228, 86, 50, ${alpha})`;
            ctx.fillRect(x, mid - barH / 2, barW, barH);
          }
        }
      }

      // FALLBACK: kalau analyser nggak ada / nggak dapet data
      if (!usedAnalyser) {
        state.fallbackTime += 0.12;

        // Selalu gambar waveform (biar tidak kosong sama sekali)
        for (let i = 0; i < bars; i++) {
          const base =
            Math.sin(state.fallbackTime + i * 0.35) * 0.5 +
            Math.sin(state.fallbackTime * 1.7 + i * 0.18) * 0.3 +
            Math.sin(state.fallbackTime * 0.6 + i * 0.9) * 0.2;

          const v = Math.abs(base);
          const barH = Math.max(6, v * (h * 0.7));
          const x = i * (barW + gap);
          const alpha = 0.45 + v * 0.5;
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

  function init() {
    if (document.getElementById("rdkMusicSection")) return;
    mount();
    setCursorVisible(false);

    // Panggil lagi setelah 500ms untuk memastikan canvas sudah ter-render
    setTimeout(() => {
      resizeCanvas();
      if (!state.isPlaying) drawIdleWave();
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
