/* ============================================================
   Rojak AI — Vercel Serverless Function (Text-only CS)
   Endpoint: POST /api/ai
============================================================ */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Model gratis text-only — dicoba satu-satu kalau ada yang error.
const MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free"
];

const SYSTEM_PROMPT = `
Kamu adalah "Rojak AI", asisten khusus untuk Rojak DriveK1t.

Tujuan utama:
- Membantu pengguna memahami dan menggunakan Rojak DriveK1t.
- Membantu pengguna mencari dan menulis rumus Excel.
- Menjelaskan alur penyimpanan rumus ke Google Drive dengan sederhana.
- Jangan mengarang fitur Rojak DriveK1t yang tidak diketahui.

ALUR ROJAK DRIVEK1T:
1. Guru mengirim tugas Excel.
2. Cari rumus yang diperlukan.
3. Masukkan rumus ke Rojak DriveK1t.
4. Buka PC sekolah.
5. Masuk ke Google Drive.
6. Cari dan buka file rumus.
7. Copy rumus.
8. Buka Microsoft Excel.
9. Pilih sel yang diperlukan.
10. Paste rumus.

GAYA JAWABAN:
- Bahasa Indonesia natural, jelas, dan mudah dipahami pelajar.
- Tidak terlalu formal dan tidak kaku.
- Jangan menggunakan emoji.
- Jangan menggunakan karakter dekoratif yang tidak diperlukan.
- Gunakan heading bila membantu.
- Gunakan paragraf yang rapi.
- Gunakan bold untuk istilah penting.
- Gunakan code block untuk rumus atau kode yang panjang.
- Jangan membuat tampilan jawaban seperti template AI/SaaS.

ATURAN PALING PENTING UNTUK DAFTAR BERNOMOR:
- Dalam satu tutorial/prosedur, gunakan SATU daftar bernomor dari awal sampai akhir.
- Jangan membuat daftar bernomor baru setelah bullet list.
- Jangan menggunakan bullet list (-, *, +) di tengah daftar langkah utama.
- Jika sebuah langkah mempunyai rincian seperti Nama, Isi, dan tombol, jadikan rincian tersebut sebagai paragraf di dalam langkah itu, BUKAN bullet list.
- Jangan mengulang nomor ke 1 dalam tutorial yang sama.
- Nomor harus selalu naik 1, 2, 3, 4, 5, dan seterusnya.

FORMAT YANG BENAR:
1. Guru mengirim tugas Excel.
2. Cari rumus yang diperlukan.
3. Masukkan rumus ke Rojak DriveK1t.

   **Nama:** isi nama file yang mudah dikenali.

   **Isi:** masukkan rumus Excel.

   Tekan **Buat File**.

4. Buka PC sekolah.
5. Masuk ke Google Drive.

FORMAT YANG DILARANG:
1. Guru mengirim tugas Excel.
2. Cari rumus.
3. Masukkan ke Rojak DriveK1t.
- Nama: ...
- Isi: ...
1. Buka PC sekolah.

ATURAN RINCIAN LANGKAH:
Jika perlu menjelaskan Nama, Isi, atau tombol di dalam langkah, gunakan format paragraf seperti:
**Nama:** isi nama file.
**Isi:** tempel rumus Excel di sini.
Tekan **Buat File**.

Jangan mengawali rincian tersebut dengan tanda "-".

ATURAN RUMUS EXCEL:
- Berikan rumus yang bisa langsung dicopy.
- Pengguna menggunakan koma sebagai pemisah argumen Excel.
- Jika rumus panjang, gunakan fenced code block.
- Jelaskan fungsi rumus secara singkat bila diperlukan.
`.trim();

/* ---------- HELPERS ---------- */

function safeText(str, max) {
  if (typeof str !== "string") return "";
  return str.slice(0, max || 4000);
}

function extractReply(choices) {
  if (!choices || !choices.length) return "";
  const msg = choices[0].message;
  if (!msg) return "";
  const content = msg.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map(p => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object") return p.text || "";
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

function buildMessages(messagesIn) {
  const trimmed = messagesIn.slice(-16);
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  for (const m of trimmed) {
    if (!m || typeof m !== "object") continue;
    const role = m.role === "assistant" ? "assistant" : "user";
    const content = safeText(m.content, 2000);
    if (!content) continue;
    messages.push({ role, content });
  }

  return messages;
}

async function callOpenRouter(apiKey, model, messages) {
  return fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://rojok-drivek1t.vercel.app",
      "X-OpenRouter-Title": "Rojak DriveK1t"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      max_tokens: 1500
    })
  });
}

/* ---------- HANDLER ---------- */

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "NO_API_KEY",
      message: "Rojak AI belum dikonfigurasi. Silakan periksa Environment Variables."
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (_) { body = null; }
  }
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "BAD_BODY" });
  }

  const messagesIn = Array.isArray(body.messages) ? body.messages : [];

  if (messagesIn.length === 0) {
    return res.status(400).json({
      error: "EMPTY_MESSAGES",
      message: "Tidak ada pesan yang dikirim."
    });
  }

  const messages = buildMessages(messagesIn);

  /* ---- FALLBACK MULTI-MODEL ---- */

  let lastStatus = 0;

  for (const model of MODELS) {
    console.log("[Rojak AI] Mencoba model:", model);

    let upstreamRes;
    try {
      upstreamRes = await callOpenRouter(apiKey, model, messages);
    } catch (err) {
      console.error("[Rojak AI] Fetch failed for", model, ":", err.message);
      continue;
    }

    lastStatus = upstreamRes.status;

    // Rate limit / model tidak ada / server error → coba model berikutnya
    if (upstreamRes.status === 429 || upstreamRes.status === 404 || upstreamRes.status >= 500) {
      console.warn("[Rojak AI] Model", model, "gagal dengan status", upstreamRes.status);
      continue;
    }

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text().catch(() => "");
      console.error("[Rojak AI] Error:", upstreamRes.status, errText);

      let message = "Maaf, Rojak AI sedang mengalami masalah. Coba lagi beberapa saat.";
      if (upstreamRes.status === 401 || upstreamRes.status === 403) {
        message = "Rojak AI belum dikonfigurasi dengan benar. Hubungi admin.";
      }
      return res.status(502).json({ error: "UPSTREAM_ERROR", message });
    }

    let data;
    try {
      data = await upstreamRes.json();
    } catch (err) {
      console.error("[Rojak AI] JSON parse error");
      continue;
    }

    const choices = data && data.choices;
    if (!choices || choices.length === 0) continue;

    const reply = extractReply(choices);
    if (!reply) continue;

    // Filter safety metadata bocor
    if (/user safety.*safe.*response safety.*safe/i.test(reply) && reply.length < 100) {
      continue;
    }

    console.log("[Rojak AI] Berhasil via:", model);
    return res.status(200).json({ reply });
  }

  /* ---- Semua model gagal ---- */

  console.error("[Rojak AI] Semua model gagal. Last status:", lastStatus);

  let message = "Maaf, Rojak AI sedang sibuk. Coba lagi sebentar ya.";
  if (lastStatus === 429) {
    message = "Rojak AI lagi rame. Tunggu 1-2 menit lalu coba lagi ya.";
  }

  return res.status(502).json({
    error: "ALL_MODELS_FAILED",
    message
  });
};
