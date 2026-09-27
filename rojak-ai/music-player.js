/* ============================================================
   ROJAK AI — Chat Widget (FIXED SCROLL)
============================================================ */

(function () {
  "use strict";

  const CONFIG = {
    API_ENDPOINT: "/api/ai",
    MAX_MESSAGE_LEN: 2000,
    MAX_IMAGE_BYTES: 4 * 1024 * 1024,
    MAX_HISTORY: 16,
    STORAGE_KEY: "rojak_ai_history_v1"
  };

  const QUICK_SUGGESTIONS = [
    "Rumus VLOOKUP untuk cari nama",
    "Bedanya IF dan IFS?",
    "Rumus jumlah gaji kotor",
    "Kenapa rumusku #N/A?"
  ];

  const state = {
    open: false,
    sending: false,
    history: [],
    attachedImage: null,
    scrollY: 0
  };

  /* ---------- ICONS ---------- */

  const ICON_CHAT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
  const ICON_SEND = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
  const ICON_CAMERA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
  const ICON_RESET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`;

  /* ---------- HELPERS ---------- */

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

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  }

  function renderRichText(raw) {
    let safe = escapeHtml(raw);

    const codeBlocks = [];
    safe = safe.replace(/```([\s\S]*?)```/g, (_, code) => {
      const clean = code.replace(/^\n+|\n+$/g, "");
      codeBlocks.push(clean);
      return `\u0000CODEBLOCK${codeBlocks.length - 1}\u0000`;
    });

    safe = safe.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/\n/g, "<br>");

    safe = safe.replace(/\u0000CODEBLOCK(\d+)\u0000/g, (_, idx) => {
      const code = codeBlocks[Number(idx)];
      return `<pre><code>${code}</code></pre>`;
    });

    return safe;
  }

  /* ---------- STORAGE ---------- */

  function loadHistory() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.history = parsed.slice(-30).map(m => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content || ""),
          ts: Number(m.ts) || Date.now()
        }));
      }
    } catch (_) { /* ignore */ }
  }

  function saveHistory() {
    try {
      const lightweight = state.history.slice(-30).map(m => ({
        role: m.role,
        content: m.content,
        ts: m.ts
      }));
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(lightweight));
    } catch (_) { /* ignore */ }
  }

  /* ---------- RENDER ---------- */

  function appendMessageEl(role, content, ts, imageDataUrl) {
    const bodyEl = document.getElementById("rojakAiBody");
    if (!bodyEl) return;

    const msg = el("div", {
      class: "rojak-ai-msg rojak-ai-msg-" + (role === "user" ? "user" : "bot")
    });

    const bubble = el("div", { class: "rojak-ai-bubble" });

    if (imageDataUrl) {
      bubble.appendChild(el("img", {
        class: "rojak-ai-img",
        src: imageDataUrl,
        alt: "Lampiran"
      }));
    }

    if (content) {
      bubble.appendChild(el("div", { html: renderRichText(content) }));
    }

    msg.appendChild(bubble);
    msg.appendChild(el("div", { class: "rojak-ai-time", text: formatTime(ts) }));
    bodyEl.appendChild(msg);
    scrollToBottom();
  }

  function appendTypingEl() {
    const bodyEl = document.getElementById("rojakAiBody");
    if (!bodyEl) return;

    const wrap = el("div", {
      class: "rojak-ai-msg rojak-ai-msg-bot",
      id: "rojakAiTyping"
    }, [
      el("div", { class: "rojak-ai-typing" }, [
        el("span"), el("span"), el("span")
      ])
    ]);

    bodyEl.appendChild(wrap);
    scrollToBottom();
  }

  function removeTypingEl() {
    const t = document.getElementById("rojakAiTyping");
    if (t && t.parentNode) t.parentNode.removeChild(t);
  }

  function scrollToBottom() {
    const bodyEl = document.getElementById("rojakAiBody");
    if (!bodyEl) return;
    requestAnimationFrame(() => {
      bodyEl.scrollTop = bodyEl.scrollHeight;
    });
  }

  function renderQuickSuggestions() {
    const bodyEl = document.getElementById("rojakAiBody");
    if (!bodyEl) return;
    if (state.history.length > 0) return;

    const wrap = el("div", { class: "rojak-ai-suggest" });
    QUICK_SUGGESTIONS.forEach(text => {
      wrap.appendChild(el("button", {
        class: "rojak-ai-chip",
        type: "button",
        text,
        onclick: () => {
          const input = document.getElementById("rojakAiInput");
          if (!input) return;
          input.value = text;
          input.focus();
          autoGrow(input);
          wrap.remove();
        }
      }));
    });
    bodyEl.appendChild(wrap);
  }

  function renderHistory() {
    const bodyEl = document.getElementById("rojakAiBody");
    if (!bodyEl) return;

    bodyEl.innerHTML = "";

    if (state.history.length === 0) {
      appendMessageEl(
        "assistant",
        "Halo! Saya Rojak AI 👋\n\nSaya bisa bantu soal rumus Excel, jelasin fungsi, atau baca tabel dari foto. Mau tanya apa?",
        Date.now()
      );
      renderQuickSuggestions();
      return;
    }

    state.history.forEach(m => {
      appendMessageEl(m.role, m.content, m.ts);
    });
  }

  /* ---------- TEXTAREA ---------- */

  function autoGrow(ta) {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
  }

  /* ---------- PANEL OPEN / CLOSE (FIX SCROLL LOCK) ---------- */

  function openPanel() {
    const panel = document.getElementById("rojakAiPanel");
    const input = document.getElementById("rojakAiInput");
    if (!panel) return;

    panel.classList.add("rojak-ai-open");
    state.open = true;

    // Simpan posisi scroll body
    state.scrollY = window.scrollY || window.pageYOffset || 0;

    // Kunci scroll body — biar halaman belakang tidak ikut scroll
    document.body.classList.add("rojak-ai-no-scroll");

    setTimeout(() => {
      if (input) input.focus();
      scrollToBottom();
    }, 60);
  }

  function closePanel() {
    const panel = document.getElementById("rojakAiPanel");
    if (!panel) return;

    panel.classList.remove("rojak-ai-open");
    state.open = false;

    // Lepas kunci scroll body
    document.body.classList.remove("rojak-ai-no-scroll");

    // Kembalikan posisi scroll
    if (state.scrollY) {
      window.scrollTo(0, state.scrollY);
    }
  }

  function togglePanel() {
    state.open ? closePanel() : openPanel();
  }

  /* ---------- ATTACH ---------- */

  function handleFileSelected(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Hanya file gambar yang didukung.");
      return;
    }

    if (file.size > CONFIG.MAX_IMAGE_BYTES) {
      alert("Ukuran gambar terlalu besar (max 4MB).");
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      state.attachedImage = {
        dataUrl: e.target.result,
        name: file.name || "gambar.jpg",
        size: file.size
      };

      const wrap = document.getElementById("rojakAiAttach");
      const img = document.getElementById("rojakAiAttachImg");
      const nameEl = document.getElementById("rojakAiAttachName");
      const sizeEl = document.getElementById("rojakAiAttachSize");

      if (img) img.src = state.attachedImage.dataUrl;
      if (nameEl) nameEl.textContent = state.attachedImage.name;
      if (sizeEl) sizeEl.textContent = formatBytes(state.attachedImage.size);
      if (wrap) wrap.classList.add("rojak-ai-attach-on");

      scrollToBottom();
    };
    reader.onerror = () => alert("Gagal membaca gambar.");
    reader.readAsDataURL(file);
  }

  function clearAttachment() {
    state.attachedImage = null;
    const wrap = document.getElementById("rojakAiAttach");
    const fileInput = document.getElementById("rojakAiFile");
    if (wrap) wrap.classList.remove("rojak-ai-attach-on");
    if (fileInput) fileInput.value = "";
  }

  /* ---------- SEND ---------- */

  async function sendMessage() {
    if (state.sending) return;

    const input = document.getElementById("rojakAiInput");
    if (!input) return;

    const text = (input.value || "").trim();
    const image = state.attachedImage;

    if (!text && !image) return;

    if (text.length > CONFIG.MAX_MESSAGE_LEN) {
      alert("Pesan terlalu panjang.");
      return;
    }

    const sugg = document.querySelector(".rojak-ai-suggest");
    if (sugg) sugg.remove();

    const ts = Date.now();
    appendMessageEl("user", text, ts, image ? image.dataUrl : null);

    state.history.push({ role: "user", content: text, ts });

    input.value = "";
    autoGrow(input);

    const imageToSend = image ? image.dataUrl : null;
    clearAttachment();

    state.sending = true;
    const sendBtn = document.getElementById("rojakAiSend");
    if (sendBtn) sendBtn.disabled = true;

    appendTypingEl();

    try {
      const payloadMessages = state.history
        .slice(-CONFIG.MAX_HISTORY)
        .map(m => ({ role: m.role, content: m.content }));

      const body = { messages: payloadMessages };
      if (imageToSend) body.image = imageToSend;

      const res = await fetch(CONFIG.API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      removeTypingEl();

      if (!res.ok) {
        let errMsg = "Maaf, Rojak AI sedang mengalami masalah. Coba lagi beberapa saat.";
        try {
          const j = await res.json();
          if (j && j.error === "NO_API_KEY") {
            errMsg = "Rojak AI belum dikonfigurasi. Silakan periksa Environment Variables.";
          } else if (j && j.message) {
            errMsg = j.message;
          }
        } catch (_) { /* ignore */ }
        appendMessageEl("assistant", errMsg, Date.now());
        return;
      }

      const data = await res.json();
      const reply = (data && data.reply) ? String(data.reply) : "Maaf, tidak ada balasan.";

      appendMessageEl("assistant", reply, Date.now());
      state.history.push({ role: "assistant", content: reply, ts: Date.now() });
      saveHistory();

    } catch (err) {
      removeTypingEl();
      console.error("[Rojak AI] fetch error:", err);
      appendMessageEl(
        "assistant",
        "Tidak dapat terhubung ke Rojak AI. Periksa koneksi internet kamu.",
        Date.now()
      );
    } finally {
      state.sending = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  /* ---------- RESET ---------- */

  function resetConversation() {
    if (!confirm("Reset percakapan Rojak AI?")) return;
    state.history = [];
    state.attachedImage = null;
    clearAttachment();
    try { localStorage.removeItem(CONFIG.STORAGE_KEY); } catch (_) {}
    renderHistory();
  }

  /* ---------- BUILD ---------- */

  function buildWidget() {
    const fab = el("button", {
      class: "rojak-ai-fab",
      type: "button",
      id: "rojakAiFab",
      title: "Chat dengan Rojak AI",
      "aria-label": "Buka Rojak AI"
    }, [
      el("span", { class: "rojak-ai-fab-dot" }),
      el("span", { class: "rojak-ai-fab-icon", html: ICON_CHAT }),
      el("span", { text: "Rojak AI" })
    ]);

    const panel = el("div", {
      class: "rojak-ai-panel",
      id: "rojakAiPanel",
      role: "dialog",
      "aria-label": "Rojak AI Chat"
    });

    const header = el("div", { class: "rojak-ai-header" }, [
      el("div", { class: "rojak-ai-header-left" }, [
        el("div", { class: "rojak-ai-avatar", text: "R" }),
        el("div", { class: "rojak-ai-title" }, [
          el("div", { class: "rojak-ai-title-name", text: "Rojak AI" }),
          el("div", { class: "rojak-ai-title-status" }, [
            el("span", { class: "rojak-ai-status-dot" }),
            el("span", { text: "Online" })
          ])
        ])
      ]),
      el("div", { class: "rojak-ai-header-actions" }, [
        el("button", {
          class: "rojak-ai-icon-button",
          type: "button",
          title: "Reset percakapan",
          "aria-label": "Reset percakapan",
          id: "rojakAiReset",
          html: ICON_RESET
        }),
        el("button", {
          class: "rojak-ai-icon-button",
          type: "button",
          title: "Tutup",
          "aria-label": "Tutup chat",
          id: "rojakAiClose",
          html: "×"
        })
      ])
    ]);

    const body = el("div", {
      class: "rojak-ai-body",
      id: "rojakAiBody"
    });

    const attach = el("div", {
      class: "rojak-ai-attach",
      id: "rojakAiAttach"
    }, [
      el("img", { id: "rojakAiAttachImg", alt: "Lampiran" }),
      el("div", { class: "rojak-ai-attach-info" }, [
        el("div", { class: "rojak-ai-attach-name", id: "rojakAiAttachName" }),
        el("div", { class: "rojak-ai-attach-size", id: "rojakAiAttachSize" })
      ]),
      el("button", {
        class: "rojak-ai-attach-remove",
        type: "button",
        id: "rojakAiAttachRemove",
        "aria-label": "Hapus lampiran",
        html: "×"
      })
    ]);

    const textarea = el("textarea", {
      class: "rojak-ai-textarea",
      id: "rojakAiInput",
      placeholder: "Tanya rumus Excel, kirim foto tabel...",
      rows: "1",
      maxlength: String(CONFIG.MAX_MESSAGE_LEN)
    });

    const fileInput = el("input", {
      type: "file",
      id: "rojakAiFile",
      accept: "image/png,image/jpeg,image/jpg,image/webp",
      style: "display:none"
    });

    const uploadBtn = el("button", {
      class: "rojak-ai-mini",
      type: "button",
      id: "rojakAiUpload",
      title: "Kirim foto",
      "aria-label": "Kirim foto",
      html: ICON_CAMERA
    });

    const sendBtn = el("button", {
      class: "rojak-ai-send",
      type: "button",
      id: "rojakAiSend",
      title: "Kirim",
      "aria-label": "Kirim pesan",
      html: ICON_SEND
    });

    const footer = el("div", { class: "rojak-ai-footer" }, [
      attach,
      el("div", { class: "rojak-ai-input-row" }, [
        uploadBtn,
        textarea,
        sendBtn
      ]),
      el("div", {
        class: "rojak-ai-hint",
        text: "Rojak AI bisa salah. Cek ulang rumus penting."
      })
    ]);

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);

    document.body.appendChild(fab);
    document.body.appendChild(panel);
    document.body.appendChild(fileInput);
  }

  /* ---------- INIT ---------- */

  function init() {
    if (document.getElementById("rojakAiFab")) return;

    buildWidget();
    loadHistory();
    renderHistory();

    const fab = document.getElementById("rojakAiFab");
    if (fab) fab.addEventListener("click", togglePanel);

    const closeBtn = document.getElementById("rojakAiClose");
    if (closeBtn) closeBtn.addEventListener("click", closePanel);

    const resetBtn = document.getElementById("rojakAiReset");
    if (resetBtn) resetBtn.addEventListener("click", resetConversation);

    const uploadBtn = document.getElementById("rojakAiUpload");
    const fileInput = document.getElementById("rojakAiFile");

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", e => {
        handleFileSelected(e.target.files && e.target.files[0]);
      });
    }

    const attachRemove = document.getElementById("rojakAiAttachRemove");
    if (attachRemove) attachRemove.addEventListener("click", clearAttachment);

    const sendBtn = document.getElementById("rojakAiSend");
    if (sendBtn) sendBtn.addEventListener("click", sendMessage);

    const textarea = document.getElementById("rojakAiInput");
    if (textarea) {
      textarea.addEventListener("input", () => autoGrow(textarea));
      textarea.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });

      textarea.addEventListener("paste", e => {
        const items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        for (const item of items) {
          if (item.type && item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              handleFileSelected(file);
              break;
            }
          }
        }
      });
    }

    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && state.open) closePanel();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
