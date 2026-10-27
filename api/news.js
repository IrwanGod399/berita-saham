import { collect } from '../lib/collect.js';

// GET /api/news?jam=30&batas=100
// jam   : jendela waktu ke belakang dalam jam (default 30, maksimal 96)
// batas : jumlah berita maksimal (default 100, maksimal 200)
export default async function handler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Gunakan GET' });
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const payload = await collect({
      jam: url.searchParams.get('jam'),
      batas: url.searchParams.get('batas'),
    });

    // Cache di sisi Vercel 10 menit supaya akses berulang tidak memicu pengambilan ulang
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json(payload);
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'Gagal mengumpulkan berita', pesan: String(err?.message ?? err) });
  }
}
