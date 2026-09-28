/* ============================================================
   ROJAK DRIVEK1T — Music Player
   Vanilla DOM. No framework. Konsisten dengan rojak-ai.js.
   Fitur: playlist, mini player, media session, persist state.
============================================================ */

(function () {
  "use strict";

  /* ---------- CONFIG ---------- */

  const CONFIG = {
    PLAYLIST_URL: "./music/playlist.json",
    DEFAULT_COVER: "./music/playlist-cover.jpeg",
    PLAYLIST_NAME: "Rojak DriveK1t Playlist",
    PLAYLIST_OWNER: "KING ROJAK",
    STORAGE_KEY: "rdk_music_state_v1",
    VOLUME_DEFAULT: 0.8,
    SEEK_STEP: 5,
    MINI_PLAYER_THRESHOLD: 320
  };

  /* ---------- STATE ---------- */

  const state = {
    playlist: [],
    currentIndex: -1,
    isPlaying: false,
    isShuffle: false,
    repeatMode: "off", // "off" | "all" | "one"
    volume: CONFIG.VOLUME_DEFAULT,
    muted: false,
    duration: 0,
    currentTime: 0,
    dragging: false,
    miniPlayerOpen: false,
    lastScrollY: 0
  };

  /* ---------- AUDIO ---------- */

  const audio = new Audio();
  audio.preload = "metadata";
  audio.crossOrigin = "anonymous";

  /* ---------- DOM REFS (di-set saat build) ---------- */

  let refs = {};

  /* ---------- ICONS ---------- */

  const ICON = {
    music: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
    prev: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20" fill="currentColor"/><line x1="5" y1="19" x2="5" y2="5"/></svg>`,
    next: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4" fill="currentColor"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`,
    shuffle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>`,
    repeat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
    repeatOne: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="12" y="15" font-size="7" font-weight="800" fill="currentColor" stroke="none" text-anchor="middle">1</text></svg>`,
    volume: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
    volumeMute: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
  };

  /* ---------- HELPERS ---------- */

  function $(id) { return document.getElementById(id); }

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

  function formatTime(seconds) {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function escapeHTML(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* ---------- STORAGE ---------- */

  function saveState() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({
        currentIndex: state.currentIndex,
        volume: state.volume,
        muted: state.muted,
        isShuffle: state.isShuffle,
        repeatMode: state.repeatMode
      }));
    } catch (_) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.volume === "number") state.volume = parsed.volume;
      if (typeof parsed.muted === "boolean") state.muted = parsed.muted;
      if (typeof parsed.isShuffle === "boolean") state.isShuffle = parsed.isShuffle;
      if (parsed.repeatMode === "off" || parsed.repeatMode === "all" || parsed.repeatMode === "one") {
        state.repeatMode = parsed.repeatMode;
      }
      if (typeof parsed.currentIndex === "number") state.currentIndex = parsed.currentIndex;
    } catch (_) {}
  }

  /* ---------- PLAYLIST LOAD ---------- */

  async function loadPlaylist() {
    try {
      const res = await fetch(CONFIG.PLAYLIST_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Playlist bukan array");

      state.playlist = data
        .filter(t => t && typeof t.src === "string" && t.src.length > 0)
        .map(t => ({
          title: t.title || "Untitled",
          artist: t.artist || "Unknown",
          src: t.src,
          cover: t.cover || CONFIG.DEFAULT_COVER
        }));

      return state.playlist.length > 0;
    } catch (err) {
      console.warn("[RDK Music] Gagal load playlist:", err);
      return false;
    }
  }

  /* ---------- BUILD UI ---------- */

  function buildSection() {
    const section = el("section", {
      class: "rdk-music-section",
      id: "rdkMusicSection"
    });

    // Header
    const header = el("div", { class: "rdk-music-playlist-header" });

    const cover = el("div", { class: "rdk-music-playlist-cover" }, [
      el("img", {
        id: "rdkMusicPlaylistCover",
        src: CONFIG.DEFAULT_COVER,
        alt: "Playlist Cover",
        onerror: function () { this.style.display = "none"; }
      })
    ]);

    const meta = el("div", { class: "rdk-music-playlist-meta" }, [
      el("div", { class: "rdk-music-playlist-name", text: CONFIG.PLAYLIST_NAME }),
      el("div", { class: "rdk-music-playlist-owner", text: "By " + CONFIG.PLAYLIST_OWNER })
    ]);

    header.appendChild(cover);
    header.appendChild(meta);

    // List
    const list = el("div", { class: "rdk-music-list", id: "rdkMusicList" });

    // Now bar
    const nowbar = el("div", { class: "rdk-music-nowbar" });

    const nowbarTitle = el("div", {
      class: "rdk-music-nowbar-title",
      id: "rdkMusicNowTitle"
    }, [
      el("span", { text: "Pilih lagu untuk mulai" })
    ]);

    const row = el("div", { class: "rdk-music-row" });

    // Play/pause button (kiri)
    const playBtn = el("button", {
      class: "rdk-music-play",
      id: "rdkMusicPlay",
      type: "button",
      title: "Play / Pause",
      "aria-label": "Play",
      html: ICON.play
    });

    // Progress
    const progress = el("div", {
      class: "rdk-music-progress",
      id: "rdkMusicProgress",
      role: "slider",
      "aria-label": "Seek"
    }, [
      el("div", { class: "rdk-music-progress-track" }, [
        el("div", { class: "rdk-music-progress-fill", id: "rdkMusicProgressFill" })
      ]),
      el("div", { class: "rdk-music-progress-thumb", id: "rdkMusicProgressThumb" })
    ]);

    // Time
    const time = el("div", {
      class: "rdk-music-time",
      id: "rdkMusicTime",
      text: "0:00"
    });

    // Extras
    const extras = el("div", { class: "rdk-music-extras" }, [
      el("button", {
        class: "rdk-music-iconbtn",
        id: "rdkMusicShuffle",
        type: "button",
        title: "Shuffle",
        "aria-label": "Shuffle",
        html: ICON.shuffle
      }),
      el("button", {
        class: "rdk-music-iconbtn",
        id: "rdkMusicRepeat",
        type: "button",
        title: "Repeat",
        "aria-label": "Repeat",
        html: ICON.repeat
      }),
      el("button", {
        class: "rdk-music-iconbtn",
        id: "rdkMusicVolume",
        type: "button",
        title: "Mute",
        "aria-label": "Mute",
        html: ICON.volume
      })
    ]);

    // Prev/next: taruh di kiri play button juga untuk mobile
    const prevBtn = el("button", {
      class: "rdk-music-iconbtn",
      id: "rdkMusicPrev",
      type: "button",
      title: "Sebelumnya",
      "aria-label": "Sebelumnya",
      html: ICON.prev
    });

    const nextBtn = el("button", {
      class: "rdk-music-iconbtn",
      id: "rdkMusicNext",
      type: "button",
      title: "Berikutnya",
      "aria-label": "Berikutnya",
      html: ICON.next
    });

    row.appendChild(prevBtn);
    row.appendChild(playBtn);
    row.appendChild(nextBtn);
    row.appendChild(progress);
    row.appendChild(time);
    row.appendChild(extras);

    nowbar.appendChild(nowbarTitle);
    nowbar.appendChild(row);

    section.appendChild(header);
    section.appendChild(list);
    section.appendChild(nowbar);

    return section;
  }

  function buildMiniPlayer() {
    const mini = el("div", {
      class: "rdk-music-mini",
      id: "rdkMusicMini"
    });

    const cover = el("div", { class: "rdk-music-mini-cover" }, [
      el("img", {
        id: "rdkMusicMiniCover",
        src: CONFIG.DEFAULT_COVER,
        alt: "Cover",
        onerror: function () { this.style.display = "none"; }
      })
    ]);

    const meta = el("div", { class: "rdk-music-mini-meta" }, [
      el("div", {
        class: "rdk-music-mini-title",
        id: "rdkMusicMiniTitle",
        text: "Belum ada lagu"
      }),
      el("div", {
        class: "rdk-music-mini-artist",
        id: "rdkMusicMiniArtist",
        text: "—"
      })
    ]);

    const controls = el("div", { class: "rdk-music-mini-controls" }, [
      el("button", {
        class: "rdk-music-mini-btn",
        id: "rdkMusicMiniPrev",
        type: "button",
        "aria-label": "Sebelumnya",
        html: ICON.prev
      }),
      el("button", {
        class: "rdk-music-mini-btn rdk-music-mini-play",
        id: "rdkMusicMiniPlay",
        type: "button",
        "aria-label": "Play / Pause",
        html: ICON.play
      }),
      el("button", {
        class: "rdk-music-mini-btn",
        id: "rdkMusicMiniNext",
        type: "button",
        "aria-label": "Berikutnya",
        html: ICON.next
      })
    ]);

    const closeBtn = el("button", {
      class: "rdk-music-mini-close",
      id: "rdkMusicMiniClose",
      type: "button",
      "aria-label": "Tutup mini player",
      text: "×"
    });

    mini.appendChild(cover);
    mini.appendChild(meta);
    mini.appendChild(controls);
    mini.appendChild(closeBtn);

    return mini;
  }

  /* ---------- RENDER PLAYLIST ---------- */

  function renderPlaylist() {
    if (!refs.list) return;

    if (!state.playlist.length) {
      refs.list.innerHTML = '<div style="padding:20px;text-align:center;color:#8a8a8a;font-size:10px;">Playlist kosong.</div>';
      return;
    }

    refs.list.innerHTML = state.playlist.map((track, i) => {
      const active = i === state.currentIndex;
      return `
        <div class="rdk-music-track${active ? " rdk-music-track-active" : ""}" data-index="${i}">
          <div class="rdk-music-track-num">${i + 1}</div>
          <div class="rdk-music-eq">
            <span></span><span></span><span></span><span></span>
          </div>
          <div class="rdk-music-track-info">
            <div class="rdk-music-track-title">${escapeHTML(track.title)}</div>
            <div class="rdk-music-track-artist">${escapeHTML(track.artist)}</div>
          </div>
        </div>
      `;
    }).join("");

    refs.list.querySelectorAll(".rdk-music-track").forEach(trackEl => {
      trackEl.addEventListener("click", () => {
        const idx = Number(trackEl.dataset.index);
        if (idx === state.currentIndex) {
          togglePlay();
        } else {
          playTrack(idx);
        }
      });
    });
  }

  /* ---------- PLAYBACK ---------- */

  function playTrack(index, autoplay) {
    if (!state.playlist.length) return;
    if (index < 0 || index >= state.playlist.length) return;

    if (autoplay === undefined) autoplay = true;

    const track = state.playlist[index];
    state.currentIndex = index;
    audio.src = track.src;
    audio.load();

    updateNowPlaying(track);
    updateMiniPlayer(track);
    renderPlaylist();
    saveState();

    if (autoplay) {
      audio.play().catch(err => {
        console.warn("[RDK Music] Play gagal:", err);
        state.isPlaying = false;
        updatePlayButtons();
      });
    }
  }

  function togglePlay() {
    if (state.currentIndex === -1) {
      // Belum pilih lagu, play lagu pertama
      if (state.playlist.length) {
        playTrack(0);
      }
      return;
    }

    if (state.isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(err => {
        console.warn("[RDK Music] Play gagal:", err);
      });
    }
  }

  function playNext(auto) {
    if (!state.playlist.length) return;

    if (state.isShuffle) {
      let next = Math.floor(Math.random() * state.playlist.length);
      if (state.playlist.length > 1 && next === state.currentIndex) {
        next = (next + 1) % state.playlist.length;
      }
      playTrack(next);
      return;
    }

    let next = state.currentIndex + 1;
    if (next >= state.playlist.length) {
      if (state.repeatMode === "all" || !auto) {
        next = 0;
      } else {
        // Habis, stop
        state.isPlaying = false;
        audio.pause();
        updatePlayButtons();
        return;
      }
    }
    playTrack(next);
  }

  function playPrev() {
    if (!state.playlist.length) return;

    // Kalau sudah lewat 3 detik, ulang lagu ini dulu
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    let prev = state.currentIndex - 1;
    if (prev < 0) prev = state.playlist.length - 1;
    playTrack(prev);
  }

  /* ---------- UI UPDATE ---------- */

  function updateNowPlaying(track) {
    if (refs.nowTitle) {
      refs.nowTitle.innerHTML =
        escapeHTML(track.title) +
        ' <span>— ' + escapeHTML(track.artist) + '</span>';
    }
  }

  function updateMiniPlayer(track) {
    if (refs.miniTitle) refs.miniTitle.textContent = track.title;
    if (refs.miniArtist) refs.miniArtist.textContent = track.artist;
    if (refs.miniCover && track.cover) {
      refs.miniCover.src = track.cover;
      refs.miniCover.style.display = "";
    }
  }

  function updatePlayButtons() {
    const icon = state.isPlaying ? ICON.pause : ICON.play;
    if (refs.play) refs.play.innerHTML = icon;
    if (refs.miniPlay) refs.miniPlay.innerHTML = icon;
  }

  function updateProgress() {
    if (state.dragging) return;

    const t = audio.currentTime || 0;
    const d = audio.duration || 0;
    state.currentTime = t;
    state.duration = d;

    const pct = d > 0 ? (t / d) * 100 : 0;

    if (refs.progressFill) refs.progressFill.style.width = pct + "%";
    if (refs.progressThumb) refs.progressThumb.style.left = pct + "%";
    if (refs.time) refs.time.textContent = formatTime(t);
  }

  function updateVolumeUI() {
    if (refs.volume) {
      refs.volume.innerHTML = (state.muted || state.volume === 0) ? ICON.volumeMute : ICON.volume;
      refs.volume.classList.toggle("rdk-music-ctrl-active", state.muted);
    }
  }

  function updateShuffleUI() {
    if (refs.shuffle) {
      refs.shuffle.classList.toggle("rdk-music-ctrl-active", state.isShuffle);
    }
  }

  function updateRepeatUI() {
    if (refs.repeat) {
      refs.repeat.classList.toggle("rdk-music-ctrl-active", state.repeatMode !== "off");
      refs.repeat.innerHTML = state.repeatMode === "one" ? ICON.repeatOne : ICON.repeat;
    }
  }

  /* ---------- PROGRESS DRAG ---------- */

  function setupProgressDrag() {
    const progress = refs.progress;
    if (!progress) return;

    let rect = null;

    function getPct(e) {
      if (!rect) rect = progress.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      return Math.max(0, Math.min(1, x / rect.width));
    }

    function seekTo(pct) {
      if (isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = pct * audio.duration;
        if (refs.progressFill) refs.progressFill.style.width = (pct * 100) + "%";
        if (refs.progressThumb) refs.progressThumb.style.left = (pct * 100) + "%";
        if (refs.time) refs.time.textContent = formatTime(pct * audio.duration);
      }
    }

    function onDown(e) {
      state.dragging = true;
      rect = progress.getBoundingClientRect();
      progress.classList.add("rdk-music-dragging");
      seekTo(getPct(e));
      e.preventDefault();
    }

    function onMove(e) {
      if (!state.dragging) return;
      seekTo(getPct(e));
    }

    function onUp() {
      if (!state.dragging) return;
      state.dragging = false;
      progress.classList.remove("rdk-music-dragging");
    }

    progress.addEventListener("pointerdown", onDown);
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  /* ---------- MINI PLAYER VISIBILITY ---------- */

  function updateMiniPlayerVisibility() {
    if (!refs.mini || !refs.section) return;

    const sectionRect = refs.section.getBoundingClientRect();
    const mini = refs.mini;
    const isHiddenByUser = mini.dataset.hiddenByUser === "1";

    if (isHiddenByUser) {
      mini.classList.remove("rdk-music-mini-open");
      state.miniPlayerOpen = false;
      return;
    }

    // Tampilkan mini player kalau section-nya tidak kelihatan dan ada lagu aktif
    const shouldShow =
      state.currentIndex !== -1 &&
      (sectionRect.bottom < CONFIG.MINI_PLAYER_THRESHOLD);

    if (shouldShow && !state.miniPlayerOpen) {
      mini.classList.add("rdk-music-mini-open");
      state.miniPlayerOpen = true;
    } else if (!shouldShow && state.miniPlayerOpen) {
      mini.classList.remove("rdk-music-mini-open");
      state.miniPlayerOpen = false;
    }
  }

  /* ---------- MEDIA SESSION ---------- */

  function setupMediaSession() {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => togglePlay());
    navigator.mediaSession.setActionHandler("pause", () => togglePlay());
    navigator.mediaSession.setActionHandler("previoustrack", () => playPrev());
    navigator.mediaSession.setActionHandler("nexttrack", () => playNext());
    navigator.mediaSession.setActionHandler("seekbackward", () => {
      audio.currentTime = Math.max(0, audio.currentTime - CONFIG.SEEK_STEP);
    });
    navigator.mediaSession.setActionHandler("seekforward", () => {
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + CONFIG.SEEK_STEP);
    });
  }

  function updateMediaSessionMetadata(track) {
    if (!("mediaSession" in navigator) || !window.MediaMetadata) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: CONFIG.PLAYLIST_NAME,
        artwork: [
          { src: track.cover, sizes: "512x512", type: "image/jpeg" }
        ]
      });
    } catch (_) {}
  }

  function updateMediaSessionState() {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = state.isPlaying ? "playing" : "paused";
  }

  /* ---------- EVENT BINDING ---------- */

  function bindEvents() {

    // Play / Pause
    if (refs.play) refs.play.addEventListener("click", togglePlay);
    if (refs.miniPlay) refs.miniPlay.addEventListener("click", togglePlay);

    // Prev / Next
    if (refs.prev) refs.prev.addEventListener("click", playPrev);
    if (refs.next) refs.next.addEventListener("click", () => playNext(false));
    if (refs.miniPrev) refs.miniPrev.addEventListener("click", playPrev);
    if (refs.miniNext) refs.miniNext.addEventListener("click", () => playNext(false));

    // Shuffle
    if (refs.shuffle) {
      refs.shuffle.addEventListener("click", () => {
        state.isShuffle = !state.isShuffle;
        updateShuffleUI();
        saveState();
      });
    }

    // Repeat: off → all → one → off
    if (refs.repeat) {
      refs.repeat.addEventListener("click", () => {
        if (state.repeatMode === "off") state.repeatMode = "all";
        else if (state.repeatMode === "all") state.repeatMode = "one";
        else state.repeatMode = "off";
        updateRepeatUI();
        saveState();
      });
    }

    // Volume toggle (mute)
    if (refs.volume) {
      refs.volume.addEventListener("click", () => {
        state.muted = !state.muted;
        audio.muted = state.muted;
        updateVolumeUI();
        saveState();
      });
    }

    // Mini close
    if (refs.miniClose) {
      refs.miniClose.addEventListener("click", () => {
        if (refs.mini) {
          refs.mini.dataset.hiddenByUser = "1";
          refs.mini.classList.remove("rdk-music-mini-open");
          state.miniPlayerOpen = false;
        }
      });
    }

    // Scroll handler (mini player visibility)
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateMiniPlayerVisibility();
        ticking = false;
      });
    }, { passive: true });

    // Audio events
    audio.addEventListener("play", () => {
      state.isPlaying = true;
      updatePlayButtons();
      updateMediaSessionState();
      renderPlaylist();
    });

    audio.addEventListener("pause", () => {
      state.isPlaying = false;
      updatePlayButtons();
      updateMediaSessionState();
      renderPlaylist();
    });

    audio.addEventListener("timeupdate", updateProgress);

    audio.addEventListener("loadedmetadata", () => {
      state.duration = audio.duration;
      updateProgress();
    });

    audio.addEventListener("ended", () => {
      if (state.repeatMode === "one") {
        audio.currentTime = 0;
        audio.play();
        return;
      }
      playNext(true);
    });

    audio.addEventListener("error", () => {
      console.warn("[RDK Music] Error pada track:", state.playlist[state.currentIndex]?.src);
      // Skip ke next
      if (state.playlist.length > 1) {
        setTimeout(() => playNext(true), 300);
      }
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      // Skip kalau user sedang mengetik di input/textarea
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;

      if (e.code === "Space") {
        // Hanya handle kalau tidak ada modal/panel terbuka
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft" && e.altKey) {
        audio.currentTime = Math.max(0, audio.currentTime - CONFIG.SEEK_STEP);
      } else if (e.code === "ArrowRight" && e.altKey) {
        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + CONFIG.SEEK_STEP);
      }
    });
  }

  /* ---------- CACHE DOM REFS ---------- */

  function cacheRefs() {
    refs = {
      section: $("rdkMusicSection"),
      list: $("rdkMusicList"),
      nowTitle: $("rdkMusicNowTitle"),
      play: $("rdkMusicPlay"),
      prev: $("rdkMusicPrev"),
      next: $("rdkMusicNext"),
      progress: $("rdkMusicProgress"),
      progressFill: $("rdkMusicProgressFill"),
      progressThumb: $("rdkMusicProgressThumb"),
      time: $("rdkMusicTime"),
      shuffle: $("rdkMusicShuffle"),
      repeat: $("rdkMusicRepeat"),
      volume: $("rdkMusicVolume"),
      mini: $("rdkMusicMini"),
      miniTitle: $("rdkMusicMiniTitle"),
      miniArtist: $("rdkMusicMiniArtist"),
      miniCover: $("rdkMusicMiniCover"),
      miniPlay: $("rdkMusicMiniPlay"),
      miniPrev: $("rdkMusicMiniPrev"),
      miniNext: $("rdkMusicMiniNext"),
      miniClose: $("rdkMusicMiniClose")
    };
  }

  /* ---------- INJECT TO PAGE ---------- */

  function injectSection() {
    // Cari tempat yang cocok: sebelum .footer atau .spotify-section
    const container = document.querySelector(".container");
    if (!container) return;

    const section = buildSection();
    const footer = container.querySelector(".footer");
    const spotify = container.querySelector(".spotify-section");

    if (footer) {
      container.insertBefore(section, footer);
    } else if (spotify) {
      container.insertBefore(section, spotify);
    } else {
      container.appendChild(section);
    }
  }

  function injectMiniPlayer() {
    if ($("rdkMusicMini")) return;
    const mini = buildMiniPlayer();
    document.body.appendChild(mini);
  }

  /* ---------- INIT ---------- */

  async function init() {
    // Guard: cuma load sekali
    if (window.__RDK_MUSIC_LOADED__) return;
    window.__RDK_MUSIC_LOADED__ = true;

    // Load state dari localStorage
    loadState();

    // Load playlist
    const ok = await loadPlaylist();
    if (!ok) {
      console.info("[RDK Music] Playlist kosong atau gagal load. Skip.");
      return;
    }

    // Inject UI
    injectSection();
    injectMiniPlayer();
    cacheRefs();

    // Render
    renderPlaylist();

    // Set volume
    audio.volume = state.volume;
    audio.muted = state.muted;

    // Restore UI state
    updateVolumeUI();
    updateShuffleUI();
    updateRepeatUI();
    updatePlayButtons();

    // Kalau ada currentIndex di localStorage, tapi jangan autoplay
    if (state.currentIndex >= 0 && state.currentIndex < state.playlist.length) {
      const track = state.playlist[state.currentIndex];
      audio.src = track.src;
      updateNowPlaying(track);
      updateMiniPlayer(track);
      renderPlaylist();
    }

    // Bind events
    bindEvents();
    setupProgressDrag();
    setupMediaSession();

    // Media session metadata
    if (state.currentIndex >= 0) {
      updateMediaSessionMetadata(state.playlist[state.currentIndex]);
    }

    // Watcher untuk update metadata saat track berubah
    const origPlayTrack = playTrack;
    // (playTrack sudah handle lewat updateNowPlaying, jadi cukup panggil metadata juga)
    const _origUpdateNowPlaying = updateNowPlaying;
    // override lokal
    updateNowPlaying = function (track) {
      _origUpdateNowPlaying(track);
      updateMediaSessionMetadata(track);
    };
    // rebind: karena function di-scope, kita simpan ulang
    // (cara lebih clean: panggil manual di playTrack — sudah kita lakukan di bawah)

    // Re-bind playTrack untuk update media session
    // (cara paling simpel: panggil updateMediaSessionMetadata di playTrack lewat event loadedmetadata)
    audio.addEventListener("loadedmetadata", () => {
      if (state.currentIndex >= 0) {
        updateMediaSessionMetadata(state.playlist[state.currentIndex]);
      }
    });

    // Init mini visibility
    updateMiniPlayerVisibility();

    console.log("[RDK Music] Ready. Playlist:", state.playlist.length, "track.");
  }

  /* ---------- START ---------- */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // delay sedikit biar container sudah siap
    setTimeout(init, 50);
  }

  /* ---------- EXPOSE (debug) ---------- */

  window.RDK_MUSIC = {
    state: state,
    audio: audio,
    play: playTrack,
    next: playNext,
    prev: playPrev,
    toggle: togglePlay
  };

})();