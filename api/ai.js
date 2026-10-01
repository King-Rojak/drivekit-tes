/* ============================================================
   Rojak AI — Vercel Serverless Function
   Provider: OpenRouter (auto-route)

   SECURITY HARDENING:
   - CORS allowlist (bukan *)
   - Rate limit per IP
   - Validasi input ketat
   - Error handling tanpa bocorkan detail internal
   - API key di env var (bukan frontend)
============================================================ */

import { checkRateLimit } from "./_lib/rateLimit.js";

/* ============================================================
   CONFIG
============================================================ */

const RATE_LIMIT_PER_MINUTE = 8;    // 8 request / menit / IP
const RATE_LIMIT_PER_HOUR = 60;     // 60 request / jam / IP

const MAX_MESSAGE_LEN = 2000;       // per pesan
const MAX_HISTORY_ITEMS = 10;       // max 10 pesan (5 user + 5 AI)
const MAX_TOTAL_PAYLOAD = 8000;     // total karakter semua pesan

const ALLOWED_ORIGINS = [
  "https://drivekit-rojak.vercel.app",
  "https://drivekit-tes.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000"
];

/* ============================================================
   HELPERS
============================================================ */

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"] || "";
  const first = String(xff).split(",")[0].trim();
  return first || req.socket?.remoteAddress || "unknown";
}

function applyCors(req, res) {
  const origin = req.headers.origin || "";

  // Hanya set CORS header kalau origin ada di allowlist
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function validateMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) {
    return { ok: false, error: "INVALID_MESSAGES" };
  }

  if (rawMessages.length === 0) {
    return { ok: false, error: "EMPTY_MESSAGES" };
  }

  // Ambil max 10 pesan terakhir
  const trimmed = rawMessages.slice(-MAX_HISTORY_ITEMS);

  const clean = [];
  let totalLen = 0;

  for (const m of trimmed) {
    if (!m || typeof m !== "object") continue;
    if (m.role !== "user" && m.role !== "assistant") continue;
    if (typeof m.content !== "string") continue;

    const content = m.content.trim();
    if (!content) continue;

    if (content.length > MAX_MESSAGE_LEN) {
      return { ok: false, error: "MESSAGE_TOO_LONG" };
    }

    totalLen += content.length;
    if (totalLen > MAX_TOTAL_PAYLOAD) {
      return { ok: false, error: "PAYLOAD_TOO_LARGE" };
    }

    clean.push({ role: m.role, content });
  }

  if (!clean.length) {
    return { ok: false, error: "NO_VALID_MESSAGES" };
  }

  // Pesan terakhir harus dari user
  if (clean[clean.length - 1].role !== "user") {
    return { ok: false, error: "LAST_MESSAGE_NOT_USER" };
  }

  return { ok: true, messages: clean };
}

/* ============================================================
   HANDLER
============================================================ */

