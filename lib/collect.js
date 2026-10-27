import {
  SUMBER_RSS,
  JENDELA_JAM_DEFAULT,
  JENDELA_JAM_MAKS,
  BATAS_DEFAULT,
  BATAS_MAKS,
} from './config.js';
import { ambilRss, ambilGoogleNews, ambilIdx } from './fetchers.js';
import { gabungkan, bangunBerita, formatWib } from './process.js';

function angka(v, dasar, maks, min = 1) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return dasar;
  return Math.min(maks, Math.max(min, n));
}

export async function collect({
  jam,
  batas,
  fetchImpl = fetch,
  sekarang = new Date(),
  env = process.env,
} = {}) {
  const jendelaJam = angka(jam, JENDELA_JAM_DEFAULT, JENDELA_JAM_MAKS);
  const batasJumlah = angka(batas, BATAS_DEFAULT, BATAS_MAKS);

  const tugas = SUMBER_RSS.map((s) => ({ id: s.id, nama: s.nama, jalankan: () => ambilRss(s, fetchImpl) }));
  if (env.DISABLE_IDX !== '1') {
    tugas.push({
      id: 'idx',
      nama: 'Keterbukaan Informasi IDX',
      jalankan: () => ambilIdx(fetchImpl, sekarang),
    });
  }
  if (env.ENABLE_GOOGLE_NEWS === '1') {
    tugas.push({ id: 'google-news', nama: 'Google News', jalankan: () => ambilGoogleNews(fetchImpl) });
  }

  const hasil = await Promise.allSettled(tugas.map((t) => t.jalankan()));

  const status = [];
  const semua = [];
  hasil.forEach((h, i) => {
    const t = tugas[i];
    if (h.status === 'fulfilled') {
      status.push({ id: t.id, nama: t.nama, status: 'ok', jumlah: h.value.length });
      semua.push(...h.value);
    } else {
      status.push({
        id: t.id,
        nama: t.nama,
        status: 'gagal',
        jumlah: 0,
        pesan: String(h.reason?.message ?? h.reason).slice(0, 160),
      });
    }
  });

  const batasWaktu = sekarang.getTime() - jendelaJam * 3600 * 1000;
  const dalamJendela = semua.filter((x) => !x.waktu || x.waktu.getTime() >= batasWaktu);

  const berita = gabungkan(dalamJendela)
    .map(bangunBerita)
    .filter(Boolean)
    .sort(
      (a, b) =>
        b.prioritas_awal - a.prioritas_awal ||
        (b.waktu ? Date.parse(b.waktu) : 0) - (a.waktu ? Date.parse(a.waktu) : 0)
    );

  return {
    dibuat: sekarang.toISOString(),
    dibuat_wib: formatWib(sekarang),
    jendela_jam: jendelaJam,
    jumlah_diambil: semua.length,
    jumlah_lolos_saring: berita.length,
    jumlah_ditampilkan: Math.min(berita.length, batasJumlah),
    sumber_status: status,
    berita: berita.slice(0, batasJumlah),
  };
}
