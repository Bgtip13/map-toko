'use client';

import { useEffect, useState } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';

const cacheKec = {};

function normName(n) {
  return String(n || '').toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\b(kabupaten|kab|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ubah hasil Overpass (elements) jadi GeoJSON features
function overpassToGeoJSON(elements) {
  return (elements || []).map((el, i) => {
    const geom = el.geometry || [];
    const coords = geom.map(p => [p.lon, p.lat]);
    return {
      id: el.id || i,
      type: 'Feature',
      properties: { nama: el.tags && el.tags.name ? el.tags.name : '' },
      geometry: coords.length >= 4 ? { type: 'Polygon', coordinates: [coords] } : null
    };
  }).filter(f => f.geometry);
}

function findKec(features, name) {
  const target = normName(name);
  if (!target) return null;
  let f = features.find(x => normName(x.properties.nama) === target);
  if (f) return f;
  return features.find(x => {
    const nc = normName(x.properties.nama);
    return nc && (nc.includes(target) || target.includes(nc));
  });
}

export default function KecBoundary({ kabupaten, kecamatan, stores }) {
  const map = useMap();
  const [features, setFeatures] = useState(null);

  // muat batas kecamatan untuk kabupaten yang dipilih (di-cache)
  useEffect(() => {
    setFeatures(null);
    const key = normName(kabupaten);
    if (!key) return;

    if (cacheKec[key]) { setFeatures(cacheKec[key]); return; }

    fetch('/api/kecamatan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kabupaten })
    })
      .then(async r => {
        if (!r.ok) throw new Error('not found');
        const data = await r.json();
        return overpassToGeoJSON(data.elements);
      })
      .then(fs => {
        cacheKec[key] = fs;
        setFeatures(fs);
      })
      .catch(() => console.warn('KecBoundary: gagal memuat kecamatan untuk', kabupaten));
  }, [kabupaten]);

  // zoom ke kecamatan yang dipilih
  useEffect(() => {
    if (!kecamatan || !features) return;
    const feat = findKec(features, kecamatan);
    if (feat) map.fitBounds(L.geoJSON(feat).getBounds(), { padding: [40, 40] });
  }, [kecamatan, features, map, stores]);

  if (!features || features.length === 0) return null;

  const selected = kecamatan ? findKec(features, kecamatan) : null;

  return (
    <>
      {features.map((f, i) => (
        <GeoJSON
          key={f.id || i}
          data={f}
          style={selected && f === selected
            ? { color: '#f97316', weight: 3, fillColor: '#f97316', fillOpacity: 0.15 }
            : { color: '#94a3b8', weight: 1, fillColor: 'transparent', fillOpacity: 0 }}
        />
      ))}
    </>
  );
}