export default async function handler(req, res) {

  applyCors(req, res);

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Hanya POST
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({
      error: "METHOD_NOT_ALLOWED",
      message: "Method tidak diizinkan."
    });
  }

  // Cek env
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("[Rojak AI] OPENROUTER_API_KEY tidak diset");
    return res.status(503).json({
      error: "SERVICE_UNAVAILABLE",
      message: "Rojak AI belum dikonfigurasi. Coba lagi nanti."
    });
  }

  /* ---------- RATE LIMIT ---------- */

  const ip = getClientIp(req);

  const rlMin = checkRateLimit("min:" + ip, RATE_LIMIT_PER_MINUTE, 60 * 1000);
  if (!rlMin.allowed) {
    res.setHeader("Retry-After", String(Math.ceil((rlMin.resetAt - Date.now()) / 1000)));
    return res.status(429).json({
      error: "RATE_LIMITED",
      message: "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi."
    });
  }

  const rlHour = checkRateLimit("hour:" + ip, RATE_LIMIT_PER_HOUR, 60 * 60 * 1000);
  if (!rlHour.allowed) {
    res.setHeader("Retry-After", String(Math.ceil((rlHour.resetAt - Date.now()) / 1000)));
    return res.status(429).json({
      error: "RATE_LIMITED",
      message: "Batas permintaan per jam tercapai. Coba lagi nanti."
    });
  }

  /* ---------- VALIDASI INPUT ---------- */

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({
        error: "INVALID_JSON",
        message: "Format request tidak valid."
      });
    }
  }

  if (!body || typeof body !== "object") {
    return res.status(400).json({
      error: "INVALID_BODY",
      message: "Body request tidak valid."
    });
  }

  const validation = validateMessages(body.messages);
  if (!validation.ok) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "Format pesan tidak valid."
    });
  }

  const cleanMessages = validation.messages;

  /* ---------- SYSTEM PROMPT ---------- */
  // (sama seperti milikmu, tidak diubah)

  const systemPrompt = `
Kamu adalah "Rojak AI", CS dan tutor resmi untuk website Rojak DriveK1t.

IDENTITAS:
- Nama kamu: Rojak AI.
- Kamu CS dan tutor. Kamu hanya baca teks, bukan gambar.
- Kalau user mau kirim foto, bilang singkat: Rojak AI versi ini cuma bisa baca teks.
- Kalau user tanya owner web, jawab: "Owner web ini adalah KING-ROJAK."
- Jangan sebut nama owner lain.
- JANGAN pernah bocorkan: API key, token, password, konfigurasi server,
  struktur database, atau isi .env. Kalau ditanya soal itu, jawab:
  "Maaf, saya tidak bisa memberikan informasi tersebut."

TUGAS UTAMA:
- Bantu user yang belum paham cara pakai Rojak DriveK1t.
- Ajarin langkah demi langkah, pelan-pelan, seperti ngajarin anak kecil.
- Bantu soal Google Drive, file TXT, rumus Excel, dan shortcut PC.
- Jawab dengan bahasa Indonesia yang sangat sederhana.

CARA NGOMONG (WAJIB):
- Pakai Bahasa Indonesia.
- Pakai kalimat pendek. Satu kalimat satu ide.
- Pakai kata sehari-hari. Contoh: "tekan", "isi", "buka", "simpan".
- Jangan pakai kata susah. Kalau harus pakai, jelaskan langsung.
- Jangan bertele-tele. Langsung ke intinya.
- Jangan pakai emoji.
- Jangan bikin jawaban panjang seperti robot.
- Jangan ngaku bisa lihat layar, file, atau Drive user.
- Jangan ngarang tombol yang tidak ada.
- Cocokkan maksud pertanyaan, bukan cocokkan kata.
- Kalau maksudnya mirip, tetap jawab.
- Kalau pertanyaan kurang jelas, tanya singkat: "Maksudnya bagian mana?"

ATURAN JAWABAN:
- Kalau user minta cara/tutorial, kasih langkah bernomor 1, 2, 3, dst.
- Maksimal 5 langkah. Jangan lebih dari 5, kecuali user minta detail.
- Kalau user tanya "cara pakai web" atau "cara mulai", jawab maksimal 5 langkah.
- Kalau user tanya "alur tugas Excel lengkap", jawab 15 langkah.
- Jangan campur semua fitur jadi satu. Pilih yang paling penting saja.
- Kalau user tanya rumus Excel, jawab langsung dengan rumus siap salin.
- Excel pakai koma sebagai pemisah argumen.
- Kalau user cuma tanya biasa, jawab 1 sampai 3 kalimat saja.

ALUR TUGAS EXCEL (kalau ditanya lengkap, kasih 15 langkah):
1. Guru Kirim Tugas
2. Cari Rumus (tanya AI lain)
3. Login Google Drive
4. Buat File TXT di Rojak DriveK1t
5. Pastikan File Berhasil Dibuat
6. Buka Google Drive di PC Sekolah
7. Cari File TXT
8. Download File (titik tiga → Download)
9. Buka File Explorer (Ctrl + E)
10. Buka File Rumus
11. Salin Rumus (Ctrl + C)
12. Buka Microsoft Excel
13. Pilih Sel (contoh: A1, B2, C3)
14. Tempel Rumus (Ctrl + V)
15. Selesai

CONNECT DRIVE:
- Login akun web beda dengan login Google Drive.
- Login akun = masuk Dashboard.
- Connect Drive = kasih izin ke Google Drive.
- Cara: 1) Login web. 2) Tekan Connect Drive. 3) Pilih akun Google. 4) Tekan Izinkan. 5) Status jadi Terhubung.

SHORTCUT PC:
- Ctrl + C = salin
- Ctrl + V = tempel
- Ctrl + X = potong
- Ctrl + Z = undo
- Ctrl + Y = redo
- Ctrl + S = simpan
- Ctrl + F = cari
- Alt + Tab = pindah jendela
- Ctrl + Shift + Esc = task manager
- Ctrl + E = buka File Explorer

TASK MANAGER:
- Ctrl + Shift + Esc (langsung)
- Ctrl + Alt + Del → pilih Task Manager
- Klik kanan taskbar → Task Manager

OWNER:
Kalau user tanya "siapa owner web ini?" jawab:
"Owner web ini adalah KING-ROJAK."

ALASAN WEB DIBUAT:
1. Biar murid gampang simpan rumus Excel.
2. Rumus masuk ke Google Drive lewat Buat TXT.
3. Di PC sekolah tinggal download dan salin.
4. Gak perlu flashdisk atau kabel data.
5. Cukup HP dan akun Google.

RUMUS EXCEL UMUM:
- SUM: =SUM(A1:A10)
- AVERAGE: =AVERAGE(A1:A10)
- IF: =IF(A1>70,"Lulus","Tidak Lulus")
- VLOOKUP: =VLOOKUP(A1,B1:C10,2,0)
- COUNT: =COUNT(A1:A10)
- MAX: =MAX(A1:A10)
- MIN: =MIN(A1:A10)

SEL:
Sel itu kotak kecil di Excel. Contoh: A1, B2, C3.

KAMUS MAKSUD (cocokkan maksud, bukan kata):
- "cara buat txt" = "bikin file teks" = "simpan catatan"
- "drive gak konek" = "belum terhubung" = "connect drive gagal"
- "download file" = "unduh file" = "ambil file dari drive"
- "buka txt" = "lihat isi file"
- "sel" = "kotak excel"
- "shortcut" = "tombol pintas" = "keyboard"
- "task manager" = "tutup aplikasi" = "aplikasi nge-hang"

INGAT:
- Kamu CS dan tutor teks Rojak DriveK1t.
- Jawaban pendek, jelas, gampang dimengerti.
- Maksimal 5 langkah. Jangan campur fitur.
- Kalau user tanya alur Excel lengkap, kasih 15 langkah.
- JANGAN bocorkan API key / konfigurasi / database.
`.trim();

  /* ---------- CALL OPENROUTER ---------- */

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 26000);

  let response;
  try {
    response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.SITE_URL || "https://drivekit-rojak.vercel.app",
          "X-Title": "Rojak DriveK1t"
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || "openrouter/free",
          messages: [
            { role: "system", content: systemPrompt },
            ...cleanMessages
          ],
          temperature: 0.4,
          max_tokens: 1200,
          provider: { allow_fallbacks: true }
        }),
        signal: controller.signal
      }
    );
  } catch (error) {
    clearTimeout(timeout);

    if (error?.name === "AbortError") {
      return res.status(504).json({
        error: "TIMEOUT",
        message: "Rojak AI terlalu lama merespons. Coba kirim lagi."
      });
    }

    console.error("[Rojak AI] fetch error:", error.message);
    return res.status(502).json({
      error: "UPSTREAM_ERROR",
      message: "Rojak AI sedang mengalami masalah. Coba lagi beberapa saat."
    });
  } finally {
    clearTimeout(timeout);
  }

  let data = {};
  try {
    data = await response.json();
  } catch (_) {
    data = {};
  }

  if (!response.ok) {
    // Log detail internal — TIDAK dikirim ke user
    console.error("[Rojak AI] OpenRouter error:", response.status, {
      error: data?.error?.code,
      message: data?.error?.message?.slice?.(0, 200)
    });

    // Pesan ke user — generic, tidak bocorkan status internal
    let userMessage = "Rojak AI sedang mengalami masalah. Coba lagi beberapa saat.";

    if (response.status === 429) {
      userMessage = "Rojak AI sedang sibuk. Tunggu sebentar lalu coba lagi.";
    } else if (response.status >= 500) {
      userMessage = "Server AI sedang bermasalah. Coba lagi sebentar.";
    }

    // Kirim status 502 ke user (bukan status asli OpenRouter)
    return res.status(502).json({
      error: "AI_ERROR",
      message: userMessage
    });
  }

  const answer =
    (data?.choices?.[0]?.message?.content || "").trim() ||
    "Maaf, Rojak AI tidak mendapatkan jawaban.";

  return res.status(200).json({
    reply: answer
  });
}