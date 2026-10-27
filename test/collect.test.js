import test from 'node:test';
import assert from 'node:assert/strict';
import { collect } from '../lib/collect.js';
import { kenaliSaham, cocokKategori } from '../lib/rules.js';
import { bersihHtml } from '../lib/fetchers.js';

const rss = (items) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>x</title>${items
  .map(
    (i) => `<item>
  <title><![CDATA[${i.title}]]></title>
  <link>${i.link}</link>
  <pubDate>${i.date}</pubDate>
  <description><![CDATA[<img src="https://x/y.jpg"> ${i.desc ?? ''}]]></description>
</item>`
  )
  .join('')}</channel></rss>`;

const CNBC = rss([
  {
    title: 'Emiten TLKM Siap Akuisisi Perusahaan Menara, Nilai Rp5 Triliun',
    link: 'https://cnbc.test/a1?utm_source=x',
    date: 'Mon, 26 Oct 2026 08:00:00 +0700',
    desc: 'TLKM menyiapkan akuisisi perusahaan menara.',
  },
  { title: 'Daftar Harga BBM Hari Ini', link: 'https://cnbc.test/a2', date: 'Mon, 26 Oct 2026 08:10:00 +0700' },
  { title: 'Akhir Sesi I, IHSG Anjlok 1%', link: 'https://cnbc.test/a3', date: 'Mon, 26 Oct 2026 12:03:00 +0700' },
  {
    title: 'Saham BBRI Rights Issue Lama',
    link: 'https://cnbc.test/lama',
    date: 'Tue, 20 Oct 2026 08:00:00 +0700',
  },
]);

const IDXCH = rss([
  {
    title: 'TLKM Akan Akuisisi Perusahaan Menara Senilai Rp5 Triliun',
    link: 'https://idxch.test/b1',
    date: 'Mon, 26 Oct 2026 09:00:00 +0700',
  },
  {
    title: 'Saham BUMI Kena UMA, Ini Penjelasan BEI',
    link: 'https://idxch.test/b2',
    date: 'Mon, 26 Oct 2026 09:30:00 +0700',
  },
]);

const ANTARA = rss([
  { title: 'Pemkot Bandung gandeng SBM ITB', link: 'https://antara.test/c1', date: 'Mon, 26 Oct 2026 12:31:04 +0700' },
]);

const IDX = JSON.stringify({
  Replies: [
    {
      pengumuman: {
        Kode_Emiten: 'BBRI ',
        JudulPengumuman: 'Rencana Penambahan Modal Dengan Hak Memesan Efek Terlebih Dahulu (HMETD)',
        TglPengumuman: '2026-10-26T15:30:00',
      },
      attachments: [{ FullSavePath: 'https://www.idx.co.id/StaticData/x.pdf' }],
    },
    {
      pengumuman: {
        Kode_Emiten: 'BBCA',
        JudulPengumuman: 'Laporan Bulanan Registrasi Pemegang Efek',
        TglPengumuman: '2026-10-26T10:00:00',
      },
    },
  ],
});

function buatFetch(peta) {
  return async (url) => {
    for (const [awal, isi] of Object.entries(peta)) {
      if (url.startsWith(awal)) {
        if (isi instanceof Error) throw isi;
        return { ok: true, status: 200, text: async () => isi };
      }
    }
    return { ok: false, status: 404, text: async () => '' };
  };
}

const SEKARANG = new Date('2026-10-27T00:00:00Z'); // 07.00 WIB

test('mengumpulkan, menggabungkan duplikat, menyaring, dan mengurutkan', async () => {
  const hasil = await collect({
    fetchImpl: buatFetch({
      'https://www.cnbcindonesia.com/market/rss': CNBC,
      'https://www.idxchannel.com/rss': IDXCH,
      'https://www.antaranews.com/rss/ekonomi-bisnis.xml': ANTARA,
      'https://www.idx.co.id/primary': IDX,
    }),
    sekarang: SEKARANG,
    env: {},
  });

  const judul = hasil.berita.map((b) => b.judul);

  // BBM dan berita Antara tanpa konteks pasar dibuang; berita lama di luar jendela dibuang
  assert.ok(!judul.some((j) => /BBM/.test(j)));
  assert.ok(!judul.some((j) => /Bandung/.test(j)));
  assert.ok(!judul.some((j) => /Lama/.test(j)));

  // Pengumuman rutin IDX dibuang, pengumuman HMETD dipertahankan
  assert.ok(!judul.some((j) => /Registrasi Pemegang Efek/.test(j)));
  const idx = hasil.berita.find((b) => b.resmi_idx);
  assert.ok(idx, 'pengumuman IDX HMETD harus ada');
  assert.deepEqual(idx.saham, ['BBRI']);
  assert.ok(idx.petunjuk_kategori.includes('suntikan_dana'));

  // Berita TLKM dari dua sumber digabung jadi satu
  const tlkm = hasil.berita.filter((b) => b.saham.includes('TLKM'));
  assert.equal(tlkm.length, 1);
  assert.equal(tlkm[0].jumlah_sumber, 2);
  assert.equal(tlkm[0].sumber_lain.length, 1);
  assert.ok(tlkm[0].petunjuk_kategori.includes('akuisisi_merger'));

  // UMA terdeteksi sebagai aksi bursa dan BUMI sebagai saham
  const bumi = hasil.berita.find((b) => b.saham.includes('BUMI'));
  assert.ok(bumi.petunjuk_kategori.includes('aksi_bursa'));

  // Urutan: skor awal menurun
  const skor = hasil.berita.map((b) => b.prioritas_awal);
  assert.deepEqual(skor, [...skor].sort((a, b) => b - a));

  // Berita konteks pasar saja tetap masuk dengan skor rendah
  const ihsg = hasil.berita.find((b) => /IHSG/.test(b.judul));
  assert.ok(ihsg && ihsg.prioritas_awal <= 2);

  // Waktu dalam WIB
  assert.match(tlkm[0].waktu_wib, /WIB$/);
  assert.ok(hasil.sumber_status.every((s) => s.status === 'ok'));
});

test('satu sumber gagal tidak menghentikan yang lain', async () => {
  const hasil = await collect({
    fetchImpl: buatFetch({
      'https://www.cnbcindonesia.com/market/rss': CNBC,
      'https://www.idxchannel.com/rss': new Error('timeout'),
      'https://www.antaranews.com/rss/ekonomi-bisnis.xml': '<html>bukan feed</html>',
      'https://www.idx.co.id/primary': '<html>Cloudflare</html>',
    }),
    sekarang: SEKARANG,
    env: {},
  });
  const peta = Object.fromEntries(hasil.sumber_status.map((s) => [s.id, s]));
  assert.equal(peta['cnbc-market'].status, 'ok');
  assert.equal(peta['idxchannel'].status, 'gagal');
  assert.equal(peta['antara-ekonomi'].status, 'gagal');
  assert.equal(peta['idx'].status, 'gagal');
  assert.match(peta['idx'].pesan, /bukan JSON/);
  assert.ok(hasil.berita.length > 0);
});

test('Google News hanya dipanggil kalau dinyalakan, DISABLE_IDX mematikan IDX', async () => {
  const dipanggil = [];
  const fetchImpl = async (url) => {
    dipanggil.push(url);
    return { ok: true, status: 200, text: async () => rss([]) };
  };
  const mati = await collect({ fetchImpl, sekarang: SEKARANG, env: { DISABLE_IDX: '1' } });
  assert.ok(!dipanggil.some((u) => u.includes('news.google.com')));
  assert.ok(!mati.sumber_status.some((s) => s.id === 'idx'));

  dipanggil.length = 0;
  await collect({ fetchImpl, sekarang: SEKARANG, env: { ENABLE_GOOGLE_NEWS: '1', DISABLE_IDX: '1' } });
  assert.ok(dipanggil.some((u) => u.includes('news.google.com')));
});

test('parameter dibatasi', async () => {
  const hasil = await collect({
    jam: '9999',
    batas: '1',
    fetchImpl: buatFetch({
      'https://www.cnbcindonesia.com/market/rss': CNBC,
      'https://www.idxchannel.com/rss': IDXCH,
    }),
    sekarang: SEKARANG,
    env: { DISABLE_IDX: '1' },
  });
  assert.equal(hasil.jendela_jam, 96);
  assert.equal(hasil.berita.length, 1);
  assert.ok(hasil.jumlah_lolos_saring >= hasil.jumlah_ditampilkan);
});

test('pengenalan kode saham', () => {
  assert.deepEqual(kenaliSaham('Saham BBCA dan BMRI menguat'), ['BBCA', 'BMRI']);
  assert.deepEqual(kenaliSaham('PT Foo Tbk (FOOO) umumkan dividen'), ['FOOO']);
  assert.deepEqual(kenaliSaham('Emiten XYZW akan buyback'), ['XYZW']);
  assert.deepEqual(kenaliSaham('IHSG naik, saham UMKM dan BUMN disorot (IHSG)'), []);
  assert.deepEqual(kenaliSaham('Berita biasa', ['abcd ', 'toolong']), ['ABCD']);
});

test('kategori', () => {
  assert.ok(cocokKategori('Rights issue senilai Rp1 triliun').includes('suntikan_dana'));
  assert.ok(cocokKategori('Tender offer saham ABCD').includes('akuisisi_merger'));
  assert.ok(cocokKategori('Dividen interim dan buyback').includes('dividen_buyback'));
  assert.ok(cocokKategori('Saham dihentikan sementara, kena UMA').includes('aksi_bursa'));
  assert.deepEqual(cocokKategori('Harga BBM turun'), []);
});

test('pembersih HTML', () => {
  assert.equal(bersihHtml('<img src="x"> Halo &amp; selamat &lt;p&gt;datang&lt;/p&gt;'), 'Halo & selamat datang');
});
