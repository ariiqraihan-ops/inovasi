// ── STOP WORDS ────────────────────────────────────────────────────────────────
const STOP = new Set([
  "yang","dan","di","ke","dari","dengan","untuk","dalam","adalah","atau","pada",
  "ini","itu","tidak","dapat","akan","telah","sesuai","oleh","sebagai","serta",
  "juga","tersebut","yaitu","maupun","bahwa","setiap","paling","bagi","antara",
  "atas","bawah","maka","tentang","hal","cara","lebih","satu","dua","tiga",
  "meliputi","melakukan","menyampaikan","dilakukan","ditetapkan","termasuk",
  "merupakan","memiliki","kepada","dimaksud","nomor","tahun","ayat","huruf",
  "angka","undang","peraturan","ketentuan","umum","sebesar","persen","sampai",
  "berupa","melalui","setelah","sejak","apabila","berdasarkan","seluruh","semua",
  "beberapa","suatu","dimana","ketika","masing","perlu","wajib","harus","boleh",
  "tetap","pasal","lain","pihak","lambat","saat","masa","jika","maka"
]);

const ISTILAH = [
  "simpanan","nasabah","penyimpan","bank","penjaminan","lps","premi","klaim",
  "deposito","giro","tabungan","sertifikat","bunga","modal","izin","usaha",
  "pencabutan","resolusi","rekonsiliasi","verifikasi","likuidasi","sistemik",
  "peserta","kontribusi","kepesertaan","laporan","saldo","rekening","valuta",
  "asing","rupiah","agunan","kredit","denda","keterlambatan","sanksi","pembayaran",
  "pengalihan","aset","kewajiban","penggabungan","peleburan","pengambilalihan",
  "penyertaan","stabilitas","perbankan","keuangan","periode","koreksi","pelaporan",
  "tindak","pidana","pembukuan","pengumuman","tingkat","layanan","transaksi",
  "dana","risiko","kepatuhan","tata","kelola","audit","pengawasan","otoritas"
];

function ekstrakKataKunci(isi, judul) {
  const teks = ((judul || "") + " " + (isi || "")).toLowerCase();
  const hasil = new Set();
  for (const ist of ISTILAH) {
    if (teks.includes(ist)) hasil.add(ist);
  }
  const kata = teks.match(/\b[a-z]{4,}\b/g) || [];
  const freq = {};
  for (const k of kata) {
    if (!STOP.has(k)) freq[k] = (freq[k] || 0) + 1;
  }
  for (const [k, f] of Object.entries(freq)) {
    if (f >= 2) hasil.add(k);
  }
  const judulKata = (judul || "").toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  for (const k of judulKata) {
    if (!STOP.has(k)) hasil.add(k);
  }
  return [...hasil].slice(0, 20);
}

// ── MUAT DATABASE ─────────────────────────────────────────────────────────────
let DB = null;

async function muatDB() {
  if (DB) return DB;
  try {
    const path = new URL("../../public/peraturan.json", import.meta.url);
    const res  = await fetch(path);
    const json = await res.json();
    let semuaPasal = [];

    if (json.pasal) {
      semuaPasal = json.pasal.map(p => ({
        id             : p.id || `P-${Math.random().toString(36).slice(2)}`,
        id_peraturan   : p.id_peraturan || p.id?.split('-P')[0] || "UNKNOWN",
        judul_peraturan: p.judul_peraturan || p.id_peraturan || "Peraturan LPS",
        singkatan      : p.singkatan || p.id_peraturan || "",
        level          : p.level || "Peraturan LPS",
        pasal          : p.pasal || "",
        judul_pasal    : p.judul_pasal || "",
        isi            : p.isi || "",
        kata_kunci     : p.kata_kunci?.length ? p.kata_kunci : ekstrakKataKunci(p.isi, p.judul_pasal)
      }));
    } else if (json.peraturan) {
      for (const per of json.peraturan) {
        for (const p of per.pasal) {
          semuaPasal.push({
            id             : p.id,
            id_peraturan   : per.id,
            judul_peraturan: per.judul,
            singkatan      : per.singkatan || per.id,
            level          : per.level,
            pasal          : p.pasal,
            judul_pasal    : p.judul_pasal || "",
            isi            : p.isi,
            kata_kunci     : ekstrakKataKunci(p.isi, p.judul_pasal)
          });
        }
      }
    }

    DB = semuaPasal;
    return DB;
  } catch (err) {
    console.error("Gagal muat DB:", err);
    return [];
  }
}

