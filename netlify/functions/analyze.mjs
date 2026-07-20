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

// ── SYSTEM PROMPTS ────────────────────────────────────────────────────────────
const PROMPTS = {
  penulisan: `Anda adalah asisten penulisan peraturan LPS (Lembaga Penjamin Simpanan) Indonesia yang ahli dalam hukum perbankan dan teknik perundang-undangan.

Tugas Anda membantu penulis peraturan dengan:
1. Memperbaiki konsistensi bahasa dan istilah sesuai peraturan LPS yang sudah ada
2. Memastikan struktur penulisan sesuai teknik perundang-undangan Indonesia (UU No. 12/2011)
3. Menggunakan bahasa hukum Indonesia yang baku dan tepat
4. Menjaga konsistensi definisi dengan peraturan yang hierarkinya lebih tinggi

Format respons:
**Saran Perbaikan**: jelaskan apa yang perlu diperbaiki dan MENGAPA
**Versi Perbaikan**: berikan kalimat/pasal yang sudah diperbaiki
**Dasar Acuan**: sebutkan pasal/peraturan yang menjadi acuan

Bahasa respons: Indonesia formal.`,

  referensi: `Anda adalah analis hukum peraturan LPS (Lembaga Penjamin Simpanan) Indonesia yang ahli.

Tugas Anda mengidentifikasi peraturan yang harus dijadikan referensi/acuan saat membuat peraturan baru.

Format respons:
**Peraturan Wajib Diacu**: peraturan yang HARUS dicantumkan sebagai dasar hukum
**Peraturan Terkait**: peraturan yang perlu diharmonisasikan
**Potensi Konflik**: aspek yang perlu diselaraskan
**Hierarki**: urutan dari tertinggi ke terendah

Bahasa respons: Indonesia formal.`,

  tanya: `Anda adalah narasumber ahli peraturan LPS (Lembaga Penjamin Simpanan) Indonesia.

Jawab pertanyaan berdasarkan konteks peraturan yang diberikan dengan:
- Jawaban langsung dan jelas
- Menyebut nomor pasal dan nama peraturan sumber
- Penjelasan praktis jika relevan
- Jika tidak tersedia dalam konteks, nyatakan dengan jelas

Bahasa respons: Indonesia.`
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
      model      : "llama-3.3-70b-versatile",  // model gratis terbaik di Groq
      temperature: 0.3,
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
  const pasal = cariPasal(teks, 6);

  const konteks = pasal.length > 0
    ? pasal.map(p =>
        `[${p.id}] ${p.judul_peraturan} — ${p.pasal}` +
        (p.judul_pasal ? `: ${p.judul_pasal}` : "") + "\n" +
        `Level: ${p.level} | Skor: ${p.skor}\n` +
        `Isi: ${p.isi}`
      ).join("\n\n---\n\n")
    : "Tidak ditemukan pasal yang relevan dalam database.";

  const promptUser = {
    penulisan:
      `KONTEKS PERATURAN LPS (${pasal.length} pasal relevan dari ${db.length} total):\n\n${konteks}\n\n---\n` +
      `TEKS YANG PERLU DIPERIKSA:\n${teks}\n\nBerikan saran perbaikan yang spesifik.`,
    referensi:
      `PERATURAN LPS YANG RELEVAN (${pasal.length} pasal dari ${db.length} total):\n\n${konteks}\n\n---\n` +
      `TOPIK PERATURAN YANG DIBUAT:\n${teks}\n\nIdentifikasi peraturan acuan dan potensi konflik.`,
    tanya:
      `KONTEKS PERATURAN LPS (${pasal.length} pasal relevan dari ${db.length} total):\n\n${konteks}\n\n---\n` +
      `PERTANYAAN:\n${teks}`
  }[mode];

  try {
    const respons = await panggilGroq(PROMPTS[mode], promptUser, apiKey);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        respons,
        referensi         : pasal,
        total_pasal_dicari: db.length,
        info_database     : `Database: ${db.length} pasal aktif · Ditenagai Llama 3 (Groq)`
      })
    };
  } catch (err) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "Error Groq AI: " + err.message })
    };
  }
};
