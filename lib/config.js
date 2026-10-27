// Pengaturan sumber dan batas. Ubah di sini kalau ingin menambah atau mengurangi sumber.

export const JENDELA_JAM_DEFAULT = 30; // run harian jam 07.00 + cadangan waktu
export const JENDELA_JAM_MAKS = 96;
export const BATAS_DEFAULT = 100;
export const BATAS_MAKS = 200;
export const TIMEOUT_MS = 8000;

export const USER_AGENT = 'Mozilla/5.0 (compatible; BeritaSahamPribadi/1.0)';

// Feed RSS yang sudah dicek bisa dibaca (27 Okt 2026).
// Catatan: Kontan, Tempo, dan Detik melarang pengambilan otomatis lewat robots.txt,
// sedangkan Bisnis.com dan Investor.id tidak menjawab pada alamat RSS yang dicoba,
// jadi semuanya sengaja tidak dimasukkan.
export const SUMBER_RSS = [
  { id: 'cnbc-market', nama: 'CNBC Indonesia', url: 'https://www.cnbcindonesia.com/market/rss' },
  { id: 'idxchannel', nama: 'IDX Channel', url: 'https://www.idxchannel.com/rss' },
  { id: 'antara-ekonomi', nama: 'Antara', url: 'https://www.antaranews.com/rss/ekonomi-bisnis.xml' },
];

// Google News RSS. Default MATI karena robots.txt-nya melarang akses otomatis ke alamat pencarian.
// Nyalakan dengan environment variable ENABLE_GOOGLE_NEWS=1 di Vercel kalau Anda ingin mencobanya.
export const KUERI_GOOGLE_NEWS = [
  'rights issue saham',
  'private placement saham',
  'akuisisi emiten',
  'tender offer saham',
  'buyback saham',
  'dividen emiten',
  'suspensi saham BEI',
];

// Pengumuman resmi keterbukaan informasi IDX. Alamat ini belum bisa diuji dari lingkungan pembuatan
// (permintaan ditolak), jadi sifatnya "dicoba": kalau gagal, statusnya muncul di respons dan sumber lain tetap jalan.
// Matikan dengan DISABLE_IDX=1 kalau terus gagal.
export const IDX_URL = 'https://www.idx.co.id/primary/ListedCompany/GetAnnouncement';
export const IDX_HALAMAN_PENGUMUMAN = 'https://www.idx.co.id/id/perusahaan-tercatat/keterbukaan-informasi/';
