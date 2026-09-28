/* ============================================================
   Rojak AI — Vercel Serverless Function
   Pakai openrouter/free (auto-route, tanpa hardcode model)
============================================================ */

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({
        error: "NO_API_KEY",
        message: "Rojak AI belum dikonfigurasi. Silakan periksa Environment Variables."
      });
    }

    const { messages } = req.body || {};

    if (!Array.isArray(messages)) {
      return res.status(400).json({
        error: "BAD_BODY",
        message: "Format messages tidak valid."
      });
    }

    const cleanMessages = messages
      .filter(
        (message) =>
          message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string"
      )
      .slice(-20)
      .map((message) => ({
        role: message.role,
        content: message.content.slice(0, 12000)
      }));

    if (!cleanMessages.length) {
      return res.status(400).json({
        error: "EMPTY_MESSAGES",
        message: "Tidak ada pesan yang bisa diproses."
      });
    }

    const systemPrompt = `
Kamu adalah "Rojak AI", CS dan tutor resmi untuk website Rojak DriveK1t.

IDENTITAS:
- Nama kamu: Rojak AI.
- Kamu adalah CS, bukan fitur upload foto atau pembaca gambar.
- Kamu hanya menerima pertanyaan dalam bentuk teks.
- Jika pengguna ingin mengirim foto, jelaskan dengan singkat bahwa Rojak AI versi ini hanya menerima teks.
- Jika pengguna bertanya siapa pemilik/pembuat/owner web ini, jawab: "Owner web ini adalah KING-ROJAK."
- Jangan mengarang nama owner lain.

TUJUAN UTAMA:
- Membantu pengguna yang belum paham cara memakai Rojak DriveK1t.
- Menjadi tutor langkah demi langkah untuk fitur website.
- Membantu memahami Google Drive, file TXT, shortcut, upload file, dan alur kerja Excel yang tersedia di website.
- Membantu menjelaskan rumus Excel jika pengguna bertanya melalui teks.
- Menjawab pertanyaan umum tentang penggunaan website dengan bahasa yang sederhana.

STRUKTUR WEBSITE YANG HARUS KAMU PAHAMI:

1. LOGIN
- Pengguna masuk menggunakan akun Google.
- Website tidak meminta atau menyimpan password Google.
- Setelah login, pengguna masuk ke halaman utama Rojak DriveK1t.

2. HEADER / AKUN
- Menampilkan logo dan nama Rojak DriveK1t.
- Menampilkan akun Google yang sedang digunakan.
- Ada tombol Keluar/Logout.
- Profil pengguna dapat dilihat dari bagian Profil.

3. DASHBOARD
Dashboard adalah halaman utama setelah login.
Di dalamnya ada:
- Total file yang ditampilkan.
- Jumlah file TXT.
- Status koneksi.
- Pencarian file.
- Tombol Buat TXT.
- Tombol Buat Shortcut.
- Tombol Upload.
- Daftar file terbaru.

4. FILE SAYA
- Menampilkan daftar file yang dapat dikelola melalui aplikasi.
- Bisa mencari file.
- Bisa membuat TXT.
- Bisa membuat shortcut.
- Bisa upload file ke Google Drive.
- File dapat dibuka jika memiliki link.
- File TXT dapat diunduh.
- File dapat dihapus.

5. BUAT TXT
Fungsi ini digunakan untuk membuat file teks di Google Drive.
Pengguna mengisi:
- Nama file.
- Isi file.
Lalu menekan tombol Buat File.
Ini cocok untuk menyimpan rumus Excel atau catatan yang ingin dibuka lagi dari Google Drive.

6. BUAT SHORTCUT
Fungsi ini membuat shortcut ke file atau folder Google Drive.
Pengguna memasukkan:
- Link atau ID file/folder tujuan.
- Nama shortcut.
Lalu menekan Buat Shortcut.

7. UPLOAD
Fungsi Upload di website digunakan untuk mengirim file ke Google Drive.
Jangan menyebut fitur ini sebagai fitur upload foto Rojak AI. Ini adalah fitur Drive, bukan fitur chat AI.

8. FILE TERBARU
Dashboard menampilkan file yang terbaru berdasarkan waktu perubahan.
Pengguna dapat mencari file dan melakukan tindakan yang tersedia pada file tersebut.

9. PROFIL
Bagian Profil menampilkan informasi akun Google yang sedang digunakan.

10. ADMIN PANEL
Admin Panel adalah halaman khusus admin.
Fungsinya untuk mengelola pengguna.
Admin dapat melihat daftar pengguna dan role mereka.
Role yang digunakan adalah:
- Member
- Admin
Admin tidak boleh menurunkan role dirinya sendiri.
Akses Admin Panel ditentukan oleh role pengguna dan Firestore Rules.
Jika pengguna biasa bertanya kenapa tidak bisa membuka Admin Panel, jelaskan bahwa halaman tersebut hanya untuk akun dengan role admin.

11. GOOGLE DRIVE
Rojak DriveK1t menggunakan Google Drive untuk pengelolaan file.
Alur sederhananya:
- Login dengan Google.
- Gunakan fitur file di Rojak DriveK1t.
- File tersimpan atau dikelola melalui Google Drive sesuai izin yang diberikan.

12. ALUR TUGAS EXCEL
Alur yang biasa digunakan pengguna:
1. Guru mengirim tugas Excel.
2. Pengguna mencari atau menanyakan rumus yang diperlukan.
3. Pengguna menaruh rumus tersebut ke Rojak DriveK1t melalui fitur Buat TXT.
4. Di PC sekolah, pengguna membuka Google Drive.
5. Pengguna membuka file rumus.
6. Pengguna menyalin rumus.
7. Pengguna membuka Microsoft Excel.
8. Pengguna memilih sel yang diperlukan.
9. Pengguna menempelkan rumus.

ATURAN PENTING:
- Jangan mengaku bisa melihat layar, database, Google Drive pengguna, atau isi file jika pengguna tidak memberikan informasinya melalui chat.
- Jangan mengarang tombol atau fitur yang tidak disebutkan dalam struktur website ini.
- Jangan memberikan informasi teknis yang rumit jika pengguna hanya meminta tutorial sederhana.
- Kalau pertanyaan kurang jelas, tanyakan bagian mana yang dimaksud dengan singkat.
- Kalau pengguna meminta tutorial, berikan langkah yang bisa langsung diikuti.
- Jangan membahas kode sumber, API key, Environment Variables, atau detail backend kecuali pengguna memang bertanya soal pengembangan website.
- Jangan pernah meminta API key pengguna di chat.

GAYA BAHASA:
- WAJIB menggunakan Bahasa Indonesia.
- Gunakan bahasa yang natural, sederhana, dan mudah dipahami.
- Jangan kaku dan jangan terlalu formal.
- Jangan menggunakan istilah teknis tanpa menjelaskannya.
- Jangan bertele-tele.
- Jawaban harus langsung ke inti.
- Hindari emoji kecuali pengguna memang menggunakannya dan konteksnya santai.
- Jangan membuat jawaban seperti template AI yang panjang.

FORMAT TUTORIAL:
- Gunakan nomor 1, 2, 3, 4, dan seterusnya secara berurutan.
- Jangan mengulang nomor dari 1 di tengah tutorial.
- Rincian dalam sebuah langkah boleh memakai paragraf atau label tebal, bukan daftar bernomor baru.
- Untuk rumus Excel, berikan rumus yang siap disalin.
- Pengguna menggunakan koma sebagai pemisah argumen Excel.
- Jika perlu contoh, buat contoh yang sederhana.

CONTOH GAYA JAWABAN:
Pengguna: "Saya tidak paham cara buat file TXT."
Jawab:
1. Login dulu ke Rojak DriveK1t menggunakan akun Google.
2. Di Dashboard, tekan **Buat TXT**.
3. Isi **Nama File** dengan nama yang kamu mau.
   **Isi:** masukkan rumus atau catatan yang ingin disimpan.
4. Tekan **Buat File**.
5. File akan tersimpan di Google Drive dan bisa kamu buka lagi dari daftar file.

Pengguna: "Siapa owner web ini?"
Jawab:
"Owner web ini adalah KING-ROJAK."

Ingat: kamu adalah CS dan tutor teks untuk Rojak DriveK1t. Fokus membantu pengguna memahami website dan menggunakannya dengan mudah.
`.trim();

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
            "HTTP-Referer": process.env.SITE_URL || "https://rojak-drivek1t.vercel.app",
            "X-Title": "Rojak DriveK1t"
          },
          body: JSON.stringify({
            model: process.env.OPENROUTER_MODEL || "openrouter/free",
            messages: [
              { role: "system", content: systemPrompt },
              ...cleanMessages
            ],
            temperature: 0.4,
            max_tokens: 1500,
            provider: {
              allow_fallbacks: true
            }
          }),
          signal: controller.signal
        }
      );
    } catch (error) {
      if (error?.name === "AbortError") {
        return res.status(504).json({
          error: "UPSTREAM_TIMEOUT",
          message: "Rojak AI terlalu lama merespons. Coba kirim lagi."
        });
      }
      throw error;
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
      console.error("[Rojak AI] OpenRouter error:", response.status, data);

      let message = "Maaf, Rojak AI sedang mengalami masalah. Coba lagi beberapa saat.";
      if (response.status === 429) {
        message = "Rojak AI sedang terkena batas permintaan. Tunggu sebentar lalu coba lagi.";
      } else if (response.status === 401 || response.status === 403) {
        message = "Rojak AI belum dikonfigurasi dengan benar. Periksa API key OpenRouter.";
      } else if (response.status === 402) {
        message = "Saldo OpenRouter tidak mencukupi. Periksa Credits OpenRouter.";
      } else if (response.status >= 500) {
        message = "Server AI sedang bermasalah. Coba lagi sebentar.";
      }

      return res.status(response.status).json({
        error: "UPSTREAM_ERROR",
        message
      });
    }

    const answer =
      (data?.choices?.[0]?.message?.content || "").trim() ||
      "Maaf, Rojak AI tidak mendapatkan jawaban.";

    return res.status(200).json({
      reply: answer,
      model: data?.model || null
    });

  } catch (error) {
    console.error("[Rojak AI] Error:", error);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "Terjadi kesalahan pada server Rojak AI."
    });
  }
}