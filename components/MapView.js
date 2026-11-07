'use client';
import { useState, useEffect } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup,
  useMap, useMapEvents, GeoJSON
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';

/* ── ICONS ── */
function makeIcon(color, size = 10) {
  return L.divIcon({
    className: '',
    html: '<div style="width:' + size + 'px;height:' + size + 'px;background:' + color + ';border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
const ICONS = {
  toko: makeIcon('#2563eb'),
  noo: makeIcon('#eab308'),
  potensi: makeIcon('#ef4444'),
  manual: makeIcon('#8b5cf6'),
};

/* ── PARSE LAT/LNG ── */
function parseLL(str) {
  if (!str || typeof str !== 'string') return null;
  const clean = str.replace(/\s+/g, '');
  const parts = clean.split(/[,;|]/);
  if (parts.length < 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

/* ── NORMALISASI ── */
function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z]/g, '');
}

/* ══════════════════════════════════════════════════════════
   KODE WILAYAH — KODE BPS RESMI INDONESIA
   Source: BPS / GADM / Kemendagri

   JAWA TENGAH:
     Kab 3301-3329, Kota 3371-3376
   DI YOGYAKARTA:
     Kab 3401-3404, Kota 3471
   ══════════════════════════════════════════════════════════ */

// ── KOTA — HANYA dipakai kalau ada prefix "KOTA" ──
const KAB_KOTA = {
  'magelang': '3371',      // Kota Magelang
  'surakarta': '3372',     // Kota Surakarta / Solo
  'salatiga': '3373',      // Kota Salatiga
  'semarang': '3374',      // Kota Semarang
  'pekalongan': '3375',    // Kota Pekalongan
  'tegal': '3376',         // Kota Tegal
  'yogyakarta': '3471',    // Kota Yogyakarta
};

// ── KABUPATEN — untuk prefix "KAB." / "KAB" ──
const KAB_KAB = {
  'semarang': '3322',      // Kab. Semarang
  'pekalongan': '3326',    // Kab. Pekalongan
  'tegal': '3328',         // Kab. Tegal
  'magelang': '3308',      // Kab. Magelang
};

// ── DEFAULT — tanpa prefix "KAB"/"KOTA" ──
// Untuk nama yang HANYA kota (tidak punya kabupaten dengan nama sama), arahkan ke kota
// Untuk nama yang punya kabupaten, arahkan ke kabupaten
const KAB_CODE = {
  // === JAWA TENGAH — KABUPATEN ===
  'cilacap': '3301',
  'banyumas': '3302',
  'purbalingga': '3303',
  'banjarnegara': '3304',
  'kebumen': '3305',
  'purworejo': '3306',
  'wonosobo': '3307',
  'magelang': '3308',      // default = kabupaten
  'boyolali': '3309',
  'klaten': '3310',
  'sukoharjo': '3311',
  'wonogiri': '3312',
  'karanganyar': '3313',
  'sragen': '3314',
  'grobogan': '3315',
  'blora': '3316',
  'rembang': '3317',
  'pati': '3318',
  'kudus': '3319',
  'jepara': '3320',
  'demak': '3321',
  'semarang': '3374', 
  'temanggung': '3323',
  'kendal': '3324',
  'batang': '3325',
  'pekalongan': '3326',    // default = kabupaten
  'pemalang': '3327',
  'tegal': '3328',          // default = kabupaten
  'brebes': '3329',

  // === DI YOGYAKARTA — KABUPATEN ===
  'bantul': '3402',
  'gunungkidul': '3403',
  'sleman': '3404',
  'kulonprogo': '3401',

  // === KOTA-KOTA KHUSUS (hanya ada kota, tidak ada kabupaten nama sama) ===
  'surakarta': '3372',     // Solo = kota
  'yogyakarta': '3471',    // Jogja = kota
  'salatiga': '3373',      // Salatiga = kota
};

// ── ALIAS TAMBAHAN ──
const KAB_ALIAS = {
  'solo': '3372',
  'jogja': '3471',
  'gunung kidul': '3403',
  'kulon progo': '3401',
  'kota surakarta': '3372',
  'kota yogyakarta': '3471',
  'kota semarang': '3374',
  'kota magelang': '3371',
  'kota pekalongan': '3375',
  'kota tegal': '3376',
  'kota salatiga': '3373',
  'kab semarang': '3322',
  'kab pekalongan': '3326',
  'kab tegal': '3328',
  'kab magelang': '3308',
};

/* ── FIND KODE KABUPATEN ── */
function findKabCode(name) {
  if (!name) return null;
  const raw = name.trim();
  const n = norm(raw);
  const hasKab = /^kab/i.test(raw);
  const hasKota = /^kota/i.test(raw);

  // 0. Cek alias dulu
  const al = norm(raw.replace(/\./g, ''));
  for (const [k, c] of Object.entries(KAB_ALIAS)) {
    if (norm(k) === al) return c;
  }

  // 1. Tanpa prefix → cek KAB_CODE langsung
  if (!hasKab && !hasKota) {
    if (KAB_CODE[n]) return KAB_CODE[n];
  }

  // 2. Prefix "KAB." → cari di KAB_KAB dulu, fallback KAB_CODE
  if (hasKab) {
    const s = n.replace(/^kab/, '');
    if (KAB_KAB[s]) return KAB_KAB[s];
    if (KAB_CODE[s]) return KAB_CODE[s];
  }

  // 3. Prefix "KOTA" → cari di KAB_KOTA dulu, fallback KAB_CODE
  if (hasKota) {
    const s = n.replace(/^kota/, '');
    if (KAB_KOTA[s]) return KAB_KOTA[s];
    if (KAB_CODE[s]) return KAB_CODE[s];
  }

  // 4. Fuzzy fallback
  for (const [k, c] of Object.entries(KAB_CODE)) {
    if (n.includes(norm(k)) || norm(k).includes(n)) return c;
  }
  for (const [k, c] of Object.entries(KAB_KOTA)) {
    if (n.includes(norm(k)) || norm(k).includes(n)) return c;
  }
  return null;
}

/* ── FETCH BOUNDARY ──
   Semua batas kabupaten/kota ada di satu file: /batas_kabupaten.geojson
   (properties.shapeName, mis. "Semarang", "Kota Semarang"). */
const BOUNDARY_URL = '/batas_kabupaten.geojson';
let boundaryPromise = null;
let boundaryCache = null;

function loadBoundaries() {
  if (boundaryCache) return Promise.resolve(boundaryCache);
  if (!boundaryPromise) {
    boundaryPromise = fetch(BOUNDARY_URL)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        boundaryCache = d && Array.isArray(d.features) ? d : null;
        return boundaryCache;
      })
      .catch(e => {
        console.warn('[Boundary] Gagal load:', e.message);
        return null;
      });
  }
  return boundaryPromise;
}

