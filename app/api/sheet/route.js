import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/* ── Konfigurasi sumber data (Google Sheet) ──
   Sheet harus dibagikan: Share → "Anyone with the link" → Viewer.
   ID & nama tab bisa diubah lewat env (GOOGLE_SHEET_ID) bila perlu. */
const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1wH-sYlBEr-vTLaGu6XnGnv_BofvXOsgxb1VuA1jrQjQ';

const TABS = {
  existing: 'EXISTING',
};

/* Kolom yang dikenali (berdasarkan nama header, tidak peduli huruf besar/kecil/spasi).
   Urutan 'order' dipakai bila header tidak ditemukan sama sekali (posisi kolom). */
const SPECS = {
  existing: [
    ['area', ['area', 'wilayah']],
    ['kabupaten', ['kabupaten', 'kab', 'kabupatenkota', 'kabkota', 'kota']],
    ['kecamatan', ['kecamatan', 'kec']],
    ['existing', ['status', 'existing']],
    ['pelanggan', ['pelanggan', 'namapelanggan', 'namatoko', 'nama', 'toko', 'customer']],
    ['adm', ['adm', 'sales']],
    ['kelas_toko', ['kelastoko', 'kelas']],
    ['kelas_byr', ['kelasbayar', 'kelasbyr', 'kelas']],
    ['ll', ['longlat', 'latlong', 'latlng', 'koordinat', 'coordinates', 'titik']],
    ['link_maps', ['linkmaps', 'link', 'maps', 'googlemaps', 'url']],
    ['alamat', ['alamat', 'address']],
  ],
  noo: [
    ['area', ['area', 'wilayah']],
    ['kabupaten', ['kabupaten', 'kab', 'kabupatenkota', 'kabkota', 'kota']],
    ['kecamatan', ['kecamatan', 'kec']],
    ['nama', ['namatoko', 'nama', 'toko']],
    ['ll', ['longlat', 'latlong', 'latlng', 'koordinat', 'coordinates', 'titik']],
    ['link_maps', ['linkmaps', 'link', 'maps', 'googlemaps', 'url']],
    ['alamat', ['alamat', 'address']],
  ],
  potensi: [
    ['area', ['area', 'wilayah']],
    ['kabupaten', ['kabupaten', 'kab', 'kabupatenkota', 'kabkota', 'kota']],
    ['kecamatan', ['kecamatan', 'kec']],
    ['nama', ['namatoko', 'nama', 'toko']],
    ['ll', ['longlat', 'latlong', 'latlng', 'koordinat', 'coordinates', 'titik']],
    ['link_maps', ['linkmaps', 'link', 'maps', 'googlemaps', 'url']],
    ['alamat', ['alamat', 'address']],
  ],
};

/* Urutan kolom lama (dipakai sebagai cadangan kalau header tidak terbaca) */
const FALLBACK_ORDER = {
  existing: ['area', 'kabupaten', 'kecamatan', 'existing', 'pelanggan', 'adm', 'kelas_toko', 'kelas_byr', 'll', 'link_maps', 'alamat'],
  noo: ['area', 'kabupaten', 'kecamatan', 'nama', 'll', 'alamat'],
  potensi: ['area', 'kabupaten', 'kecamatan', 'nama', 'll', 'link_maps'],
};

/* ── CSV parser yang benar (kutip, koma, baris baru di dalam sel) ── */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      rows.push(row); row = [];
    } else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

const normHeader = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ── Koordinat ── */
const LL_RE = /(-?\d{1,3}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)/;

function toLatLng(a, b) {
  let lat = parseFloat(a), lng = parseFloat(b);
  if (isNaN(lat) || isNaN(lng)) return '';
  // Indonesia: lat sekitar -11..6, lng sekitar 95..141 → tukar kalau terbalik
  if (Math.abs(lat) > 90 || (lat >= 90 && lng <= 20)) [lat, lng] = [lng, lat];
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return '';
  return lat + ',' + lng;
}

