# 🚀 Panduan Deploy ke Netlify

## Struktur Folder
```
lps-netlify/
├── netlify.toml                    ← Konfigurasi Netlify
├── public/
│   └── index.html                  ← Halaman web utama
└── netlify/
    └── functions/
        └── analyze.mjs             ← Fungsi backend (panggil Claude AI)
```

---

## Langkah 1 — Dapatkan API Key Anthropic
1. Buka https://console.anthropic.com/
2. Daftar / login
3. Klik **API Keys** → **Create Key**
4. Salin key-nya (bentuk: `sk-ant-api03-xxxx...`)

---

## Langkah 2 — Upload ke GitHub
1. Buka https://github.com dan login (atau daftar gratis)
2. Klik tombol **"+"** → **New repository**
3. Nama: `lps-ai-peraturan` → klik **Create repository**
4. Di halaman repository baru, klik **"uploading an existing file"**
5. Drag & drop **seluruh isi folder** `lps-netlify` ini
6. Klik **Commit changes**

---

## Langkah 3 — Deploy ke Netlify
1. Buka https://netlify.com → Login dengan akun GitHub
2. Klik **"Add new site"** → **"Import an existing project"**
3. Pilih **GitHub** → pilih repository `lps-ai-peraturan`
4. Pengaturan build (biarkan default, sudah ada `netlify.toml`):
   - Build command: *(kosongkan)*
   - Publish directory: `public`
5. Klik **Deploy site**

---

## Langkah 4 — Set API Key di Netlify
1. Di dashboard Netlify, klik site Anda
2. Klik **Site configuration** → **Environment variables**
3. Klik **Add a variable**:
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-api03-xxxx...` *(API key Anda)*
4. Klik **Save**
5. Kembali ke **Deploys** → klik **Trigger deploy** → **Deploy site**

---

## ✅ Selesai!
Netlify akan memberikan URL seperti: `https://lps-ai-peraturan.netlify.app`

Aplikasi bisa langsung diakses siapa saja tanpa perlu install apapun.

---

## Menambah Data Peraturan
Edit file `netlify/functions/analyze.mjs`, cari array `PERATURAN_LPS`, tambahkan:
```javascript
{
  id: "PLPS-013",
  judul: "Nama Peraturan",
  level: "Peraturan Utama",
  pasal: "Pasal 1",
  isi: "Isi peraturan...",
  kata_kunci: ["kata1", "kata2"]
},
```
Simpan dan push ke GitHub → Netlify otomatis deploy ulang.

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| "API key belum dikonfigurasi" | Pastikan sudah set `ANTHROPIC_API_KEY` di Netlify Environment Variables |
| Function error | Cek **Functions** tab di Netlify dashboard untuk log error |
| Halaman tidak terbuka | Pastikan file `public/index.html` ada dan `netlify.toml` sudah benar |