/* nama wilayah tanpa awalan KAB. / KABUPATEN / KOTA */
function wilKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/^\s*(kabupaten|kab|kota)\b[\s.]*/, '')
    .replace(/[^a-z0-9]/g, '');
}
const isKotaName = s => /^\s*kota\b/i.test(String(s || ''));

function findKabFeature(features, name) {
  const target = wilKey(name);
  if (!target || !features || features.length === 0) return null;

  const shapeName = f => (f.properties && (f.properties.shapeName || f.properties.name)) || '';
  const pick = list => {
    if (!list.length) return null;
    const kota = list.filter(f => isKotaName(shapeName(f)));
    const kab = list.filter(f => !isKotaName(shapeName(f)));
    // "KOTA X" → kota dulu; "KAB. X" / "X" → kabupaten dulu
    return isKotaName(name) ? (kota[0] || kab[0]) : (kab[0] || kota[0]);
  };

  const exact = features.filter(f => wilKey(shapeName(f)) === target);
  const hit = pick(exact);
  if (hit) return hit;

  const fuzzy = features.filter(f => {
    const n = wilKey(shapeName(f));
    return n && (n.includes(target) || target.includes(n));
  });
  return pick(fuzzy);
}

/* ── GEO CENTER ── */
function geoCenter(g) {
  let sLat = 0, sLng = 0, n = 0;
  function walk(c) {
    if (typeof c[0] === 'number') { sLng += c[0]; sLat += c[1]; n++; }
    else if (Array.isArray(c)) c.forEach(walk);
  }
  if (g && g.features) g.features.forEach(f => { if (f.geometry) walk(f.geometry.coordinates); });
  return n ? [sLat / n, sLng / n] : [-7.5, 110.5];
}

