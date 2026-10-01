/* ============================================================
   ROJAK AI — CS & Tutor (Text-only)
   Fitur: typewriter effect + markdown live render

   FIX terbaru:
   - SVG icon custom (bukan template AI/SaaS)
   - Send icon jadi arrow up (clean)
   - Reset icon jadi refresh arrow custom
   - Dot hijau FAB DIPINDAH ke dalam .rojak-ai-fab-icon
   - Auto-focus HANYA di desktop (pointer: fine)
     → HP tidak auto-buka keyboard saat panel dibuka
   - Reset conversation pakai RDKConfirm modal (fallback ke confirm())
============================================================ */

(function () {
  "use strict";

  const CONFIG = {
    API_ENDPOINT: "/api/ai",
    MAX_MESSAGE_LEN: 2000,
    MAX_HISTORY: 10,
    STORAGE_KEY: "rojak_ai_history_v1"
  };

  const QUICK_SUGGESTIONS = [
    "Cara membuat file TXT",
    "Cara memakai Rojak DriveK1t",
    "Cara membuat shortcut Drive",
    "Apa saja fitur Rojak DriveK1t?"
  ];

  const state = {
    open: false,
    sending: false,
    history: [],
    scrollY: 0,
    typingTimer: null,
    typingActive: false
  };

  /* ---------- ICONS (CUSTOM) ---------- */

  const ICON_CHAT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 6.5C4 5.1 5.1 4 6.5 4h11C18.9 4 20 5.1 20 6.5v8c0 1.4-1.1 2.5-2.5 2.5H9l-3.6 3.2c-.5.5-1.4.1-1.4-.6V6.5z"/>
    <path d="M8.5 9.5h7"/>
    <path d="M8.5 12.5h4"/>
  </svg>`;

  const ICON_SEND = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" y1="19" x2="12" y2="5"/>
    <polyline points="5 12 12 5 19 12"/>
  </svg>`;

  const ICON_RESET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M3.51 15a9 9 0 0 0 14.85 3.36L21 16"/>
    <path d="M21 21v-5h-5"/>
  </svg>`;

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

  function isDesktopPointer() {
    return window.matchMedia && window.matchMedia("(pointer: fine)").matches;
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

  /* ---------- TYPEWRITER EFFECT ---------- */

  function stopTyping() {
    if (state.typingTimer) {
      clearTimeout(state.typingTimer);
      state.typingTimer = null;
    }
    state.typingActive = false;
  }

  function typewriterEffect(bubbleEl, fullText, onDone) {
    stopTyping();
    state.typingActive = true;

    const rawText = String(fullText || "");
    const totalChars = rawText.length;

    let charsPerTick = 1;
    let tickDelay = 18;

    if (totalChars > 400) {
      charsPerTick = 3;
      tickDelay = 14;
    } else if (totalChars > 200) {
      charsPerTick = 2;
      tickDelay = 16;
    }

    let i = 0;

    function step() {
      if (!state.typingActive) return;
      if (!bubbleEl.parentNode) return;

      i += charsPerTick;
      if (i > totalChars) i = totalChars;

      const partial = rawText.slice(0, i);

      bubbleEl.innerHTML = renderRichText(partial) +
        (i < totalChars ? '<span class="rojak-ai-cursor"></span>' : '');

      const bodyEl = document.getElementById("rojakAiBody");
      if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;

      if (i < totalChars) {
        const lastChar = rawText.charAt(i - 1);
        let delay = tickDelay;
        if (lastChar === "." || lastChar === "!" || lastChar === "?") delay = tickDelay * 6;
        else if (lastChar === "," || lastChar === ";" || lastChar === ":") delay = tickDelay * 3;
        else if (lastChar === "\n") delay = tickDelay * 4;

        state.typingTimer = setTimeout(step, delay);
      } else {
        bubbleEl.innerHTML = renderRichText(rawText);
        state.typingActive = false;
        state.typingTimer = null;
        if (typeof onDone === "function") onDone();
      }
    }

    bubbleEl.innerHTML = '<span class="rojak-ai-cursor"></span>';
    state.typingTimer = setTimeout(step, 120);
  }

  /* ---------- RENDER ---------- */

  function appendMessageEl(role, content, ts, options) {
    options = options || {};
    const bodyEl = document.getElementById("rojakAiBody");
    if (!bodyEl) return null;

    const msg = el("div", {
      class: "rojak-ai-msg rojak-ai-msg-" + (role === "user" ? "user" : "bot")
    });

    const bubble = el("div", { class: "rojak-ai-bubble" });

    if (options.typewriter && role === "assistant") {
      const inner = el("div", { class: "rojak-ai-bubble-inner" });
      bubble.appendChild(inner);

      msg.appendChild(bubble);
      msg.appendChild(el("div", { class: "rojak-ai-time", text: formatTime(ts) }));
      bodyEl.appendChild(msg);
      scrollToBottom();

      typewriterEffect(inner, content, options.onDone);
      return msg;
    }

    if (content) {
      bubble.appendChild(el("div", { html: renderRichText(content) }));
    }

    msg.appendChild(bubble);
    msg.appendChild(el("div", { class: "rojak-ai-time", text: formatTime(ts) }));
    bodyEl.appendChild(msg);
    scrollToBottom();
    return msg;
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
        "Halo! Saya Rojak AI, asisten Rojak DriveK1t.\n\nSaya bisa bantu cari rumus Excel, jelasin fungsi, atau pandu cara pakai DriveK1t. Mau tanya apa?",
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

  /* ---------- PANEL ---------- */

  function openPanel() {
    const panel = document.getElementById("rojakAiPanel");
    const input = document.getElementById("rojakAiInput");
    if (!panel) return;

    panel.classList.add("rojak-ai-open");
    state.open = true;

    state.scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add("rojak-ai-no-scroll");

    // Auto-focus HANYA di desktop (mouse/trackpad).
    // Di HP, keyboard TIDAK muncul otomatis — user tap sendiri kalau mau ngetik.
    const isDesktop = isDesktopPointer();

    setTimeout(() => {
      if (isDesktop && input) input.focus();
      scrollToBottom();
    }, 60);
  }

  function closePanel() {
    const panel = document.getElementById("rojakAiPanel");
    if (!panel) return;

    panel.classList.remove("rojak-ai-open");
    state.open = false;

    document.body.classList.remove("rojak-ai-no-scroll");

    // Blur input biar keyboard turun (kalau ada) saat panel ditutup
    const input = document.getElementById("rojakAiInput");
    if (input && document.activeElement === input) {
      input.blur();
    }

    if (state.scrollY) {
      window.scrollTo(0, state.scrollY);
    }
  }

  function togglePanel() {
    state.open ? closePanel() : openPanel();
  }

  /* ---------- SEND ---------- */

  async function sendMessage() {
    if (state.sending) return;

    const input = document.getElementById("rojakAiInput");
    if (!input) return;

    const text = (input.value || "").trim();
    if (!text) return;

    if (text.length > CONFIG.MAX_MESSAGE_LEN) {
      alert("Pesan terlalu panjang.");
      return;
    }

    stopTyping();

    const sugg = document.querySelector(".rojak-ai-suggest");
    if (sugg) sugg.remove();

    const ts = Date.now();
    appendMessageEl("user", text, ts);

    state.history.push({ role: "user", content: text, ts });

    input.value = "";
    autoGrow(input);

    state.sending = true;
    const sendBtn = document.getElementById("rojakAiSend");
    if (sendBtn) sendBtn.disabled = true;

    appendTypingEl();

    try {
      const payloadMessages = state.history
        .slice(-CONFIG.MAX_HISTORY)
        .map(m => ({ role: m.role, content: m.content }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 28000);

      let res;
      try {
        res = await fetch(CONFIG.API_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: payloadMessages }),
          signal: controller.signal
        });
      } catch (fetchError) {
        if (fetchError?.name === "AbortError") {
          throw new Error("TIMEOUT");
        }
        throw fetchError;
      } finally {
        clearTimeout(timeoutId);
      }

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
        appendMessageEl("assistant", errMsg, Date.now(), { typewriter: true });
        return;
      }

      const data = await res.json();
      const reply = (data && data.reply) ? String(data.reply) : "Maaf, tidak ada balasan.";

      appendMessageEl("assistant", reply, Date.now(), {
        typewriter: true,
        onDone: function () {
          state.history.push({ role: "assistant", content: reply, ts: Date.now() });
          saveHistory();
        }
      });

    } catch (err) {
      removeTypingEl();
      console.error("[Rojak AI] fetch error:", err);
      const errorMessage =
        err?.message === "TIMEOUT"
          ? "Rojak AI terlalu lama merespons. Coba kirim lagi."
          : "Tidak dapat terhubung ke Rojak AI. Periksa koneksi internet kamu.";

      appendMessageEl("assistant", errorMessage, Date.now(), {
        typewriter: true
      });
    } finally {
      state.sending = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  /* ---------- RESET ---------- */

  function performReset() {
    stopTyping();
    state.history = [];
    try { localStorage.removeItem(CONFIG.STORAGE_KEY); } catch (_) {}
    renderHistory();
  }

  function resetConversation() {
    // Pakai RDKConfirm kalau tersedia, fallback ke confirm() bawaan
    if (window.RDKConfirm && typeof window.RDKConfirm.show === "function") {
      window.RDKConfirm.show({
        title: "Reset Percakapan?",
        message: "Semua riwayat chat dengan Rojak AI akan dihapus. Yakin ingin melanjutkan?",
        confirmText: "Ya, Reset",
        cancelText: "Batal",
        danger: true,
        onConfirm: function () {
          performReset();
        }
      });
      return;
    }

    // Fallback
    if (confirm("Reset percakapan Rojak AI?")) {
      performReset();
    }
  }

  /* ---------- BUILD ---------- */

  function buildWidget() {
    /* FAB icon — dot hijau dipindah KE DALAM icon */
    const fabIcon = el("span", { class: "rojak-ai-fab-icon" });
    fabIcon.innerHTML = ICON_CHAT;
    fabIcon.appendChild(el("span", { class: "rojak-ai-fab-dot" }));

    const fab = el("button", {
      class: "rojak-ai-fab",
      type: "button",
      id: "rojakAiFab",
      title: "Chat dengan Rojak AI",
      "aria-label": "Buka Rojak AI"
    }, [
      fabIcon,
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

    const textarea = el("textarea", {
      class: "rojak-ai-textarea",
      id: "rojakAiInput",
      placeholder: "Tanya rumus Excel atau cara pakai DriveK1t...",
      rows: "1",
      maxlength: String(CONFIG.MAX_MESSAGE_LEN)
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
      el("div", { class: "rojak-ai-input-row" }, [
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