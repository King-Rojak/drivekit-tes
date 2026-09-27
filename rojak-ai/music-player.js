/* ============================================================
   ROJAK DRIVEK1T — Custom Music Player
   Gain boost 2.5x, tanpa volume slider.
   Waveform bell curve + lirik typewriter.
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

  // Konfigurasi waveform
  const WAVE_BARS = 72;
  const WAVE_GAP = 3;
  const WAVE_MIN_H = 3;
  const WAVE_ENVELOPE = true;
  const WAVE_ENVELOPE_POWER = 1.4;

  // Konfigurasi gain (volume boost)
  const GAIN_BOOST = 3.0;   // 1.0 = normal, 2.5 = 2.5x lipat

  const state = {
    audio: null,
    audioCtx: null,
    analyser: null,
    sourceNode: null,
    gainNode: null,
    waveAnimId: null,
    duration: 0,
    isPlaying: false,
    loop: false,
    ready: false,
    analyserOK: false,
    fallbackTime: 0,
    freqData: null,
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
    audio.volume = 1.0;   // tetap 1.0 — boost via gainNode
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
      updatePlayButton();
      ensureAudioContext();
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

    window.addEventListener("resize", () => {
      resizeCanvas();
      if (!state.isPlaying) drawIdleWave();
    });

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

  /* ---------------------------------------------------------
     AUDIO CONTEXT + ANALYSER + GAIN BOOST
  --------------------------------------------------------- */

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
      const gainNode = ctx.createGain();

      // Setelan akurasi analyser
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.65;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      // Setelan boost volume
      gainNode.gain.value = GAIN_BOOST;

      // Rantai: source → analyser → gainNode → speaker
      source.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Buffer pre-allocated
      state.freqData = new Uint8Array(analyser.frequencyBinCount);

      state.audioCtx = ctx;
      state.analyser = analyser;
      state.sourceNode = source;
      state.gainNode = gainNode;
      state.analyserOK = true;

      console.log("[Music] AudioContext OK — gain:", GAIN_BOOST, "state:", ctx.state);
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

  function envelope(i, total) {
    if (!WAVE_ENVELOPE) return 1;
    const x = (i / (total - 1)) * 2 - 1;
    const bell = Math.cos((x * Math.PI) / 2);
    return Math.pow(Math.max(0, bell), WAVE_ENVELOPE_POWER);
  }

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
            const amp = v * env;
            const barH = Math.max(WAVE_MIN_H, WAVE_MIN_H + amp * (h * 0.92));
            const x = i * (barW + gap);
            const alpha = 0.45 + v * 0.55;
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
