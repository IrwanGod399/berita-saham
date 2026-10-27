import { XMLParser } from 'fast-xml-parser';
import {
  USER_AGENT,
  TIMEOUT_MS,
  IDX_URL,
  IDX_HALAMAN_PENGUMUMAN,
  KUERI_GOOGLE_NEWS,
} from './config.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  processEntities: true,
  trimValues: true,
});

const ENTITAS = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function dekodeEntitas(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const kode = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(kode) && kode > 0 && kode < 0x110000 ? String.fromCodePoint(kode) : m;
    }
    return ENTITAS[e.toLowerCase()] ?? m;
  });
}

export function bersihHtml(nilai) {
  if (nilai == null) return '';
  let s = dekodeEntitas(String(nilai));
  s = s.replace(/<[^>]*>/g, ' ');
  s = dekodeEntitas(s);
  return s.replace(/\s+/g, ' ').trim();
}

function teks(v) {
  if (v == null) return '';
  if (typeof v === 'object') return teks(v['#text'] ?? '');
  return String(v);
}

function tautan(v) {
  if (v == null) return '';
  if (Array.isArray(v)) {
    const alt = v.find((x) => x && x['@_rel'] === 'alternate') ?? v[0];
    return tautan(alt);
  }
  if (typeof v === 'object') return String(v['@_href'] ?? v['#text'] ?? '').trim();
  return String(v).trim();
}

function daftar(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export function parseWaktu(nilai, anggapWib = false) {
  if (!nilai) return null;
  let s = String(nilai).trim();
  if (anggapWib && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    s = s.replace(' ', 'T') + '+07:00';
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

async function ambilTeks(url, fetchImpl, accept) {
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: accept ?? '*/*' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export function parseFeed(xml, namaSumber) {
  const data = parser.parse(xml);
  const butir = data?.rss?.channel
    ? daftar(data.rss.channel.item)
    : data?.feed
      ? daftar(data.feed.entry)
      : data?.['rdf:RDF']
        ? daftar(data['rdf:RDF'].item)
        : null;
  if (butir === null) throw new Error('Format feed tidak dikenali (bukan RSS/Atom)');

  return butir
    .map((it) => {
      const judul = bersihHtml(teks(it.title));
      const url = tautan(it.link) || tautan(it.guid);
      const ringkasan = bersihHtml(
        teks(it.description) || teks(it.summary) || teks(it['content:encoded']) || teks(it.content)
      ).slice(0, 240);
      const waktu = parseWaktu(
        teks(it.pubDate) || teks(it.published) || teks(it.updated) || teks(it['dc:date'])
      );
      return { judul, ringkasan, url, sumber: namaSumber, waktu };
    })
    .filter((x) => x.judul && /^https?:\/\//i.test(x.url));
}

export async function ambilRss(sumber, fetchImpl) {
  const xml = await ambilTeks(sumber.url, fetchImpl, 'application/rss+xml, application/xml, text/xml, */*');
  return parseFeed(xml, sumber.nama);
}

export async function ambilGoogleNews(fetchImpl) {
  const hasil = await Promise.allSettled(
    KUERI_GOOGLE_NEWS.map(async (q) => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:2d')}&hl=id&gl=ID&ceid=ID:id`;
      const xml = await ambilTeks(url, fetchImpl, 'application/rss+xml, application/xml, text/xml, */*');
      const data = parser.parse(xml);
      return daftar(data?.rss?.channel?.item)
        .map((it) => {
          const media = teks(it.source);
          let judul = bersihHtml(teks(it.title));
          if (media && judul.endsWith(` - ${media}`)) judul = judul.slice(0, -(media.length + 3));
          return {
            judul,
            ringkasan: '',
            url: tautan(it.link),
            sumber: media ? `${media} (via Google News)` : 'Google News',
            waktu: parseWaktu(teks(it.pubDate)),
          };
        })
        .filter((x) => x.judul && /^https?:\/\//i.test(x.url));
    })
  );
  const ok = hasil.filter((h) => h.status === 'fulfilled').flatMap((h) => h.value);
  if (ok.length === 0 && hasil.every((h) => h.status === 'rejected')) {
    throw new Error(hasil[0].reason?.message ?? 'Semua kueri gagal');
  }
  return ok;
}

function tanggalJakarta(d) {
  const bagian = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return bagian.replaceAll('-', '');
}

export async function ambilIdx(fetchImpl, sekarang) {
  const dari = tanggalJakarta(new Date(sekarang.getTime() - 3 * 24 * 3600 * 1000));
  const sampai = tanggalJakarta(sekarang);
  const url = `${IDX_URL}?kodeEmiten=&indexFrom=0&pageSize=100&dateFrom=${dari}&dateTo=${sampai}&lang=id`;
  const mentah = await ambilTeks(url, fetchImpl, 'application/json, text/plain, */*');

  let data;
  try {
    data = JSON.parse(mentah);
  } catch {
    throw new Error('Respons IDX bukan JSON (kemungkinan diblokir)');
  }
  const baris = data?.Replies ?? data?.replies ?? data?.data ?? [];
  if (!Array.isArray(baris)) throw new Error('Struktur respons IDX tidak dikenali');

  return baris
    .map((r) => {
      const p = r.pengumuman ?? r;
      const kode = String(p.Kode_Emiten ?? p.kode_emiten ?? p.KodeEmiten ?? '').trim().toUpperCase();
      const perihal = bersihHtml(p.JudulPengumuman ?? p.PerihalPengumuman ?? p.Judul ?? '');
      const lampiran = daftar(r.attachments)[0];
      const url = lampiran?.FullSavePath || IDX_HALAMAN_PENGUMUMAN;
      return {
        judul: kode ? `${kode} - ${perihal}` : perihal,
        ringkasan: '',
        url,
        sumber: 'Keterbukaan Informasi IDX',
        waktu: parseWaktu(p.TglPengumuman ?? p.CreatedDate, true),
        resmi: true,
        sahamResmi: /^[A-Z]{4}$/.test(kode) ? [kode] : [],
      };
    })
    .filter((x) => x.judul && x.judul.length > 5);
}
