/* ============================================================
   ROJAK DRIVEK1T — Music Player (FINAL)
   Vanilla DOM. Fallback playlist kalau JSON gagal load.

   FIX terbaru:
   - currentIndex TIDAK di-restore dari localStorage
   - EQ hanya animasi kalau audio benar-benar playing
   - Mini player hanya muncul kalau ada track & sedang playing
   - Music section jadi CARD TERPISAH di bawah #createPanel
   - Music section auto-hide saat pindah ke tab Recent/Open Drive
   - SVG icons diganti custom (bukan template AI/SaaS)
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

  /* ============================================================
     SVG ICONS — custom, bukan template AI/SaaS
     ============================================================ */

  const ICON = {
    music: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 17.5V6l10-2v11.5"/>
      <circle cx="7" cy="18" r="2.2"/>
      <circle cx="17" cy="16" r="2.2"/>
      <line x1="9" y1="9.5" x2="19" y2="7.5"/>
    </svg>`,

    play: `<svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.5 5.2v13.6c0 .9 1 1.4 1.7.9l10.8-6.8c.7-.4.7-1.4 0-1.8L9.2 4.3c-.7-.5-1.7 0-1.7.9z"/>
    </svg>`,

    pause: `<svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="6.5" y="4.5" width="3.5" height="15" rx="1.5"/>
      <rect x="14" y="4.5" width="3.5" height="15" rx="1.5"/>
    </svg>`,

    prev: `<svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.5 6.2v11.6c0 .8-.9 1.2-1.5.7L9 12.5c-.5-.3-.5-1 0-1.3l8-5.7c.6-.5 1.5 0 1.5.7z"/>
      <rect x="4.5" y="5" width="2.2" height="14" rx="1.1"/>
    </svg>`,

    next: `<svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.5 6.2v11.6c0 .8.9 1.2 1.5.7l8-5.7c.5-.3.5-1 0-1.3l-8-5.7c-.6-.5-1.5 0-1.5.7z"/>
      <rect x="17.3" y="5" width="2.2" height="14" rx="1.1"/>
    </svg>`,

    shuffle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 3h5v5"/>
      <path d="M4 20L21 3"/>
      <path d="M21 16v5h-5"/>
      <path d="M15 15l6 6"/>
      <path d="M4 4l5 5"/>
    </svg>`,

    repeat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 2l4 4-4 4"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <path d="M7 22l-4-4 4-4"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>`,

    repeatOne: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 2l4 4-4 4"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <path d="M7 22l-4-4 4-4"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
      <text x="12" y="15" font-size="7" font-weight="800" fill="currentColor" stroke="none" text-anchor="middle">1</text>
    </svg>`,

    volume: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    </svg>`,

    volumeMute: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor"/>
      <line x1="23" y1="9" x2="17" y2="15"/>
      <line x1="17" y1="9" x2="23" y2="15"/>
    </svg>`
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
    } catch (_) {}
  }

  function purgeLegacyState() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && "currentIndex" in parsed) {
        delete parsed.currentIndex;
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(parsed));
      }
    } catch (_) {}
  }

  /* ---------- PLAYLIST LOAD ---------- */

  async function loadPlaylist() {
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
      const isCurrent = i === state.currentIndex;
      const isPlaying = isCurrent && state.isPlaying;

      let cls = "rdk-music-track";
      if (isCurrent) cls += " rdk-music-track-active";
      if (isPlaying) cls += " rdk-music-track-playing";

      return `
        <div class="${cls}" data-index="${i}">
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
        renderPlaylist();
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
      audio.play().catch(err => {
        console.warn("[RDK Music] Play gagal:", err);
        state.isPlaying = false;
        updatePlayButtons();
        renderPlaylist();
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
        state.isPlaying = false;
        audio.pause();
        updatePlayButtons();
        renderPlaylist();
        updateMiniPlayerVisibility();
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

  function resetNowPlaying() {
    if (refs.nowTitle) {
      refs.nowTitle.innerHTML = '<span>Pilih lagu untuk mulai</span>';
    }
    if (refs.miniTitle) refs.miniTitle.textContent = "Belum ada lagu";
    if (refs.miniArtist) refs.miniArtist.textContent = "—";
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

    if (refs.play) {
      refs.play.setAttribute("aria-label", state.isPlaying ? "Pause" : "Play");
    }
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

  /* ---------- VISIBILITY ---------- */

  function isCreatePageActive() {
    const createPanel = $("createPanel");
    return !!(createPanel && createPanel.classList.contains("active"));
  }

  function updateMusicSectionVisibility() {
    if (!refs.section) return;
    if (isCreatePageActive()) {
      refs.section.style.display = "";
    } else {
      refs.section.style.display = "none";
    }
  }

  function updateMiniPlayerVisibility() {
    if (!refs.mini || !refs.section) return;

    if (!isCreatePageActive()) {
      refs.mini.classList.remove("rdk-music-mini-open");
      state.miniPlayerOpen = false;
      return;
    }

    const sectionRect = refs.section.getBoundingClientRect();
    const isHiddenByUser = refs.mini.dataset.hiddenByUser === "1";

    if (isHiddenByUser) {
      refs.mini.classList.remove("rdk-music-mini-open");
      state.miniPlayerOpen = false;
      return;
    }

    const shouldShow =
      state.currentIndex !== -1 &&
      state.isPlaying &&
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
      updateMiniPlayerVisibility();
    });

    audio.addEventListener("pause", () => {
      state.isPlaying = false;
      updatePlayButtons();
      updateMediaSessionState();
      renderPlaylist();
      updateMiniPlayerVisibility();
    });

    audio.addEventListener("timeupdate", updateProgress);

    audio.addEventListener("loadedmetadata", () => {
      state.duration = audio.duration;
      updateProgress();
      if (state.currentIndex >= 0 && state.currentIndex < state.playlist.length) {
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
      state.isPlaying = false;
      updatePlayButtons();
      renderPlaylist();
      updateMiniPlayerVisibility();
      if (state.playlist.length > 1) {
        setTimeout(() => playNext(true), 300);
      }
    });

    document.addEventListener("keydown", (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;

      if (e.code === "Space" && !e.ctrlKey && !e.metaKey && isCreatePageActive()) {
        e.preventDefault();
        togglePlay();
      }
    });

    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        requestAnimationFrame(() => {
          updateMusicSectionVisibility();
          updateMiniPlayerVisibility();
        });
      });
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
    const createPanel = $("createPanel");
    if (!createPanel) return;

    const container = createPanel.parentElement;
    if (!container) return;

    const existing = $("rdkMusicSection");
    if (existing) existing.remove();

    const section = buildSection();

    if (createPanel.nextSibling) {
      container.insertBefore(section, createPanel.nextSibling);
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

    purgeLegacyState();
    loadState();

    const ok = await loadPlaylist();
    if (!ok) {
      console.warn("[RDK Music] Playlist kosong total. Skip.");
      return;
    }

    injectSection();
    injectMiniPlayer();
    cacheRefs();

    state.currentIndex = -1;
    state.isPlaying = false;

    resetNowPlaying();
    renderPlaylist();

    audio.volume = state.volume;
    audio.muted = state.muted;

    updateVolumeUI();
    updateShuffleUI();
    updateRepeatUI();
    updatePlayButtons();

    bindEvents();
    setupProgressDrag();
    setupMediaSession();
    updateMusicSectionVisibility();
    updateMiniPlayerVisibility();

    console.log("[RDK Music] Ready. Playlist:", state.playlist.length, "track.");
  }

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