/* ══════════════════════════════════════════
   INNER COMPONENTS
   ══════════════════════════════════════════ */

function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom, { duration: 1.2 });
  }, [center[0], center[1], zoom]);
  return null;
}

function ClickHandler({ onClick }) {
  useMapEvents({ click: e => onClick(e.latlng) });
  return null;
}

/* ── POPUP COMPONENTS ── */
function TokoPopup({ d }) {
  return (
    <div style={{ fontFamily: 'sans-serif', minWidth: 180, maxWidth: 280 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#1e40af', marginBottom: 6, borderBottom: '2px solid #dbeafe', paddingBottom: 4 }}>
        {d.pelanggan || 'Tanpa Nama'}
      </div>
      <div style={{ fontSize: 12, color: '#444', marginBottom: 3 }}>
        📍 {d.alamat || '-'}
      </div>
      <div style={{ fontSize: 12, color: '#444', marginBottom: 3 }}>
        🏘️ {d.kabupaten || '-'} → {d.kecamatan || '-'}
      </div>
      {d.area && <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>🏷️ Area: {d.area}</div>}
      {d.existing && <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>📋 Status: {d.existing}</div>}
      {d.adm && <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>👤 ADM: {d.adm}</div>}
      {d.kelas_toko && <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>⭐ Kelas Toko: {d.kelas_toko}</div>}
      {d.kelas_byr && <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>💰 Kelas Bayar: {d.kelas_byr}</div>}
      {d.link_maps && (
        <div style={{ marginTop: 6 }}>
          <a href={d.link_maps} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: '#2563eb', textDecoration: 'underline' }}>
            🗺️ Buka di Google Maps
          </a>
        </div>
      )}
    </div>
  );
}

