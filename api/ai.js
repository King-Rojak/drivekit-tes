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

    const systemPrompt = `
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
- Jangan menulis ulang nomor berdasarkan bagian baru.
- Jika ada rincian setelah langkah 3, langkah berikutnya tetap 4.

FORMAT YANG BENAR:
1. Guru mengirim tugas Excel.
2. Cari rumus yang diperlukan.
3. Masukkan rumus ke Rojak DriveK1t.

   **Nama:** isi nama file yang mudah dikenali.

   **Isi:** masukkan rumus Excel.

   Tekan **Buat File**.

4. Buka PC sekolah.
5. Masuk ke Google Drive.
6. Buka file rumus.
7. Copy rumus.
8. Buka Microsoft Excel.
9. Pilih sel.
10. Paste rumus.

FORMAT YANG DILARANG:
1. Guru mengirim tugas Excel.
2. Cari rumus.
3. Masukkan ke Rojak DriveK1t.
- Nama: ...
- Isi: ...
- Tekan Buat File.
1. Buka PC sekolah.
2. Masuk Google Drive.

Jangan membuat format seperti contoh yang dilarang.

ATURAN RINCIAN LANGKAH:
Jika perlu menjelaskan Nama, Isi, atau tombol di dalam langkah 3, gunakan format paragraf seperti:
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

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.SITE_URL || "https://rojok-drivek1t.vercel.app",
          "X-Title": "Rojak DriveK1t"
        },
        body: JSON.stringify({
          // Pakai openrouter/free — auto-route ke model gratis yang tersedia
          model: process.env.OPENROUTER_MODEL || "openrouter/free",
          messages: [
            { role: "system", content: systemPrompt },
            ...cleanMessages
          ],
          temperature: 0.4,
          max_tokens: 4096
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[Rojak AI] OpenRouter error:", response.status, data);

      let message = "Maaf, Rojak AI sedang mengalami masalah. Coba lagi beberapa saat.";
      if (response.status === 429) {
        message = "Rojak AI lagi rame. Tunggu 1-2 menit lalu coba lagi ya.";
      } else if (response.status === 401 || response.status === 403) {
        message = "Rojak AI belum dikonfigurasi dengan benar. Hubungi admin.";
      } else if (response.status === 402) {
        message = "Saldo OpenRouter habis. Silakan top-up di openrouter.ai/settings/credits";
      }

      return res.status(response.status).json({
        error: "UPSTREAM_ERROR",
        message
      });
    }

    const answer =
      data?.choices?.[0]?.message?.content ||
      "Maaf, Rojak AI tidak mendapatkan jawaban.";

    // Kirim dalam format { reply } sesuai frontend kita
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
