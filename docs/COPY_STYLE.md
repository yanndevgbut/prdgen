# Panduan Gaya Bahasa & Copywriting PRDGen

Panduan ini mengatur penulisan teks antarmuka, pemasaran, notifikasi, dan email di seluruh produk PRDGen.

---

## 1. Prinsip Utama (Anti AI-Slop)

- **Lugas dan Konkret:** Ganti kata sifat abstrak ("luar biasa", "cepat dan gampang", "tanpa ribet") dengan fakta terukur atau contoh nyata.
- **Dilarang Format Klise AI:**
  - *Contrast reveal:* "Bukan X, tapi Y" atau "Bukan karena X, melainkan Y". Nyatakan fakta langsung.
  - *Negation list:* "Tanpa kartu kredit, tanpa instalasi, tanpa pusing". Cukup sebut fakta positif yang terjadi.
  - *Trailing pile-on:* Kalimat lengkap yang disambung koma bertumpuk ("..., memastikan semua rapi, cepat, dan teratur"). Akhiri kalimat pada klaim utamanya.
  - *Colon reveal:* "Kuncinya: konsistensi". Tulis kalimat normal.
  - *Stock opener:* "Di era yang serba cepat ini...", "Ucapkan selamat tinggal pada...". Buka langsung dengan masalah atau solusi.

---

## 2. Aturan Sapaan: Wajib "Kamu"

- Gunakan sapaan **"kamu"** dan akhiran **"-mu"** di semua antarmuka pengguna, halaman login, modal, workspace, pesan error, dan email notifikasi.
- **Dilarang memakai "Anda"** di teks publik yang dilihat pengguna.
- *Pengecualian teknis:* System prompt khusus untuk model AI (`share-agent-modal.tsx`, `lib/ai/9router.ts`) tetap dipertahankan karena berupa instruksi sistem untuk LLM, bukan teks bacaan pengguna.

---

## 3. Istilah Baku Produk

| Gunakan | Dilarang | Catatan |
|---|---|---|
| **PRD** | dokumen PRD (berulang-ulang) | Singkatan standar industri |
| **workspace** | studio, dasbor, ruang kerja | Halaman pembuatan PRD (`/app`) |
| **draf** | draft, konsep mentah | Dokumen yang belum difinalkan |
| **kredit** | token, kuota koin | Satuan pembuatan PRD harian |
| **paket** | tier, tingkatan langganan | BASIC, VIP, ENTERPRISE |
| **unduh** | download | Format tombol ekspor |
| **bagikan** | share | Fitur tautan publik / AI agent |

---

## 4. Format Pesan Error & Notifikasi

Format standar: `[Apa yang salah]. [Langkah berikutnya].`
- Singkat, netral, tidak berbelit-belit.
- Tidak menyalahkan pengguna.
- Sebut waktu atau angka konkret jika relevan.

**Contoh:**
- Salah: *"Ups! Terjadi kesalahan saat memeriksa email Anda. Silakan coba kembali nanti ya!"*
- Benar: *"Email atau kata sandi salah. Cek lagi lalu coba masuk ulang."*
- Salah: *"Kredit Anda habis, silakan beli paket VIP!"*
- Benar: *"Kredit harianmu habis. Kredit terisi ulang dalam 4 jam, atau upgrade ke paket VIP."*

---

## 5. SEO & Metadata

- **Hapus meta keywords:** Mesin pencari modern tidak menggunakan meta keywords; array keywords yang dipaksakan berisiko memicu penalti keyword stuffing.
- **Fokus pada Title & Description yang natural:** Jelaskan apa yang dilakukan produk dan siapa yang menggunakannya dalam satu atau dua kalimat wajar.
