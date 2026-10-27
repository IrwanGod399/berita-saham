import { createHash } from 'node:crypto';
import {
  KONTEKS_PASAR,
  PENGUMUMAN_RUTIN,
  kenaliSaham,
  cocokKategori,
  bobotKategori,
} from './rules.js';

const KATA_UMUM = new Set(
  'yang dan di ke dari untuk dengan ini itu pada akan ada tak tidak jadi usai soal bisa juga hingga saat kini hari video bakal kata ungkap'.split(
    ' '
  )
);

export function tokenJudul(judul) {
  const bersih = judul
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
  return new Set(bersih.split(/\s+/).filter((t) => t.length > 2 && !KATA_UMUM.has(t)));
}

function kemiripan(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let irisan = 0;
  for (const t of a) if (b.has(t)) irisan++;
  const gabungan = a.size + b.size - irisan;
  const jaccard = irisan / gabungan;
  const kecil = Math.min(a.size, b.size);
  const kontainmen = kecil >= 4 ? irisan / kecil : 0;
  return Math.max(jaccard, kontainmen >= 0.85 ? kontainmen : 0);
}

export function kanonikUrl(url) {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref$|source$)/i.test(k)) u.searchParams.delete(k);
    }
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

// Gabungkan berita yang sama dari sumber berbeda
export function gabungkan(butir) {
  const urut = [...butir].sort(
    (a, b) => Number(!!b.resmi) - Number(!!a.resmi) || b.ringkasan.length - a.ringkasan.length
  );
  const kelompok = [];
  const peta = new Map();

  for (const item of urut) {
    const kunciUrl = kanonikUrl(item.url);
    const token = tokenJudul(item.judul);
    let target = peta.get(kunciUrl);
    if (!target) target = kelompok.find((k) => kemiripan(k.token, token) >= 0.6);
    if (target) {
      target.anggota.push(item);
    } else {
      const baru = { utama: item, anggota: [item], token };
      kelompok.push(baru);
    }
    if (!peta.has(kunciUrl)) peta.set(kunciUrl, target ?? kelompok[kelompok.length - 1]);
  }
  return kelompok;
}

export function formatWib(d) {
  if (!d) return null;
  const f = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${f} WIB`;
}

export function bangunBerita(kel) {
  const { utama, anggota } = kel;
  const teks = `${utama.judul}. ${utama.ringkasan}`;
  const kategori = cocokKategori(teks);
  const resmiAda = anggota.some((a) => a.resmi);
  const rutin = PENGUMUMAN_RUTIN.test(utama.judul);

  const saham = kenaliSaham(
    teks,
    anggota.flatMap((a) => a.sahamResmi ?? [])
  );
  const konteks = KONTEKS_PASAR.test(teks);

  // Pengumuman IDX hanya dipertahankan kalau berkaitan dengan salah satu kategori dan bukan pengumuman rutin
  if (resmiAda && (kategori.length === 0 || rutin)) return null;
  if (kategori.length === 0 && saham.length === 0 && !konteks) return null;

  const namaSumber = [...new Set(anggota.map((a) => a.sumber))];
  const waktuValid = anggota.map((a) => a.waktu).filter(Boolean);
  const waktu = waktuValid.length ? new Date(Math.min(...waktuValid.map((w) => w.getTime()))) : null;

  let prioritas = 0;
  for (const k of kategori) prioritas += bobotKategori(k);
  if (saham.length > 0) prioritas += 2;
  if (konteks) prioritas += 1;
  if (resmiAda) prioritas += 2;
  prioritas += Math.min(2, namaSumber.length - 1);

  const lain = anggota
    .filter((a) => a !== utama)
    .map((a) => ({ sumber: a.sumber, url: a.url }))
    .filter((a, i, arr) => arr.findIndex((x) => x.url === a.url) === i);

  return {
    id: createHash('sha1').update(kanonikUrl(utama.url)).digest('hex').slice(0, 10),
    judul: utama.judul,
    ringkasan: utama.ringkasan,
    url: utama.url,
    sumber: utama.sumber,
    sumber_lain: lain,
    jumlah_sumber: namaSumber.length,
    resmi_idx: resmiAda,
    waktu: waktu ? waktu.toISOString() : null,
    waktu_wib: formatWib(waktu),
    saham,
    petunjuk_kategori: kategori,
    prioritas_awal: prioritas,
  };
}