function NooPopup({ d }) {
  return (
    <div style={{ fontFamily: 'sans-serif', minWidth: 180, maxWidth: 280 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#a16207', marginBottom: 6, borderBottom: '2px solid #fef3c7', paddingBottom: 4 }}>
        {d.nama || 'Tanpa Nama'}
      </div>
      <div style={{ fontSize: 12, color: '#444', marginBottom: 3 }}>📍 {d.alamat || '-'}</div>
      <div style={{ fontSize: 12, color: '#444' }}>🏘️ {d.kabupaten || '-'} → {d.kecamatan || '-'}</div>
    </div>
  );
}

function PotensiPopup({ d }) {
  return (
    <div style={{ fontFamily: 'sans-serif', minWidth: 180, maxWidth: 280 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#dc2626', marginBottom: 6, borderBottom: '2px solid #fee2e2', paddingBottom: 4 }}>
        {d.nama || 'Tanpa Nama'}
      </div>
      <div style={{ fontSize: 12, color: '#444', marginBottom: 3 }}>📍 {d.alamat || '-'}</div>
      <div style={{ fontSize: 12, color: '#444', marginBottom: 3 }}>🏘️ {d.kabupaten || '-'} → {d.kecamatan || '-'}</div>
      {d.link_maps && (
        <div style={{ marginTop: 4 }}>
          <a href={d.link_maps} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: '#2563eb', textDecoration: 'underline' }}>
            🔗 Link
          </a>
        </div>
      )}
    </div>
  );
}

function ManualPopup({ d }) {
  return (
    <div style={{ fontFamily: 'sans-serif', minWidth: 160 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#7c3aed', marginBottom: 4 }}>{d.nama || 'Titik Manual'}</div>
      <div style={{ fontSize: 12, color: '#555' }}>📝 {d.keterangan || '-'}</div>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN MAPVIEW COMPONENT
   ══════════════════════════════════════════ */
export default function MapView({ tokoData, nooData, potensiData, manualData, region, onRegionChange }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [kabBound, setKabBound] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [clickPos, setClickPos] = useState(null);
  const [form, setForm] = useState({ nama: '', keterangan: '' });

  // ── Load batas kabupaten/kota ──
  useEffect(() => {
    let cancelled = false;
    setKabBound(null);
    if (!region.kabupaten) return;

    loadBoundaries().then(fc => {
      if (cancelled || !fc) return;
      const feat = findKabFeature(fc.features, region.kabupaten);
      if (feat) setKabBound({ type: 'FeatureCollection', features: [feat] });
    });

    return () => { cancelled = true; };
  }, [region.kabupaten]);

  // ── FlyTo center ──
  const flyCenter = region.kabupaten && kabBound
    ? geoCenter(kabBound)
    : [-7.5, 110.5];
  const flyZoom = region.kecamatan ? 13 : region.kabupaten ? 10 : 8;

  // ── Save manual point ──
  async function saveManual() {
    if (!clickPos || !form.nama) return;
    if (!supabase) {
      alert('Titik manual butuh Supabase. Isi NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY dulu.');
      return;
    }
    try {
      const { error } = await supabase.from('manual_points').insert({
        nama: form.nama,
        longlat: clickPos.lat + ',' + clickPos.lng,
        keterangan: form.keterangan,
      });
      if (error) throw new Error(error.message);
      setShowModal(false);
      setClickPos(null);
      setForm({ nama: '', keterangan: '' });
      window.location.reload();
    } catch (e) {
      alert('Gagal simpan: ' + e.message);
    }
  }

  // ── Fullscreen filter handlers ──
  function handleFSFilterChange(key, val) {
    if (onRegionChange) {
      if (key === 'kabupaten') {
        onRegionChange({ kabupaten: val, kecamatan: '' });
      } else {
        onRegionChange({ ...region, kecamatan: val });
      }
    }
  }

  // ── Get unique lists for filters ──
  const allKab = [...new Set([...(tokoData || []), ...(nooData || []), ...(potensiData || [])].map(d => d.kabupaten).filter(Boolean))].sort();
  const allKec = [...new Set(
    [...(tokoData || []), ...(nooData || []), ...(potensiData || [])]
      .filter(d => !region.kabupaten || d.kabupaten === region.kabupaten)
      .map(d => d.kecamatan).filter(Boolean)
  )].sort();

  // ── Render ──
  const wrapStyle = fullscreen
    ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, background: '#fff' }
    : { height: 500, borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', position: 'relative' };

  return (
    <div style={wrapStyle}>
      <MapContainer center={[-7.5, 110.5]} zoom={8} style={{ height: '100%', width: '100%' }}
        zoomControl={true}>
        <TileLayer
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FlyTo center={flyCenter} zoom={flyZoom} />
        <ClickHandler onClick={latlng => { setClickPos(latlng); setShowModal(true); }} />

        {/* Batas kabupaten/kota */}
        {kabBound && (
          <GeoJSON key={'kab-' + region.kabupaten} data={kabBound}
            style={() => ({ color: '#2563eb', weight: 2.5, fillOpacity: 0.04, fillColor: '#2563eb' })} />
        )}

        {/* Toko Existing */}
        {(tokoData || []).map((d, i) => {
          const ll = parseLL(d.latlong);
          if (!ll) return null;
          return (
            <Marker key={'t-' + i} position={ll} icon={ICONS.toko}>
              <Popup><TokoPopup d={d} /></Popup>
            </Marker>
          );
        })}

        {/* NOO */}
        {(nooData || []).map((d, i) => {
          const ll = parseLL(d.longlat);
          if (!ll) return null;
          return (
            <Marker key={'n-' + i} position={ll} icon={ICONS.noo}>
              <Popup><NooPopup d={d} /></Popup>
            </Marker>
          );
        })}

        {/* Potensi / Saran */}
        {(potensiData || []).map((d, i) => {
          const ll = parseLL(d.longlat);
          if (!ll) return null;
          return (
            <Marker key={'p-' + i} position={ll} icon={ICONS.potensi}>
              <Popup><PotensiPopup d={d} /></Popup>
            </Marker>
          );
        })}

        {/* Manual */}
        {(manualData || []).map((d, i) => {
          const ll = parseLL(d.longlat);
          if (!ll) return null;
          return (
            <Marker key={'m-' + i} position={ll} icon={ICONS.manual}>
              <Popup><ManualPopup d={d} /></Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* ── Fullscreen mode: filter + close button ── */}
      {fullscreen && (
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10001, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          {/* Filter kecil di fullscreen */}
          <div style={{
            background: 'rgba(255,255,255,0.95)', borderRadius: 8, padding: '6px 10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)', display: 'flex', gap: 6, alignItems: 'center',
            fontSize: 12,
          }}>
            <select value={region.kabupaten || ''} onChange={e => handleFSFilterChange('kabupaten', e.target.value)}
              style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #ccc', fontSize: 12, maxWidth: 150 }}>
              <option value="">Semua Kab/Kota</option>
              {allKab.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <select value={region.kecamatan || ''} onChange={e => handleFSFilterChange('kecamatan', e.target.value)}
              style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #ccc', fontSize: 12, maxWidth: 150 }}>
              <option value="">Semua Kecamatan</option>
              {allKec.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          {/* Tombol keluar fullscreen */}
          <button onClick={() => setFullscreen(false)} style={{
            background: '#ef4444', color: '#fff', border: 'none', padding: '5px 12px',
            borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}>
            ✕ Keluar
          </button>
        </div>
      )}

      {/* ── Expand button (normal mode) ── */}
      {!fullscreen && (
        <button onClick={() => setFullscreen(true)} style={{
          position: 'absolute', top: 10, right: 10, zIndex: 1000,
          background: '#1e40af', color: '#fff', border: 'none', padding: '6px 12px',
          borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12,
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
        }}>
          ⛶ Fullscreen
        </button>
      )}

      {/* ── Legend ── */}
      {!fullscreen && (
        <div style={{
          position: 'absolute', bottom: 10, left: 10, zIndex: 1000,
          background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '6px 10px',
          fontSize: 11, display: 'flex', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
        }}>
          <span><span style={{ color: '#2563eb' }}>●</span> Existing</span>
          <span><span style={{ color: '#8b5cf6' }}>●</span> Manual</span>
        </div>
      )}

      {/* ── Manual point modal ── */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 10002
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 24, width: 340,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)'
          }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>📍 Tambah Titik Manual</h3>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
              Koordinat: {clickPos ? clickPos.lat.toFixed(6) + ', ' + clickPos.lng.toFixed(6) : '-'}
            </div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Nama *</label>
            <input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })}
              placeholder="Nama titik"
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd',
                fontSize: 13, boxSizing: 'border-box', marginBottom: 10 }} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Keterangan</label>
            <input value={form.keterangan} onChange={e => setForm({ ...form, keterangan: e.target.value })}
              placeholder="Keterangan (opsional)"
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd',
                fontSize: 13, boxSizing: 'border-box', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setClickPos(null); }}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#f1f5f9', border: '1px solid #ddd',
                  cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Batal</button>
              <button onClick={saveManual}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#7c3aed', color: '#fff',
                  border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>💾 Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
