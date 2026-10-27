// Aturan sederhana untuk menyaring awal dan memberi petunjuk. Penilaian akhir dilakukan oleh Claude,
// jadi aturan di sini sengaja longgar: tujuannya membuang berita yang jelas tidak relevan
// dan mengurutkan supaya yang penting masuk dalam batas jumlah.

export const KATEGORI = [
  {
    kunci: 'suntikan_dana',
    bobot: 4,
    ci: /rights?\s*issue|hmetd|pmthmetd|private\s*placement|penambahan\s*modal|suntik(?:an)?\s*(?:dana|modal)|dana\s*segar|penyertaan\s*modal|capital\s*injection|investor\s*strategis|strategic\s*investor|penerbitan\s*(?:obligasi|sukuk|saham\s*baru|surat\s*utang|waran)|penawaran\s*umum|pinjaman\s*(?:senilai|sebesar|baru)|kredit\s*sindikasi|konversi\s*utang|\bobligasi\b|\bsukuk\b|\bwaran\b|\bwarrant\b|\bipo\b|pendanaan/i,
    cs: null,
  },
  {
    kunci: 'akuisisi_merger',
    bobot: 4,
    ci: /akuisisi|mengakuisisi|diakuisisi|merger|penggabungan\s*usaha|tender\s*offer|divestasi|pengambil\s*alihan|pengambilalihan|ambil\s*alih|backdoor\s*listing|go\s*private|joint\s*venture|spin[-\s]?off|pemisahan\s*usaha|penjualan\s*aset|pengendali\s*baru|take\s*over|takeover|kuasai\s*saham|lepas\s*saham|jual\s*saham|borong\s*saham|pemegang\s*saham\s*(?:baru|pengendali)/i,
    cs: null,
  },
  {
    kunci: 'dividen_buyback',
    bobot: 3,
    ci: /dividen|buy\s*-?\s*back|pembelian\s*kembali\s*saham|stock\s*split|pemecahan\s*saham|reverse\s*stock|saham\s*bonus|payout/i,
    cs: null,
  },
  {
    kunci: 'aksi_bursa',
    bobot: 3,
    ci: /suspensi|disuspen|unusual\s*market|delisting|notasi\s*khusus|papan\s*pemantauan|auto\s*reject|trading\s*halt|penghentian\s*sementara\s*perdagangan|msci|ftse|rebalanc/i,
    cs: /\b(?:UMA|ARA|ARB)\b/,
  },
  {
    kunci: 'manajemen_kinerja',
    bobot: 1,
    ci: /laba|rugi|pendapatan|kinerja|laporan\s*keuangan|kuartal|semester|\brups\w*|direksi|komisaris|dirut|direktur\s*utama|pergantian|mengundurkan\s*diri|revisi\s*target|kontrak\s*(?:baru|senilai|sebesar)|order\s*book|ekspansi|belanja\s*modal|capex|target\s*harga|pkpu|pailit|gagal\s*bayar|gugatan|sengketa|phk|restrukturisasi|rekomendasi\s*(?:beli|jual)|net\s*profit/i,
    cs: null,
  },
];

// Tanda bahwa berita berkaitan dengan pasar modal (dipakai untuk berita tanpa kategori di atas)
export const KONTEKS_PASAR =
  /saham|emiten|ihsg|\bbei\b|bursa\s*efek|\bojk\b|sekuritas|pasar\s*modal|free\s*float|kapitalisasi\s*pasar|investor\s*asing|net\s*(?:buy|sell)|asing\s*(?:borong|jual)|\btbk\b/i;

// Pengumuman IDX yang bersifat rutin dan hampir tidak menggerakkan harga
export const PENGUMUMAN_RUTIN =
  /laporan\s*bulanan\s*registrasi|bukti\s*iklan|penyampaian\s*bukti|laporan\s*kepemilikan|registrasi\s*pemegang\s*efek|perubahan\s*data|undangan\s*paparan|jadwal\s*paparan|tanggapan\s*atas\s*permintaan|penyampaian\s*materi|laporan\s*realisasi\s*penggunaan\s*dana/i;

// Saham yang sering muncul. Dipakai hanya untuk mengenali kode di teks biasa;
// kode di luar daftar tetap dikenali kalau ditulis dalam kurung atau didahului kata "saham"/"emiten".
export const SAHAM_DIKENAL = new Set(
  (
    'BBCA BBRI BMRI BBNI BRIS BTPS BBTN ARTO BNGA BDMN BNLI NISP PNBN BBYB AGRO BJBR BJTM ' +
    'TLKM ISAT EXCL TOWR MTEL TBIG ' +
    'ASII UNVR ICBP INDF MYOR KLBF SIDO GGRM HMSP CPIN JPFA ' +
    'ADRO PTBA ITMG BYAN BUMI AADI HRUM INDY ENRG MEDC PGAS AKRA ELSA ADMR ' +
    'ANTM INCO MDKA TINS NCKL MBMA AMMN BRMS PSAB ' +
    'SMGR INTP TPIA BRPT CUAN BREN PGEO DSSA ' +
    'GOTO BUKA EMTK MTDL ACES MAPI AMRT MIDI ERAA ' +
    'CTRA BSDE PWON SMRA JSMR WIKA PTPP ADHI PTRO ' +
    'MIKA SILO SMDR TKIM INKP UNTR ESSA SSIA KIJA TOBA INET'
  ).split(' ')
);

// Singkatan 4 huruf yang BUKAN kode saham (supaya "(IHSG)" atau "saham UMKM" tidak dianggap emiten)
const BUKAN_SAHAM = new Set(
  (
    'IHSG MSCI FTSE UMKM BUMN BUMD APBN APBD RUPS RUPST PKPU PNBP OPEC NATO FOMC ' +
    'KSEI KPEI USDT BPJS TKDN PLTU PLTS PLTA DMO DHE SBSN SRBI SVBI NYSE DJIA JKSE ' +
    'COVID ASEAN EURO BRIC OECD BAPE POLRI KPPU LPS'
  ).split(' ')
);

const POLA_KUAT = [
  /\(\s*(?:IDX|BEI|Kode|Ticker)?\s*[:\-]?\s*([A-Z]{4})\s*\)/g,
  /\b(?:[Ss]aham|[Ee]miten|[Kk]ode(?:\s+[Ss]aham)?|[Tt]icker)\s+(?:PT\s+)?([A-Z]{4})\b/g,
];

export function kenaliSaham(teks, tambahan = []) {
  const hasil = new Set();
  for (const k of tambahan) {
    const kode = String(k || '').trim().toUpperCase();
    if (/^[A-Z]{4}$/.test(kode)) hasil.add(kode);
  }
  for (const pola of POLA_KUAT) {
    pola.lastIndex = 0;
    let m;
    while ((m = pola.exec(teks)) !== null) {
      if (!BUKAN_SAHAM.has(m[1])) hasil.add(m[1]);
    }
  }
  const polos = teks.match(/\b[A-Z]{4}\b/g) || [];
  for (const kode of polos) {
    if (SAHAM_DIKENAL.has(kode)) hasil.add(kode);
  }
  return [...hasil];
}

export function cocokKategori(teks) {
  const hasil = [];
  for (const k of KATEGORI) {
    if (k.ci.test(teks) || (k.cs && k.cs.test(teks))) hasil.push(k.kunci);
  }
  return hasil;
}

export function bobotKategori(kunci) {
  return KATEGORI.find((k) => k.kunci === kunci)?.bobot ?? 0;
}
