export const dynamic = 'force-dynamic';

const ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function queryOverpass(query) {
  for (const url of ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal
      });
      clearTimeout(timer);
      const text = await res.text();
      if (res.ok && text.trim().startsWith('{')) return JSON.parse(text);
    } catch (err) {
      clearTimeout(timer);
    }
  }
  return null;
}

export async function POST(request) {
  let nama;
  try {
    nama = (await request.json()).kabupaten;
  } catch (e) {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!nama || typeof nama !== 'string') {
    return Response.json({ error: 'bad_kabupaten' }, { status: 400 });
  }

  // bersihkan nama: hilangkan awalan KAB./KOTA, sisakan nama inti
  const base = nama.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!base) return Response.json({ error: 'bad_kabupaten' }, { status: 400 });

  const re = escapeReg(base);
  const queries = [
    // cocokkan: "Semarang", "Kabupaten Semarang", "Kota Semarang", "KAB. SEMARANG"
    `[out:json][timeout:40];area["name"~"^(Kabupaten|Kota|Kab\\.)?\\s*${re}$",i]["admin_level"="5"]->.a;(relation["admin_level"="6"](area.a);way["admin_level"="6"](area.a););out geom;`,
    // cadangan: nama persis
    `[out:json][timeout:40];area["name"="${base}"]["admin_level"="5"]->.a;(relation["admin_level"="6"](area.a);way["admin_level"="6"](area.a););out geom;`
  ];

  for (const q of queries) {
    const data = await queryOverpass(q);
    if (data && data.elements && data.elements.length > 0) return Response.json(data);
  }
  return Response.json({ error: 'kecamatan_not_found' }, { status: 502 });
}