// ── SCORING ───────────────────────────────────────────────────────────────────
function skorRelevansi(pasal, query) {
  const q    = query.toLowerCase();
  const kata = new Set((q.match(/\b\w{4,}\b/g) || []));
  let skor   = 0;
  for (const k of pasal.kata_kunci) {
    if (q.includes(k.toLowerCase())) skor += 3;
  }
  const isiL = pasal.isi.toLowerCase();
  for (const k of kata) { if (isiL.includes(k)) skor += 1.5; }
  const judulL = (pasal.judul_pasal || "").toLowerCase();
  for (const k of kata) { if (judulL.includes(k)) skor += 4; }
  const perL = (pasal.judul_peraturan || "").toLowerCase();
  for (const k of kata) { if (perL.includes(k)) skor += 2; }
  return Math.round(skor * 10) / 10;
}

function cariPasal(query, topN = 6) {
  if (!DB?.length) return [];
  return DB
    .map(p => ({ ...p, skor: skorRelevansi(p, query) }))
    .filter(p => p.skor > 0)
    .sort((a, b) => b.skor - a.skor)
    .slice(0, topN)
    .map(p => ({
      ...p,
      relevance: p.skor >= 10 ? "Tinggi" : p.skor >= 5 ? "Sedang" : "Rendah"
    }));
}

// ── SYSTEM PROMPTS — STRICT RAG, DILARANG GUNAKAN PENGETAHUAN LUAR ───────────
const PROMPTS = {
  penulisan: `Anda adalah asisten penulisan peraturan internal LPS (Lembaga Penjamin Simpanan).

ATURAN KETAT:
- Anda HANYA boleh menggunakan informasi dari KONTEKS PERATURAN yang diberikan di bawah.
- DILARANG KERAS menggunakan pengetahuan umum, internet, atau referensi peraturan yang TIDAK ADA dalam konteks.
- Jika informasi tidak ada dalam konteks, jawab: "Informasi ini tidak ditemukan dalam database peraturan LPS yang tersedia."
- Setiap saran harus mencantumkan ID pasal sumber dari konteks (contoh: [PLPS-1-2025-P5]).

Tugas Anda:
1. Periksa konsistensi bahasa dan istilah dengan pasal-pasal dalam konteks
2. Pastikan struktur kalimat sesuai dengan gaya penulisan peraturan LPS dalam konteks
3. Identifikasi istilah yang tidak konsisten dengan definisi dalam konteks

Format respons:
**Temuan**: apa yang perlu diperbaiki (dengan referensi ID pasal dari konteks)
**Perbaikan**: versi teks yang sudah diperbaiki
**Acuan**: ID pasal dalam database yang menjadi dasar perbaikan

Bahasa: Indonesia formal.`,

  referensi: `Anda adalah asisten pencari referensi peraturan internal LPS (Lembaga Penjamin Simpanan).

ATURAN KETAT:
- Anda HANYA boleh merujuk pada pasal-pasal yang ADA dalam KONTEKS PERATURAN di bawah.
- DILARANG KERAS menyebut peraturan, undang-undang, atau dokumen yang TIDAK MUNCUL dalam konteks.
- Jika tidak ada pasal relevan dalam konteks, jawab: "Tidak ditemukan peraturan terkait dalam database LPS yang tersedia."
- Setiap referensi HARUS disertai ID pasal dari konteks (contoh: [PLPS-1-2025-P3]).

Tugas Anda:
1. Identifikasi pasal mana dalam konteks yang wajib diacu
2. Jelaskan mengapa pasal tersebut relevan
3. Tunjukkan aspek yang perlu diselaraskan antar pasal dalam konteks

Format respons:
**Pasal Wajib Diacu**: daftar ID pasal dari konteks beserta alasannya
**Perlu Diselaraskan**: aspek yang berpotensi konflik antar pasal dalam konteks
**Tidak Ditemukan**: informasi yang dicari tapi tidak ada dalam database

Bahasa: Indonesia formal.`,

  tanya: `Anda adalah asisten tanya-jawab peraturan internal LPS (Lembaga Penjamin Simpanan).

ATURAN KETAT:
- Anda HANYA boleh menjawab berdasarkan KONTEKS PERATURAN yang diberikan di bawah.
- DILARANG KERAS menjawab menggunakan pengetahuan umum atau referensi di luar konteks.
- Jika jawaban tidak ada dalam konteks, katakan dengan jelas: "Informasi ini tidak tersedia dalam database peraturan LPS yang diunggah."
- Setiap jawaban HARUS menyebut ID pasal sumber dari konteks.

Format respons:
**Jawaban**: berdasarkan konteks yang tersedia
**Sumber**: ID pasal dalam database (contoh: [PLPS-1-2025-P10])
**Keterbatasan**: informasi yang tidak ditemukan dalam database

Bahasa: Indonesia.`
};