function coordFromText(s) {
  if (!s) return '';
  const t = String(s).trim();
  const at = t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || t.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return toLatLng(at[1], at[2]);
  if (/^-?\d{1,3}(\.\d+)?\s*[,;]\s*-?\d{1,3}(\.\d+)?$/.test(t)) {
    const m = t.match(LL_RE);
    return m ? toLatLng(m[1], m[2]) : '';
  }
  return '';
}

/* ── Kabupaten / kecamatan dari alamat (cadangan jika kolomnya kosong) ── */
function fromAddress(alamat) {
  const out = { kabupaten: '', kecamatan: '' };
  if (!alamat) return out;
  const kec = alamat.match(/\bKec(?:amatan)?\.?\s+([^,]+)/i);
  if (kec) out.kecamatan = kec[1].trim();
  const kota = alamat.match(/\bKota\s+([A-Za-z ]+?)(?:,|$)/i);
  const kab = alamat.match(/\b(?:Kabupaten|Kab\.)\s+([A-Za-z ]+?)(?:,|$)/i);
  if (kota) out.kabupaten = 'Kota ' + kota[1].trim();
  else if (kab) out.kabupaten = 'Kab. ' + kab[1].trim();
  return out;
}

function mapSheet(type, csvText) {
  const table = parseCSV(csvText);
  if (table.length < 1) return { data: [], headers: [], mode: 'kosong' };

  const header = table[0].map(h => h.trim());
  const spec = SPECS[type];
  const colOf = {};
  const used = new Set();

  header.forEach((h, idx) => {
    const n = normHeader(h);
    if (!n) return;
    for (const [field, aliases] of spec) {
      if (colOf[field] !== undefined || !aliases.includes(n)) continue;
      colOf[field] = idx;
      used.add(idx);
      break;
    }
  });

  let mode = 'header';
  let body = table.slice(1);
  if (Object.keys(colOf).length < 2) {
    // header tidak terbaca → pakai urutan kolom lama, baris pertama dianggap data bila bukan header
    mode = 'posisi';
    FALLBACK_ORDER[type].forEach((f, i) => { colOf[f] = i; });
    const looksHeader = header.some(h => /^(area|kabupaten|kecamatan|nama|alamat)/i.test(h));
    body = looksHeader ? table.slice(1) : table;
  }

  const data = [];
  for (const cols of body) {
    const row = {};
    for (const [field] of spec) {
      const idx = colOf[field];
      row[field] = idx !== undefined ? (cols[idx] || '').trim() : '';
    }

    // koordinat: kolom koordinat → kolom link → sel mana pun yang berisi koordinat
    let ll = coordFromText(row.ll) || coordFromText(row.link_maps);
    if (!ll) for (const c of cols) { ll = coordFromText(c); if (ll) break; }
    delete row.ll;
    row.latlong = ll;
    row.longlat = ll;

    // cadangan kab/kec dari alamat
    if (!row.kabupaten || !row.kecamatan) {
      const a = fromAddress(row.alamat);
      if (!row.kabupaten) row.kabupaten = a.kabupaten;
      if (!row.kecamatan) row.kecamatan = a.kecamatan;
    }

    const name = row.pelanggan || row.nama;
    if (!name && !ll && !row.alamat) continue;
    row._type = type;
    data.push(row);
  }
  return { data, headers: header, mode };
}

async function loadTab(type) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(TABS[type])}`;
  try {
    const res = await fetch(url, { cache: 'no-store', redirect: 'follow' });
    const text = await res.text();
    if (!res.ok) throw new Error(`Google Sheet menolak akses (HTTP ${res.status}). Pastikan sharing = "Anyone with the link".`);
    if (/^\s*<(!doctype|html)/i.test(text)) {
      throw new Error('Google Sheet meminta login. Ubah sharing menjadi "Anyone with the link" (Viewer).');
    }
    const r = mapSheet(type, text);
    return { ok: true, tab: TABS[type], count: r.data.length, mode: r.mode, headers: r.headers, data: r.data };
  } catch (e) {
    return { ok: false, tab: TABS[type], error: e.message, count: 0, data: [] };
  }
}

export async function GET() {
  const types = Object.keys(TABS);
  const results = await Promise.all(types.map(loadTab));
  const out = { fetchedAt: new Date().toISOString() };
  types.forEach((t, i) => { out[t] = results[i]; });
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } });
}
