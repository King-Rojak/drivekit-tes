/* ============================================================
   ROJAK DRIVEK1T — Music Player + DIAGNOSTIC MODE
   FIX: tidak autoplay saat halaman load
============================================================ */

(function () {
  "use strict";

  const PLAYLIST_INFO = {
    name: "My Playlist — King Rojak",
    owner: "rojak",
    cover: "./music/playlist-cover.jpeg"
  };

  const PLAYLIST = [
    {
      title: "Teh Hijau",
      artist: "Tulus",
      src: "./music/teh-hijau.mp3"
    },
    {
      title: "Sesi Potret",
      artist: "eńau, Ari Lesmana",
      src: "./music/sesi-potret.mp3"
    },
    {
      title: "Dunia Yang Nanti",
      artist: "Raim Laode",
      src: "./music/dunia-yang-nanti.mp3"
    }
  ];

  const DIAGNOSTIC_MODE = true;

  const state = {
    audio: null,
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
  const ICON_MUSIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;

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

  function logDiag(msg, type) {
    console.log("[Music]", msg);
    if (!DIAGNOSTIC_MODE) return;
    const panel = document.getElementById("rdkMusicDiag");
    if (!panel) return;

    const line = document.createElement("div");
    line.className = "rdk-music-diag-line" + (type ? " rdk-music-diag-" + type : "");
    line.textContent = "› " + msg;
    panel.appendChild(line);
    panel.scrollTop = panel.scrollHeight;
  }

  function buildDiagnostic() {
    if (!DIAGNOSTIC_MODE) return null;
    return el("div", { class: "rdk-music-diag", id: "rdkMusicDiag" });
  }

  function buildPlayer() {
    const section = el("section", {
      class: "rdk-music-section",
      id: "rdkMusicSection"
    });

    const diag = buildDiagnostic();
    if (diag) section.appendChild(diag);

    const playlistCoverWrap = el("div", { class: "rdk-music-playlist-cover" });
    if (PLAYLIST_INFO.cover) {
      const img = el("img", {
        src: PLAYLIST_INFO.cover,
        alt: PLAYLIST_INFO.name
      });
      img.addEventListener("error", () => {
        playlistCoverWrap.innerHTML = ICON_MUSIC;
      });
      img.addEventListener("load", () => {
        logDiag("cover playlist OK", "ok");
      });
      playlistCoverWrap.appendChild(img);
    } else {
      playlistCoverWrap.innerHTML = ICON_MUSIC;
    }

    const playlistMeta = el("div", { class: "rdk-music-playlist-meta" }, [
      el("div", { class: "rdk-music-playlist-name", text: PLAYLIST_INFO.name }),
      el("div", { class: "rdk-music-playlist-owner", text: PLAYLIST_INFO.owner })
    ]);

    const playlistHeader = el("div", {
      class: "rdk-music-playlist-header"
    }, [playlistCoverWrap, playlistMeta]);

    const trackList = el("div", {
      class: "rdk-music-tracklist",
      id: "rdkMusicTrackList"
    });

    const list = el("div", { class: "rdk-music-list" }, [trackList]);

    const barTitle = el("div", {
      class: "rdk-music-nowbar-title",
      id: "rdkMusicBarTitle"
    });

    const prevBtn = el("button", {
      class: "rdk-music-iconbtn", type: "button", id: "rdkMusicPrev",
      title: "Sebelumnya", html: ICON_PREV
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
      title: "Play", html: ICON_PLAY
    });

    const timeEl = el("div", {
      class: "rdk-music-time", id: "rdkMusicTime", text: "-0:00"
    });

    const shuffleBtn = el("button", {
      class: "rdk-music-iconbtn", type: "button", id: "rdkMusicShuffle",
      title: "Acak", html: ICON_SHUFFLE
    });

    const loopBtn = el("button", {
      class: "rdk-music-iconbtn", type: "button", id: "rdkMusicLoop",
      title: "Ulangi", html: ICON_LOOP
    });

    const extras = el("div", { class: "rdk-music-extras" }, [shuffleBtn, loopBtn]);

    const row = el("div", { class: "rdk-music-row" }, [
      prevBtn, progress, playBtn, timeEl, extras
    ]);

    const nowbar = el("div", { class: "rdk-music-nowbar" }, [barTitle, row]);

    section.appendChild(playlistHeader);
    section.appendChild(list);
    section.appendChild(nowbar);

    return section;
  }

  function buildMiniPlayer() {
    const mini = el("div", { class: "rdk-music-mini", id: "rdkMusicMini" });

    const coverWrap = el("div", { class: "rdk-music-mini-cover" });
    if (PLAYLIST_INFO.cover) {
      const img = el("img", { src: PLAYLIST_INFO.cover, alt: "Playlist" });
      img.addEventListener("error", () => {
        coverWrap.innerHTML = ICON_MUSIC;
      });
      coverWrap.appendChild(img);
    } else {
      coverWrap.innerHTML = ICON_MUSIC;
    }

    const title = el("div", {
      class: "rdk-music-mini-title", id: "rdkMusicMiniTitle",
      text: PLAYLIST[0] ? PLAYLIST[0].title : ""
    });

    const artist = el("div", {
      class: "rdk-music-mini-artist", id: "rdkMusicMiniArtist",
      text: PLAYLIST[0] ? PLAYLIST[0].artist : ""
    });

    const meta = el("div", { class: "rdk-music-mini-meta" }, [title, artist]);

    const prevBtn = el("button", {
      class: "rdk-music-mini-btn", type: "button", id: "rdkMusicMiniPrev",
      title: "Sebelumnya", html: ICON_PREV
    });

    const playBtn = el("button", {
      class: "rdk-music-mini-btn rdk-music-mini-play", type: "button", id: "rdkMusicMiniPlay",
      title: "Play", html: ICON_PLAY
    });

    const nextBtn = el("button", {
      class: "rdk-music-mini-btn", type: "button", id: "rdkMusicMiniNext",
      title: "Selanjutnya", html: ICON_NEXT
    });

    const closeBtn = el("button", {
      class: "rdk-music-mini-close", type: "button", id: "rdkMusicMiniClose",
      title: "Sembunyikan", html: "×"
    });

    const controls = el("div", { class: "rdk-music-mini-controls" }, [
      prevBtn, playBtn, nextBtn, closeBtn
    ]);

    mini.appendChild(coverWrap);
    mini.appendChild(meta);
    mini.appendChild(controls);

    return mini;
  }

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

      row.addEventListener("click", () => {
        logDiag("klik track: " + track.title);
        playTrack(i);
      });
      container.appendChild(row);
    });
  }

  function updateNowBar() {
    const track = PLAYLIST[state.currentIndex];
    if (!track) return;

    const barTitle = document.getElementById("rdkMusicBarTitle");
    if (barTitle) {
      barTitle.innerHTML = "";
      barTitle.appendChild(document.createTextNode(track.title + " "));
      const sep = document.createElement("span");
      sep.textContent = "· " + track.artist;
      barTitle.appendChild(sep);
    }

    const miniTitle = document.getElementById("rdkMusicMiniTitle");
    const miniArtist = document.getElementById("rdkMusicMiniArtist");
    if (miniTitle) miniTitle.textContent = track.title;
    if (miniArtist) miniArtist.textContent = track.artist;

    document.querySelectorAll(".rdk-music-track").forEach((row, i) => {
      row.classList.toggle("rdk-music-track-active", i === state.currentIndex);
    });
  }

  async function playTrack(index, autoplay) {
    if (!PLAYLIST[index]) return;
    const track = PLAYLIST[index];
    state.currentIndex = index;

    const audio = state.audio;
    if (!audio) return;

    logDiag("─── playTrack #" + (index + 1) + " ───");
    logDiag("title: " + track.title);
    logDiag("src: " + track.src);
    logDiag("autoplay: " + (autoplay !== false));

    // PAUSE dulu sebelum ganti src — biar tidak autoplay di background
    try { audio.pause(); } catch (e) {}

    audio.src = track.src;
    audio.load();

    audio.muted = false;
    audio.volume = 1.0;
    logDiag("muted: " + audio.muted + ", volume: " + audio.volume);

    updateNowBar();

    // Kalau autoplay === false, jangan play — cukup set src
    if (autoplay === false) {
      logDiag("autoplay=false → skip play()", "warn");
      return;
    }

    try {
      const res = await fetch(track.src, { method: "HEAD" });
      if (res.ok) {
        logDiag("✓ file ditemukan (HTTP " + res.status + ")", "ok");
      } else {
        logDiag("✗ file TIDAK ditemukan (HTTP " + res.status + ")", "error");
        return;
      }
    } catch (err) {
      logDiag("✗ fetch gagal: " + err.message, "error");
    }

    try {
      logDiag("memanggil audio.play()...");
      const p = audio.play();
      if (p && typeof p.then === "function") {
        await p;
        logDiag("✓ play() resolved — audio main", "ok");
      }
    } catch (err) {
      logDiag("✗ play() error: " + err.name, "error");
      logDiag("  message: " + err.message, "error");
    }
  }

  function togglePlay() {
    const audio = state.audio;
    if (!audio) return;

    if (audio.paused) {
      logDiag("togglePlay → play");
      audio.muted = false;
      audio.volume = 1.0;
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(err => {
          logDiag("✗ play error: " + err.name + " - " + err.message, "error");
        });
      }
    } else {
      logDiag("togglePlay → pause");
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
    }

    const miniBtn = document.getElementById("rdkMusicMiniPlay");
    if (miniBtn) {
      miniBtn.innerHTML = icon;
      miniBtn.title = label;
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

  function updateProgressUI() {
    const dur = state.duration || 0;
    const cur = state.currentTime || 0;
    const pct = dur > 0 ? (cur / dur) * 100 : 0;

    const fill = document.getElementById("rdkMusicProgressFill");
    const thumb = document.getElementById("rdkMusicProgressThumb");
    const timeEl = document.getElementById("rdkMusicTime");

    if (fill) fill.style.width = pct + "%";
    if (thumb) thumb.style.left = pct + "%";

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

    logDiag("=== Rojak Music Player start ===");
    logDiag("location: " + location.href);

    const audio = new Audio();
    audio.preload = "none";
    audio.autoplay = false;
    audio.muted = false;
    audio.volume = 1.0;
    state.audio = audio;

    audio.addEventListener("loadstart", () => logDiag("event: loadstart"));
    audio.addEventListener("loadedmetadata", () => {
      state.duration = audio.duration || 0;
      state.ready = true;
      logDiag("event: loadedmetadata — duration: " + state.duration + "s", "ok");
      updateProgressUI();
    });
    audio.addEventListener("canplay", () => logDiag("event: canplay", "ok"));
    audio.addEventListener("playing", () => logDiag("event: playing", "ok"));
    audio.addEventListener("waiting", () => logDiag("event: waiting (buffering)"));
    audio.addEventListener("stalled", () => logDiag("event: stalled", "warn"));

    audio.addEventListener("timeupdate", () => {
      if (state.dragging) return;
      state.currentTime = audio.currentTime;
      updateProgressUI();
    });

    audio.addEventListener("play", () => {
      state.isPlaying = true;
      updatePlayButtons();
      logDiag("event: play — muted: " + audio.muted + ", vol: " + audio.volume, "ok");
    });

    audio.addEventListener("pause", () => {
      state.isPlaying = false;
      updatePlayButtons();
      logDiag("event: pause");
    });

    audio.addEventListener("volumechange", () => {
      logDiag("event: volumechange — vol: " + audio.volume + ", muted: " + audio.muted);
    });

    audio.addEventListener("ended", () => {
      logDiag("event: ended");
      if (state.loop) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        nextTrack();
      }
    });

    audio.addEventListener("error", () => {
      const err = audio.error;
      let code = "?";
      let msg = "?";
      if (err) {
        code = err.code;
        msg = err.message || "(no message)";
      }
      logDiag("✗ event: error — code: " + code + " msg: " + msg, "error");
    });

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

    const miniPlay = document.getElementById("rdkMusicMiniPlay");
    if (miniPlay) miniPlay.addEventListener("click", e => { e.stopPropagation(); togglePlay(); });

    const miniPrev = document.getElementById("rdkMusicMiniPrev");
    if (miniPrev) miniPrev.addEventListener("click", e => { e.stopPropagation(); prevTrack(); });

    const miniNext = document.getElementById("rdkMusicMiniNext");
    if (miniNext) miniNext.addEventListener("click", e => { e.stopPropagation(); nextTrack(); });

    const miniClose = document.getElementById("rdkMusicMiniClose");
    if (miniClose) miniClose.addEventListener("click", e => {
      e.stopPropagation();
      state.miniDismissed = true;
      closeMini();
    });

    mini.addEventListener("click", e => {
      if (e.target.closest("button")) return;
      scrollToMainPlayer();
    });

    setupProgressDrag();
    setupMiniVisibility();
    renderTrackList();
    updateNowBar();

    // Pastikan tidak autoplay
    try { audio.pause(); } catch (e) {}
    logDiag("mount selesai — audio pause");
  }

  function init() {
    if (document.getElementById("rdkMusicSection")) return;
    if (PLAYLIST.length === 0) return;
    mount();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
