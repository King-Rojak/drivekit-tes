/* ============================================================
   ROJAK DRIVEK1T — Music Player (FINAL)
   Vanilla DOM. Fallback playlist kalau JSON gagal load.
============================================================ */

(function () {
  "use strict";

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

  /* ---------- FALLBACK PLAYLIST (kalau JSON gagal) ---------- */

  const FALLBACK_PLAYLIST = [
    {
      title: "Dunia Yang Nanti",
      artist: "Raim Laode",
      src: "./music/dunia-yang-nanti.mp3",
      cover: "./music/playlist-cover.jpeg"
    },
    {
      title: "Sesi Potret",
      artist: "Enau, Ari Lesmana",
      src: "./music/sesi-potret.mp3",
      cover: "./music/playlist-cover.jpeg"
    },
    {
      title: "Teh Hijau",
      artist: "Tulus",
      src: "./music/teh-hijau.mp3",
      cover: "./music/playlist-cover.jpeg"
    }
  ];

  const state = {
    playlist: [],
    currentIndex: -1,
    isPlaying: false,
    isShuffle: false,
    repeatMode: "off",
    volume: CONFIG.VOLUME_DEFAULT,
    muted: false,
    duration: 0,
    currentTime: 0,
    dragging: false,
    miniPlayerOpen: false
  };

  const audio = new Audio();
  audio.preload = "metadata";

  let refs = {};

  const ICON = {
    music: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
    prev: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><rect x="4" y="5" width="2" height="14"/></svg>`,
    next: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><rect x="18" y="5" width="2" height="14"/></svg>`,
    shuffle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>`,
    repeat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
    repeatOne: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="12" y="15" font-size="7" font-weight="800" fill="currentColor" stroke="none" text-anchor="middle">1</text></svg>`,
    volume: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
    volumeMute: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
  };

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

  /* ---------- PLAYLIST LOAD (dengan fallback) ---------- */

  async function loadPlaylist() {
    // Coba fetch JSON
    try {
      const res = await fetch(CONFIG.PLAYLIST_URL, { cache: "no-cache" });

      if (res.ok) {
        const text = await res.text();
        const cleanText = text.replace(/^\uFEFF/, "").trim();
        const data = JSON.parse(cleanText);

        if (Array.isArray(data) && data.length > 0) {
          state.playlist = data
            .filter(t => t && typeof t.src === "string" && t.src.length > 0)
            .map(t => ({
              title: t.title || "Untitled",
              artist: t.artist || "Unknown",
              src: t.src,
              cover: t.cover || CONFIG.DEFAULT_COVER
            }));

          if (state.playlist.length > 0) {
            console.log("[RDK Music] Playlist loaded dari JSON:", state.playlist.length, "track");
            return true;
          }
        }
      }
    } catch (err) {
      console.warn("[RDK Music] Fetch playlist.json gagal:", err.message);
    }

    // Fallback
    console.warn("[RDK Music] Pakai FALLBACK playlist");
    state.playlist = FALLBACK_PLAYLIST.map(t => ({ ...t }));
    return state.playlist.length > 0;
  }

  /* ---------- BUILD SECTION ---------- */

  function buildSection() {
    const section = el("section", { class: "rdk-music-section", id: "rdkMusicSection" });

    const header = el("div", { class: "rdk-music-playlist-header" }, [
      el("div", { class: "rdk-music-playlist-cover" }, [
        el("img", {
          id: "rdkMusicPlaylistCover",
          src: CONFIG.DEFAULT_COVER,
          alt: "Playlist Cover",
          onerror: function () { this.style.display = "none"; }
        })
      ]),
      el("div", { class: "rdk-music-playlist-meta" }, [
        el("div", { class: "rdk-music-playlist-name", text: CONFIG.PLAYLIST_NAME }),
        el("div", { class: "rdk-music-playlist-owner", text: "By " + CONFIG.PLAYLIST_OWNER })
      ])
    ]);

    const list = el("div", { class: "rdk-music-list", id: "rdkMusicList" });

    const nowbar = el("div", { class: "rdk-music-nowbar" });

    const nowTitle = el("div", { class: "rdk-music-nowbar-title", id: "rdkMusicNowTitle" }, [
      el("span", { text: "Pilih lagu untuk mulai" })
    ]);

    const row = el("div", { class: "rdk-music-row" });

    const prevBtn = el("button", {
      class: "rdk-music-iconbtn", id: "rdkMusicPrev", type: "button",
      title: "Sebelumnya", "aria-label": "Sebelumnya", html: ICON.prev
    });

    const playBtn = el("button", {
      class: "rdk-music-play", id: "rdkMusicPlay", type: "button",
      title: "Play / Pause", "aria-label": "Play", html: ICON.play
    });

    const nextBtn = el("button", {
      class: "rdk-music-iconbtn", id: "rdkMusicNext", type: "button",
      title: "Berikutnya", "aria-label": "Berikutnya", html: ICON.next
    });

    const progress = el("div", {
      class: "rdk-music-progress", id: "rdkMusicProgress",
      role: "slider", "aria-label": "Seek"
    }, [
      el("div", { class: "rdk-music-progress-track" }, [
        el("div", { class: "rdk-music-progress-fill", id: "rdkMusicProgressFill" })
      ]),
      el("div", { class: "rdk-music-progress-thumb", id: "rdkMusicProgressThumb" })
    ]);

    const time = el("div", { class: "rdk-music-time", id: "rdkMusicTime", text: "0:00" });

    const extras = el("div", { class: "rdk-music-extras" }, [
      el("button", { class: "rdk-music-iconbtn", id: "rdkMusicShuffle", type: "button", title: "Shuffle", html: ICON.shuffle }),
      el("button", { class: "rdk-music-iconbtn", id: "rdkMusicRepeat", type: "button", title: "Repeat", html: ICON.repeat }),
      el("button", { class: "rdk-music-iconbtn", id: "rdkMusicVolume", type: "button", title: "Mute", html: ICON.volume })
    ]);

    row.appendChild(prevBtn);
    row.appendChild(playBtn);
    row.appendChild(nextBtn);
    row.appendChild(progress);
    row.appendChild(time);
    row.appendChild(extras);

    nowbar.appendChild(nowTitle);
    nowbar.appendChild(row);

    section.appendChild(header);
    section.appendChild(list);
    section.appendChild(nowbar);

    return section;
  }

  function buildMiniPlayer() {
    const mini = el("div", { class: "rdk-music-mini", id: "rdkMusicMini" });

    mini.appendChild(el("div", { class: "rdk-music-mini-cover" }, [
      el("img", {
        id: "rdkMusicMiniCover",
        src: CONFIG.DEFAULT_COVER,
        alt: "Cover",
        onerror: function () { this.style.display = "none"; }
      })
    ]));

    mini.appendChild(el("div", { class: "rdk-music-mini-meta" }, [
      el("div", { class: "rdk-music-mini-title", id: "rdkMusicMiniTitle", text: "Belum ada lagu" }),
      el("div", { class: "rdk-music-mini-artist", id: "rdkMusicMiniArtist", text: "—" })
    ]));

    mini.appendChild(el("div", { class: "rdk-music-mini-controls" }, [
      el("button", { class: "rdk-music-mini-btn", id: "rdkMusicMiniPrev", type: "button", "aria-label": "Sebelumnya", html: ICON.prev }),
      el("button", { class: "rdk-music-mini-btn rdk-music-mini-play", id: "rdkMusicMiniPlay", type: "button", "aria-label": "Play", html: ICON.play }),
      el("button", { class: "rdk-music-mini-btn", id: "rdkMusicMiniNext", type: "button", "aria-label": "Berikutnya", html: ICON.next })
    ]));

    mini.appendChild(el("button", {
      class: "rdk-music-mini-close", id: "rdkMusicMiniClose", type: "button",
      "aria-label": "Tutup", text: "×"
    }));

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
          <div class="rdk-music-eq"><span></span><span></span><span></span><span></span></div>
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
      if (state.playlist.length) playTrack(0);
      return;
    }

    if (state.isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(err => console.warn("[RDK Music] Play gagal:", err));
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
      refs.nowTitle.innerHTML = escapeHTML(track.title) +
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
    if (refs.shuffle) refs.shuffle.classList.toggle("rdk-music-ctrl-active", state.isShuffle);
  }

  function updateRepeatUI() {
    if (refs.repeat) {
      refs.repeat.classList.toggle("rdk-music-ctrl-active", state.repeatMode !== "off");
      refs.repeat.innerHTML = state.repeatMode === "one" ? ICON.repeatOne : ICON.repeat;
    }
  }

  /* ---------- DRAG ---------- */

  function setupProgressDrag() {
    const progress = refs.progress;
    if (!progress) return;

    let rect = null;

    function getPct(e) {
      if (!rect) rect = progress.getBoundingClientRect();
      const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      const x = clientX - rect.left;
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
    const isHiddenByUser = refs.mini.dataset.hiddenByUser === "1";

    if (isHiddenByUser) {
      refs.mini.classList.remove("rdk-music-mini-open");
      state.miniPlayerOpen = false;
      return;
    }

    const shouldShow = state.currentIndex !== -1 &&
      (sectionRect.bottom < CONFIG.MINI_PLAYER_THRESHOLD);

    if (shouldShow && !state.miniPlayerOpen) {
      refs.mini.classList.add("rdk-music-mini-open");
      state.miniPlayerOpen = true;
    } else if (!shouldShow && state.miniPlayerOpen) {
      refs.mini.classList.remove("rdk-music-mini-open");
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
  }

  function updateMediaSessionMetadata(track) {
    if (!("mediaSession" in navigator) || !window.MediaMetadata) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: CONFIG.PLAYLIST_NAME,
        artwork: [{ src: track.cover, sizes: "512x512", type: "image/jpeg" }]
      });
    } catch (_) {}
  }

  function updateMediaSessionState() {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = state.isPlaying ? "playing" : "paused";
  }

  /* ---------- BIND EVENTS ---------- */

  function bindEvents() {
    if (refs.play) refs.play.addEventListener("click", togglePlay);
    if (refs.miniPlay) refs.miniPlay.addEventListener("click", togglePlay);

    if (refs.prev) refs.prev.addEventListener("click", playPrev);
    if (refs.next) refs.next.addEventListener("click", () => playNext(false));
    if (refs.miniPrev) refs.miniPrev.addEventListener("click", playPrev);
    if (refs.miniNext) refs.miniNext.addEventListener("click", () => playNext(false));

    if (refs.shuffle) {
      refs.shuffle.addEventListener("click", () => {
        state.isShuffle = !state.isShuffle;
        updateShuffleUI();
        saveState();
      });
    }

    if (refs.repeat) {
      refs.repeat.addEventListener("click", () => {
        if (state.repeatMode === "off") state.repeatMode = "all";
        else if (state.repeatMode === "all") state.repeatMode = "one";
        else state.repeatMode = "off";
        updateRepeatUI();
        saveState();
      });
    }

    if (refs.volume) {
      refs.volume.addEventListener("click", () => {
        state.muted = !state.muted;
        audio.muted = state.muted;
        updateVolumeUI();
        saveState();
      });
    }

    if (refs.miniClose) {
      refs.miniClose.addEventListener("click", () => {
        if (refs.mini) {
          refs.mini.dataset.hiddenByUser = "1";
          refs.mini.classList.remove("rdk-music-mini-open");
          state.miniPlayerOpen = false;
        }
      });
    }

    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateMiniPlayerVisibility();
        ticking = false;
      });
    }, { passive: true });

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
      if (state.currentIndex >= 0) {
        updateMediaSessionMetadata(state.playlist[state.currentIndex]);
      }
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
      if (state.playlist.length > 1) {
        setTimeout(() => playNext(true), 300);
      }
    });

    document.addEventListener("keydown", (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;

      if (e.code === "Space" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        togglePlay();
      }
    });
  }

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

  function injectSection() {
    const container = document.querySelector(".container");
    if (!container) return;

    // Hapus kalau sudah ada (biar tidak dobel)
    const existing = $("rdkMusicSection");
    if (existing) existing.remove();

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
    const existing = $("rdkMusicMini");
    if (existing) existing.remove();
    document.body.appendChild(buildMiniPlayer());
  }

  /* ---------- INIT ---------- */

  async function init() {
    if (window.__RDK_MUSIC_LOADED__) return;
    window.__RDK_MUSIC_LOADED__ = true;

    loadState();

    const ok = await loadPlaylist();
    if (!ok) {
      console.warn("[RDK Music] Playlist kosong total. Skip.");
      return;
    }

    injectSection();
    injectMiniPlayer();
    cacheRefs();

    renderPlaylist();

    audio.volume = state.volume;
    audio.muted = state.muted;

    updateVolumeUI();
    updateShuffleUI();
    updateRepeatUI();
    updatePlayButtons();

    if (state.currentIndex >= 0 && state.currentIndex < state.playlist.length) {
      const track = state.playlist[state.currentIndex];
      audio.src = track.src;
      updateNowPlaying(track);
      updateMiniPlayer(track);
      renderPlaylist();
    }

    bindEvents();
    setupProgressDrag();
    setupMediaSession();
    updateMiniPlayerVisibility();

    console.log("[RDK Music] Ready. Playlist:", state.playlist.length, "track.");
  }

  // Music hanya diinisialisasi setelah Dashboard (app) dibuka.
  // Jadi player/mini-player tidak muncul di halaman login.
  function initWhenDashboardReady() {
    const app = document.getElementById("app");
    if (app && app.style.display === "block") {
      init();
      return;
    }

    window.addEventListener("rdk:app-ready", init, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWhenDashboardReady, { once: true });
  } else {
    setTimeout(initWhenDashboardReady, 50);
  }

  window.RDK_MUSIC = {
    state: state,
    audio: audio,
    play: playTrack,
    next: playNext,
    prev: playPrev,
    toggle: togglePlay
  };

})();