// ── GROQ API ──────────────────────────────────────────────────────────────────
async function panggilGroq(sistemPrompt, userPrompt, apiKey) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type" : "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model      : "llama-3.3-70b-versatile",
      temperature: 0.1,   // rendah agar tidak "mengarang"
      max_tokens : 2048,
      messages   : [
        { role: "system", content: sistemPrompt },
        { role: "user",   content: userPrompt   }
      ]
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
  const teks = data.choices?.[0]?.message?.content;
  if (!teks) throw new Error("Groq tidak mengembalikan respons.");
  return teks;
}

// ── NETLIFY HANDLER ───────────────────────────────────────────────────────────
export const handler = async (event) => {
  const headers = {
    "Content-Type"                : "application/json",
    "Access-Control-Allow-Origin" : "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers };
  if (event.httpMethod !== "POST")    return { statusCode: 405, body: "Method Not Allowed" };

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return {
    statusCode: 500, headers,
    body: JSON.stringify({ error: "GROQ_API_KEY belum dikonfigurasi di Netlify Environment Variables." })
  };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Request tidak valid." }) }; }

  const { teks, mode } = body;
  if (!teks?.trim() || !mode) return {
    statusCode: 400, headers,
    body: JSON.stringify({ error: "Teks dan mode diperlukan." })
  };

  const db    = await muatDB();
  const pasal = cariPasal(teks, 8); // ambil lebih banyak konteks

  // ── PERINGATAN JIKA DATABASE KOSONG / BELUM DIISI ────────────────────────
  if (db.length === 0) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        respons: "⚠️ Database peraturan masih kosong atau belum berhasil dimuat. Pastikan file `public/peraturan.json` sudah berisi hasil ekstrak dari Apps Script (hasil_ekstrak.json).",
        referensi: [],
        total_pasal_dicari: 0,
        info_database: "Database kosong — upload hasil_ekstrak.json ke GitHub"
      })
    };
  }

  // ── PERINGATAN JIKA TIDAK ADA PASAL RELEVAN ──────────────────────────────
  const tidakAdaKonteks = pasal.length === 0
    ? "\n\n⚠️ PERHATIAN: Tidak ada pasal dalam database yang relevan dengan pertanyaan ini. Sampaikan kepada pengguna bahwa topik ini belum tercakup dalam database peraturan yang diunggah."
    : "";

  const konteks = pasal.length > 0
    ? pasal.map(p =>
        `[${p.id}] ${p.judul_peraturan} — ${p.pasal}` +
        (p.judul_pasal ? `: ${p.judul_pasal}` : "") + "\n" +
        `Level: ${p.level}\n` +
        `Isi: ${p.isi}`
      ).join("\n\n---\n\n")
    : "TIDAK ADA PASAL YANG RELEVAN DALAM DATABASE.";

  const promptUser = {
    penulisan:
      `KONTEKS PERATURAN LPS DARI DATABASE INTERNAL (${pasal.length} pasal dari ${db.length} total yang diunggah):\n\n${konteks}${tidakAdaKonteks}\n\n` +
      `====\nTEKS PERATURAN YANG PERLU DIPERIKSA:\n${teks}\n\n` +
      `Berikan saran perbaikan HANYA berdasarkan pasal-pasal dalam konteks di atas.`,

    referensi:
      `KONTEKS PERATURAN LPS DARI DATABASE INTERNAL (${pasal.length} pasal dari ${db.length} total yang diunggah):\n\n${konteks}${tidakAdaKonteks}\n\n` +
      `====\nTOPIK PERATURAN YANG SEDANG DIBUAT:\n${teks}\n\n` +
      `Identifikasi HANYA pasal-pasal dalam konteks di atas yang relevan sebagai acuan.`,

    tanya:
      `KONTEKS PERATURAN LPS DARI DATABASE INTERNAL (${pasal.length} pasal dari ${db.length} total yang diunggah):\n\n${konteks}${tidakAdaKonteks}\n\n` +
      `====\nPERTANYAAN:\n${teks}\n\n` +
      `Jawab HANYA berdasarkan pasal-pasal dalam konteks di atas.`
  }[mode];

  try {
    const respons = await panggilGroq(PROMPTS[mode], promptUser, apiKey);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        respons,
        referensi         : pasal,
        total_pasal_dicari: db.length,
        info_database     : `Database: ${db.length} pasal dari peraturan internal LPS · Llama 3 (Groq)`
      })
    };
  } catch (err) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "Error Groq AI: " + err.message })
    };
  }
};
