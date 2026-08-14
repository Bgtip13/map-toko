export const dynamic = 'force-dynamic';

const ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

export async function POST(request) {
  let bbox;
  try {
    const body = await request.json();
    bbox = body.bbox;
  } catch (e) {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!bbox || [bbox.south, bbox.west, bbox.north, bbox.east].some(n => typeof n !== 'number')) {
    return Response.json({ error: 'bad_bbox' }, { status: 400 });
  }

  const query = `[out:json][timeout:25];(node["shop"="pet"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});way["shop"="pet"](${bbox.south},${bbox.west},${bbox.north},${bbox.east}));out center;`;

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
      if (!res.ok) continue;
      const text = await res.text();
      if (text.trim().startsWith('{')) return Response.json(JSON.parse(text));
    } catch (err) {
      clearTimeout(timer);
      console.warn('overpass gagal: ' + url, err.message);
    }
  }
  return Response.json({ error: 'all_overpass_failed' }, { status: 502 });
}
