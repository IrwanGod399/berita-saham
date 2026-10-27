# Berita Saham

Pengumpul berita saham Indonesia untuk pemakaian pribadi. Berjalan di Vercel, tanpa database dan tanpa API key.

## Cara kerja

1. `GET /api/news` mengambil berita dari beberapa sumber secara paralel:
   - RSS CNBC Indonesia (market), IDX Channel, dan Antara (ekonomi-bisnis)
   - Pengumuman keterbukaan informasi IDX (dicoba; kalau diblokir, statusnya tampil dan sumber lain tetap jalan)
   - Google News RSS (opsional, default mati)
2. Berita yang sama dari sumber berbeda digabung, kode saham dikenali, dan berita yang jelas tidak relevan dibuang.
3. Hasilnya JSON, diurutkan dari yang paling berpotensi menggerakkan harga berdasarkan aturan sederhana (`prioritas_awal`).
4. Halaman `/` menampilkan hasil yang sama dengan filter. Penilaian akhir (kategori, skor dampak, arah dampak) dilakukan oleh Claude lewat scheduled task.

Parameter: `/api/news?jam=30&batas=100` (jam maksimal 96, batas maksimal 200). Respons di-cache 10 menit.

## Environment variable (opsional)

| Nama | Isi | Fungsi |
|---|---|---|
| `ENABLE_GOOGLE_NEWS` | `1` | Menyalakan Google News RSS. Default mati karena robots.txt Google melarang akses otomatis ke alamat pencarian |
| `DISABLE_IDX` | `1` | Mematikan sumber pengumuman IDX kalau terus gagal |

## Menambah atau mengubah sumber

Edit `lib/config.js` (daftar feed) dan `lib/rules.js` (kata kunci dan daftar kode saham), lalu push ke GitHub. Vercel akan deploy ulang otomatis.

## Uji lokal

```
npm install
npm test
```

Tes memakai data contoh, tidak butuh internet.

## Catatan

- Halaman ini publik tanpa login. Isinya hanya berita publik. Alamat tidak diindeks mesin pencari (`robots.txt` dan header `X-Robots-Tag`).
- Aturan kata kunci hanya penyaring awal. Berita bernuansa (misalnya akuisisi dibatalkan) bisa salah urut, makanya penilaian akhir diserahkan ke Claude.
- Ini informasi, bukan rekomendasi beli atau jual.
