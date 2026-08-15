'use client';

import { useEffect, useState } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';

const KAB_KODE = {
  cilacap:'3301', banyumas:'3302', purbalingga:'3303', banjarnegara:'3304',
  kebumen:'3305', purworejo:'3306', wonosobo:'3307', magelang:'3308',
  boyolali:'3309', klaten:'3310', sukoharjo:'3311', wonogiri:'3312',
  karanganyar:'3313', sragen:'3314', grobogan:'3315', blora:'3316',
  rembang:'3317', pati:'3318', kudus:'3319', jepara:'3320', demak:'3321',
  semarang:'3322', temanggung:'3323', kendal:'3324', batang:'3325',
  pekalongan:'3326', pemalang:'3327', tegal:'3328', brebes:'3329',
  kotamagelang:'3371', kotasurakarta:'3372', kotasalatiga:'3373',
  kotasemarang:'3374', kotapekalongan:'3375', kotategal:'3376',
  kulonprogo:'3401', bantul:'3402', gunungkidul:'3403', sleman:'3404',
  kotayogyakarta:'3471'
};

const cacheKec = {};

function normName(n) {
  return String(n || '').toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\b(kabupaten|kab|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

  // muat dari file lokal /kecamatan/{kode}.json — dijamin jalan tanpa server
  useEffect(() => {
    setFeatures(null);
    if (!kabupaten) return;
    const kode = KAB_KODE[normName(kabupaten).replace(/\s+/g, '')];
    if (!kode) return;

    if (cacheKec[kode]) { setFeatures(cacheKec[kode]); return; }

    fetch('/kecamatan/' + kode + '.json')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(j => {
        const fs = (j.features || []).map((f, i) => ({
          id: f.id || i,
          type: 'Feature',
          properties: {
            nama: (f.properties && (f.properties.name || f.properties.kecamatan || f.properties.KECAMATAN || f.properties.nama || f.properties.kec || f.properties.nm_kec)) || ''
          },
          geometry: f.geometry
        })).filter(f => f.geometry);
        cacheKec[kode] = fs;
        setFeatures(fs);
      })
      .catch(() => { /* file tidak ada — tidak masalah */ });
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
