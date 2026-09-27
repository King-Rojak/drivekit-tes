/* ============================================================
   ROJAK DRIVEK1T — Music Player (Spotify-style)
   Playlist + Play/Pause bulat putih + progress dengan sisa waktu.
   Tidak ada volume UI, tidak ada lirik.
============================================================ */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     🎵 PLAYLIST — TAMBAH LAGU DI SINI
  --------------------------------------------------------- */

  const PLAYLIST = [
  {
    title: "Teh Hijau",
    artist: "Tulus",
    src: "./music/teh-hijau.mp3",
    cover: "./music/teh-hijau.jpeg"
  },
  {
    title: "Sesi Potret",
    artist: "eńau, Ari Lesmana",
    src: "./music/sesi-potret.mp3",
    cover: "./music/sesi-potret.jpeg"
  },
  {
    title: "Dunia Yang Nanti",
    artist: "Raim Laode",
    src: "./music/dunia-yang-nanti.mp3",
    cover: "./music/iqro.jpeg"
  }
];

  const GAIN_BOOST = 1.0; // 1.0 = normal, 2.5 = boost

  const state = {
    audio: null,
    audioCtx: null,
    gainNode: null,
    currentIndex: 0,
    duration: 0,
    currentTime: 0,
    isPlaying: false,
    loop: false,
    shuffle: false,
    dragging: false,
    ready: false,
    miniOpen: false,
    miniDismissed: false,
    durationCache: {}
  };

  const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;
  const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
  const ICON_PREV = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="19 20 9 12 19 4 19 20"/><rect x="5" y="4" width="2" height="16"/></svg>`;
  const ICON_NEXT = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 4 15 12 5 20 5 4"/><rect x="17" y="4" width="2" height="16"/></svg>`;
  const ICON_SHUFFLE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>`;
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

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" + s : s);
  }

  /* ---------------------------------------------------------
     BUILD MAIN PLAYER
  --------------------------------------------------------- */

  function buildPlayer() {
    const section = el("section", {
      class: "rdk-music-section",
      id: "rdkMusicSection"
    });

    const label = el("div", {
      class: "rdk-music-label",
      text: "My Playlist — King Rojak"
    });

    const trackList = el("div", {
      class: "rdk-music-tracklist",
      id: "rdkMusicTrackList"
    });

    const list = el("div", { class: "rdk-music-list" }, [trackList]);

    /* NOW BAR */
    const nowTitle = el("div", {
      class: "rdk-music-nowbar-title",
      id: "rdkMusicNowTitle"
    });

    /* Row: prev | progress | play | time | extras */
    const prevBtn = el("button", {
      class: "rdk-music-iconbtn", type: "button", id: "rdkMusicPrev",
      title: "Sebelumnya", "aria-label": "Sebelumnya", html: ICON_PREV
    });

    const progressTrack = el("div", { class: "rdk-music-progress-track" }, [
      el("div", { class: "rdk-music-progress-fill", id: "rdkMusicProgressFill" })
    ]);

    const progressThumb = el("div", {
      class: "rdk-music-progress-thumb",
      id: "rdkMusicProgressThumb"
    });

    const progress = el("div", {
      class: "rdk-music-progress",
      id: "rdkMusicProgress"
    }, [progressTrack, progressThumb]);

    const playBtn = el("button", {
      class: "rdk-music-play", type: "button", id: "rdkMusicPlay",
      title: "Play", "aria-label": "Play", html: ICON_PLAY
    });

    // Waktu sisa (minus)
    const timeEl = el("div", {
      class: "rdk-music-time",
      id: "rdkMusicTime",
      text: "-0:00"
    });

    const shuffleBtn = el("button", {
      class: "rdk-music-iconbtn", type: "button", id: "rdkMusicShuffle",
      title: "Acak", "aria-label": "Acak", html: ICON_SHUFFLE
    });

    const loopBtn = el("button", {
      class: "rdk-music-iconbtn", type: "button", id: "rdkMusicLoop",
      title: "Ulangi", "aria-label": "Ulangi", html: ICON_LOOP
    });

    const extras = el("div", { class: "rdk-music-extras" }, [shuffleBtn, loopBtn]);

    const row = el("div", { class: "rdk-music-row" }, [
      prevBtn,
      progress,
      playBtn,
      timeEl,
      extras
    ]);

    const nowbar = el("div", { class: "rdk-music-nowbar" }, [nowTitle, row]);

    section.appendChild(label);
    section.appendChild(list);
    section.appendChild(nowbar);

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

    const title = el("div", {
      class: "rdk-music-mini-title",
      id: "rdkMusicMiniTitle",
      text: PLAYLIST[0] ? PLAYLIST[0].title : ""
    });

    const artist = el("div", {
      class: "rdk-music-mini-artist",
      id: "rdkMusicMiniArtist",
      text: PLAYLIST[0] ? PLAYLIST[0].artist : ""
    });

    const meta = el("div", { class: "rdk-music-mini-meta" }, [title, artist]);

    const prevBtn = el("button", {
      class: "rdk-music-mini-btn", type: "button", id: "rdkMusicMiniPrev",
      title: "Sebelumnya", "aria-label": "Sebelumnya", html: ICON_PREV
    });

    const playBtn = el("button", {
      class: "rdk-music-mini-btn rdk-music-mini-play", type: "button", id: "rdkMusicMiniPlay",
      title: "Play", "aria-label": "Play", html: ICON_PLAY
    });

    const nextBtn = el("button", {
      class: "rdk-music-mini-btn", type: "button", id: "rdkMusicMiniNext",
      title: "Selanjutnya", "aria-label": "Selanjutnya", html: ICON_NEXT
    });

    const closeBtn = el("button", {
      class: "rdk-music-mini-close", type: "button", id: "rdkMusicMiniClose",
      title: "Sembunyikan", "aria-label": "Sembunyikan", html: "×"
    });

    const controls = el("div", { class: "rdk-music-mini-controls" }, [
      prevBtn, playBtn, nextBtn, closeBtn
    ]);

    mini.appendChild(meta);
    mini.appendChild(controls);

    return mini;
  }

  /* ---------------------------------------------------------
     RENDER PLAYLIST
  --------------------------------------------------------- */

  function renderTrackList() {
    const container = document.getElementById("rdkMusicTrackList");
    if (!container) return;

    container.innerHTML = "";

    PLAYLIST.forEach((track, i) => {
      const isActive = i === state.currentIndex;

      const numEl = el("div", {
        class: "rdk-music-track-num",
        text: String(i + 1)
      });

      const eqEl = el("div", { class: "rdk-music-eq" }, [
        el("span"), el("span"), el("span"), el("span")
      ]);

      const info = el("div", { class: "rdk-music-track-info" }, [
        el("div", { class: "rdk-music-track-title", text: track.title }),
        el("div", { class: "rdk-music-track-artist", text: track.artist })
      ]);

      const row = el("div", {
        class: "rdk-music-track" + (isActive ? " rdk-music-track-active" : ""),
        "data-index": String(i)
      }, [numEl, eqEl, info]);

      row.addEventListener("click", () => playTrack(i));
      container.appendChild(row);
    });
  }

  /* ---------------------------------------------------------
     NOW BAR UPDATE
  --------------------------------------------------------- */

  function updateNowBar() {
    const track = PLAYLIST[state.currentIndex];
    if (!track) return;

    const nowTitle = document.getElementById("rdkMusicNowTitle");
    if (nowTitle) {
      nowTitle.innerHTML = "";
      nowTitle.appendChild(document.createTextNode(track.title + " "));
      const sep = document.createElement("span");
      sep.textContent = "· " + track.artist;
      nowTitle.appendChild(sep);
    }

    const miniTitle = document.getElementById("rdkMusicMiniTitle");
    const miniArtist = document.getElementById("rdkMusicMiniArtist");
    if (miniTitle) miniTitle.textContent = track.title;
    if (miniArtist) miniArtist.textContent = track.artist;

    document.querySelectorAll(".rdk-music-track").forEach((row, i) => {
      row.classList.toggle("rdk-music-track-active", i === state.currentIndex);
    });
  }

  /* ---------------------------------------------------------
     PLAY TRACK
  --------------------------------------------------------- */

  function playTrack(index, autoplay) {
    if (!PLAYLIST[index]) return;
    const track = PLAYLIST[index];
    state.currentIndex = index;

    const audio = state.audio;
    if (!audio) return;

    audio.src = track.src;
    audio.load();

    updateNowBar();

    if (autoplay !== false) {
      ensureAudioContext();
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(err => console.error("[Music] Play error:", err));
      }
    }

    state.currentTime = 0;
    state.duration = state.durationCache[track.src] || 0;
    updateProgressUI();
  }

  /* ---------------------------------------------------------
     PLAY / PAUSE
  --------------------------------------------------------- */

  function togglePlay() {
    const audio = state.audio;
    if (!audio) return;
    if (audio.paused) {
      ensureAudioContext();
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(err => console.error("[Music] Play error:", err));
      }
    } else {
      audio.pause();
    }
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

    const section = document.getElementById("rdkMusicSection");
    if (section) section.classList.toggle("rdk-music-paused", !state.isPlaying);
  }

  function nextTrack() {
    if (PLAYLIST.length === 0) return;
    let nextIndex;
    if (state.shuffle && PLAYLIST.length > 1) {
      do { nextIndex = Math.floor(Math.random() * PLAYLIST.length); }
      while (nextIndex === state.currentIndex);
    } else {
      nextIndex = (state.currentIndex + 1) % PLAYLIST.length;
    }
    playTrack(nextIndex);
  }

  function prevTrack() {
    if (PLAYLIST.length === 0) return;
    const audio = state.audio;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    let prevIndex;
    if (state.shuffle && PLAYLIST.length > 1) {
      do { prevIndex = Math.floor(Math.random() * PLAYLIST.length); }
      while (prevIndex === state.currentIndex);
    } else {
      prevIndex = (state.currentIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
    }
    playTrack(prevIndex);
  }

  /* ---------------------------------------------------------
     PROGRESS (dengan waktu sisa, gaya Spotify)
  --------------------------------------------------------- */

  function updateProgressUI() {
    const dur = state.duration || 0;
    const cur = state.currentTime || 0;
    const pct = dur > 0 ? (cur / dur) * 100 : 0;

    const fill = document.getElementById("rdkMusicProgressFill");
    const thumb = document.getElementById("rdkMusicProgressThumb");
    const timeEl = document.getElementById("rdkMusicTime");

    if (fill) fill.style.width = pct + "%";
    if (thumb) thumb.style.left = pct + "%";

    // Waktu sisa (gaya Spotify: -0:03)
    if (timeEl) {
      const remain = Math.max(0, dur - cur);
      timeEl.textContent = "-" + formatTime(remain);
    }
  }

  function setupProgressDrag() {
    const bar = document.getElementById("rdkMusicProgress");
    if (!bar) return;

    function seekFromEvent(e) {
      const rect = bar.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const dur = state.duration || 0;
      if (dur > 0) {
        state.currentTime = pct * dur;
        updateProgressUI();
        return state.currentTime;
      }
      return null;
    }

    function startDrag(e) {
      if (!state.ready && state.duration === 0) return;
      state.dragging = true;
      bar.classList.add("rdk-music-dragging");
      seekFromEvent(e);
      e.preventDefault();
    }

    function moveDrag(e) {
      if (!state.dragging) return;
      seekFromEvent(e);
      e.preventDefault();
    }

    function endDrag(e) {
      if (!state.dragging) return;
      state.dragging = false;
      bar.classList.remove("rdk-music-dragging");
      const t = seekFromEvent(e);
      if (t !== null && state.audio) {
        state.audio.currentTime = t;
      }
    }

    bar.addEventListener("mousedown", startDrag);
    document.addEventListener("mousemove", moveDrag);
    document.addEventListener("mouseup", endDrag);
    bar.addEventListener("touchstart", startDrag, { passive: false });
    document.addEventListener("touchmove", moveDrag, { passive: false });
    document.addEventListener("touchend", endDrag);
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
      const gainNode = ctx.createGain();
      gainNode.gain.value = GAIN_BOOST;

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      state.audioCtx = ctx;
      state.sourceNode = source;
      state.gainNode = gainNode;
    } catch (err) {
      console.error("[Music] AudioContext error:", err);
    }
  }

  /* ---------------------------------------------------------
     MINI VISIBILITY
  --------------------------------------------------------- */

  function setupMiniVisibility() {
    const section = document.getElementById("rdkMusicSection");
    if (!section) return;

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (state.miniDismissed) return;
            if (!entry.isIntersecting) openMini();
            else closeMini();
          }
        },
        { threshold: 0.2 }
      );
      observer.observe(section);
    } else {
      window.addEventListener("scroll", () => {
        if (state.miniDismissed) return;
        const rect = section.getBoundingClientRect();
        const visible = rect.bottom > 80 && rect.top < window.innerHeight - 80;
        visible ? closeMini() : openMini();
      }, { passive: true });
    }
  }

  function openMini() {
    const mini = document.getElementById("rdkMusicMini");
    if (!mini || state.miniOpen) return;
    state.miniOpen = true;
    mini.classList.add("rdk-music-mini-open");
  }

  function closeMini() {
    const mini = document.getElementById("rdkMusicMini");
    if (!mini || !state.miniOpen) return;
    state.miniOpen = false;
    mini.classList.remove("rdk-music-mini-open");
  }

  function scrollToMainPlayer() {
    const section = document.getElementById("rdkMusicSection");
    if (!section) return;
    state.miniDismissed = false;
    section.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ---------------------------------------------------------
     MOUNT
  --------------------------------------------------------- */

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

    const mini = buildMiniPlayer();
    document.body.appendChild(mini);

    /* AUDIO */
    const audio = new Audio();
    audio.preload = "metadata";
    if (PLAYLIST[0]) audio.src = PLAYLIST[0].src;
    state.audio = audio;

    audio.addEventListener("loadedmetadata", () => {
      state.duration = audio.duration || 0;
      state.ready = true;

      const track = PLAYLIST[state.currentIndex];
      if (track) state.durationCache[track.src] = state.duration;

      updateProgressUI();
    });

    audio.addEventListener("timeupdate", () => {
      if (state.dragging) return;
      state.currentTime = audio.currentTime;
      updateProgressUI();
    });

    audio.addEventListener("play", () => {
      state.isPlaying = true;
      updatePlayButtons();
    });

    audio.addEventListener("pause", () => {
      state.isPlaying = false;
      updatePlayButtons();
    });

    audio.addEventListener("ended", () => {
      if (state.loop) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        nextTrack();
      }
    });

    audio.addEventListener("error", () => {
      console.error("[Music] Gagal load:", audio.src);
    });

    /* MAIN BUTTONS */
    const playBtn = document.getElementById("rdkMusicPlay");
    if (playBtn) playBtn.addEventListener("click", togglePlay);

    const prevBtn = document.getElementById("rdkMusicPrev");
    if (prevBtn) prevBtn.addEventListener("click", prevTrack);

    const shuffleBtn = document.getElementById("rdkMusicShuffle");
    if (shuffleBtn) {
      shuffleBtn.addEventListener("click", () => {
        state.shuffle = !state.shuffle;
        shuffleBtn.classList.toggle("rdk-music-ctrl-active", state.shuffle);
      });
    }

    const loopBtn = document.getElementById("rdkMusicLoop");
    if (loopBtn) {
      loopBtn.addEventListener("click", () => {
        state.loop = !state.loop;
        audio.loop = state.loop;
        loopBtn.classList.toggle("rdk-music-ctrl-active", state.loop);
      });
    }

    /* MINI BUTTONS */
    const miniPlay = document.getElementById("rdkMusicMiniPlay");
    if (miniPlay) {
      miniPlay.addEventListener("click", e => {
        e.stopPropagation();
        togglePlay();
      });
    }

    const miniPrev = document.getElementById("rdkMusicMiniPrev");
    if (miniPrev) {
      miniPrev.addEventListener("click", e => {
        e.stopPropagation();
        prevTrack();
      });
    }

    const miniNext = document.getElementById("rdkMusicMiniNext");
    if (miniNext) {
      miniNext.addEventListener("click", e => {
        e.stopPropagation();
        nextTrack();
      });
    }

    const miniClose = document.getElementById("rdkMusicMiniClose");
    if (miniClose) {
      miniClose.addEventListener("click", e => {
        e.stopPropagation();
        state.miniDismissed = true;
        closeMini();
      });
    }

    mini.addEventListener("click", e => {
      if (e.target.closest("button")) return;
      scrollToMainPlayer();
    });

    /* SETUP */
    setupProgressDrag();
    setupMiniVisibility();
    renderTrackList();
    updateNowBar();

    // Preload durasi lagu lain
    PLAYLIST.forEach((track, i) => {
      if (i === state.currentIndex) return;
      const probe = document.createElement("audio");
      probe.preload = "metadata";
      probe.src = track.src;
      probe.addEventListener("loadedmetadata", () => {
        state.durationCache[track.src] = probe.duration;
      });
    });

    if (PLAYLIST[0]) playTrack(0, false);
  }

  /* ---------------------------------------------------------
     INIT
  --------------------------------------------------------- */

  function init() {
    if (document.getElementById("rdkMusicSection")) return;
    if (PLAYLIST.length === 0) {
      console.warn("[Music] Playlist kosong.");
      return;
    }
    mount();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();