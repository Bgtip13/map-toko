'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import KecBoundary from './KecBoundary';
import Modal from './Modal';
import Toast from './Toast';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const iconDb = L.divIcon({ className: '', html: '<div class="marker-db"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
const iconManual = L.divIcon({ className: '', html: '<div class="marker-manual"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
const iconOsm = L.divIcon({ className: '', html: '<div class="marker-osm"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });
const iconNoo = L.divIcon({ className: '', html: '<div class="marker-noo"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

function parseLatLong(latlong) {
  if (!latlong) return null;
  const parts = String(latlong).split(',');
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lng)) return null;
  return [lat, lng];
}

const clean = (val) =>
  val && String(val).trim() !== '' && String(val) !== '#N/A' && String(val) !== 'N/A'
    ? String(val)
    : null;

function MapInteraction({ addMode, setAddMode, onAskNama }) {
  useMapEvents({
    click(e) {
      if (!addMode) return;
      setAddMode(false);
      onAskNama(e.latlng);
    }
  });
  return null;
}

let cacheGeo = null;
let cachePromise = null;
function loadBoundaries() {
  if (cacheGeo) return Promise.resolve(cacheGeo);
  if (!cachePromise) {
    cachePromise = fetch('/batas_kabupaten.geojson')
      .then(r => { if (!r.ok) throw new Error('no file'); return r.json(); })
      .then(j => { cacheGeo = j; return j; })
      .catch(() => { cachePromise = null; return null; });
  }
  return cachePromise;
}

function normName(n) {
  return String(n || '').toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\b(kabupaten|kab|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findFeature(geojson, name) {
  const target = normName(name);
  if (!target) return null;
  const feats = geojson && geojson.features ? geojson.features : [];
  const ambil = x => {
    const p = x.properties || {};
    return [p.shapeName, p.NAME_2, p.name, p.nama, p.ADM2_EN, p.ADM2_ID];
  };
  let f = feats.find(x => ambil(x).some(c => normName(c) === target));
  if (f) return f;
  return feats.find(x => ambil(x).some(c => {
    const nc = normName(c);
    return nc && (nc.includes(target) || target.includes(nc));
  }));
}

function MapController({ region, stores, nooStores, boundaries }) {
  const map = useMap();
  const last = useRef('');

  const fitToPoints = useCallback(() => {
    const dariToko = stores.map(s => parseLatLong(s.latlong)).filter(Boolean);
    const dariNoo = (nooStores || []).map(s => parseLatLong(s.longlat)).filter(Boolean);
    const points = [...dariToko, ...dariNoo];
    if (points.length > 0) map.fitBounds(points, { padding: [40, 40] });
  }, [stores, nooStores, map]);

  useEffect(() => {
    const parts = region.split('|');
    const kab = parts[1];
    const kec = parts[2];

    const key = kec
      ? `kec|${region}|s${stores.length}`
      : kab
        ? `kab|${kab}|${boundaries ? 'b' : 'n'}`
        : `all|${region}|s${stores.length}`;

    if (last.current === key) return;
    last.current = key;

    if (kec) {
      fitToPoints();
    } else if (kab) {
      const feat = boundaries ? findFeature(boundaries, kab) : null;
      if (feat) map.fitBounds(L.geoJSON(feat).getBounds(), { padding: [30, 30] });
      else fitToPoints();
    } else {
      fitToPoints();
    }
  }, [region, stores, boundaries, map, fitToPoints]);

  return null;
}

function BoundaryLayer({ boundaries, kabupaten }) {
  const feat = kabupaten && boundaries ? findFeature(boundaries, kabupaten) : null;
  if (!feat) return null;
  return (
    <GeoJSON
      key={kabupaten}
      data={feat}
      style={{ color: '#2563eb', weight: 2, fillColor: '#2563eb', fillOpacity: 0.08 }}
    />
  );
}

export default function MapView({ stores, nooStores, region, onDataChanged }) {
  const [boundaries, setBoundaries] = useState(null);
  const kabupaten = region.split('|')[1];
  const kecamatan = region.split('|')[2];
  const [addMode, setAddMode] = useState(false);
  const [osmStores, setOsmStores] = useState([]);
  const [loadingOsm, setLoadingOsm] = useState(false);
  const mapRef = useRef(null);

  const [namaModal, setNamaModal] = useState(null);
  const [nama, setNama] = useState('');
  const [confirmHapusId, setConfirmHapusId] = useState(null);
  const [toast, setToast] = useState(null);

  function showToast(teks, jenis = 'info') {
    setToast({ teks, jenis });
    setTimeout(() => setToast(null), 3500);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  }

  useEffect(() => {
    function onFs() {
      setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 300);
    }
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => { loadBoundaries().then(setBoundaries); }, []);

  const markers = stores.map(s => ({ ...s, pos: parseLatLong(s.latlong) })).filter(s => s.pos);

  async function loadOsmFile() {
    try {
      const res = await fetch('/petshop_osm.geojson');
      if (!res.ok) throw new Error('file belum ada di folder public');
      const geo = await res.json();
      const list = (geo.features || []).map((f, i) => {
        const c = f.geometry && f.geometry.coordinates;
        if (!c) return null;
        return {
          id: f.id || i,
          nama: (f.properties && f.properties.name) || 'Petshop Tanpa Nama',
          pos: [c[1], c[0]]
        };
      }).filter(Boolean);
      setOsmStores(list);
      if (list.length === 0) showToast('Tidak ada petshop di file OSM.', 'warn');
    } catch (e) {
      showToast('Gagal memuat data OSM: ' + e.message, 'error');
    }
  }

  async function simpanManual() {
    if (!namaModal) return;
    if (!nama.trim()) { showToast('⚠️ Nama toko wajib diisi.', 'warn'); return; }
    const latlong = `${namaModal.latlong.lat.toFixed(6)},${namaModal.latlong.lng.toFixed(6)}`;
    const { error } = await supabase.from('stores').insert([{ pelanggan: nama.trim(), latlong, sumber: 'manual' }]);
    if (error) showToast('❌ Gagal menambah titik: ' + error.message, 'error');
    else { showToast('✅ Titik baru tersimpan.', 'info'); onDataChanged(); }
    setNamaModal(null); setNama('');
  }

  async function konfirmasiHapusManual() {
    if (!confirmHapusId) return;
    await supabase.from('stores').delete().eq('id', confirmHapusId);
    showToast('🗑️ Titik manual dihapus.', 'info');
    setConfirmHapusId(null);
    onDataChanged();
  }

  return (
    <div className="map-wrap" style={{ position: 'relative' }}>
      <div className="map-controls">
        <button
          className={`btn ${addMode ? 'danger' : 'success'}`}
          onClick={() => setAddMode(!addMode)}
          style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
        >
          {addMode ? '✖ Batal Tambah Titik' : '📍 Tambah Titik Baru'}
        </button>
        <button
          className="btn"
          onClick={loadOsmFile}
          style={{ background: '#4b5563', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
        >
          {loadingOsm ? 'Memuat...' : '📂 Tampilkan Petshop OSM'}
        </button>
        <button
          className="btn"
          onClick={toggleFullscreen}
          style={{ background: '#0f766e', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
        >
          ⛶ Fullscreen
        </button>
      </div>

      <MapContainer
        center={[-2.5, 118]}
        zoom={5}
        style={{ height: '100%', width: '100%', cursor: addMode ? 'crosshair' : 'grab' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController region={region} stores={stores} nooStores={nooStores} boundaries={boundaries} />
        <BoundaryLayer boundaries={boundaries} kabupaten={kabupaten} />
        <KecBoundary kabupaten={kabupaten} kecamatan={kecamatan} stores={stores} />
        <MapInteraction
          addMode={addMode}
          setAddMode={setAddMode}
          onAskNama={(latlng) => { setNama(''); setNamaModal({ latlong: latlng }); }}
        />

        <MarkerClusterGroup chunkedLoading>
          {markers.map(s => {
            const isManual = s.sumber === 'manual';
            const nama = clean(s.pelanggan) || 'Toko Tanpa Nama';
            const area = clean(s.area);
            const kab = clean(s.kabupaten);
            const kec = clean(s.kecamatan);
            const alamat = clean(s.alamat);
            const linkMaps = clean(s.link_maps);
            const isLink = linkMaps && linkMaps.startsWith('http');

            return (
              <Marker key={`db-${s.id}`} position={s.pos} icon={isManual ? iconManual : iconDb}>
                <Popup minWidth={220}>
                  <div style={{ fontFamily: 'sans-serif', fontSize: 13 }}>
                    <span className={`badge ${isManual ? 'manual' : 'db'}`}>
                      {isManual ? 'Titik Baru (Manual)' : 'Dari Database Excel'}
                    </span>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: 15, borderBottom: '1px solid #eee', paddingBottom: 4 }}>{nama}</h3>

                    {isManual ? (
                      <button
                        onClick={() => setConfirmHapusId(s.id)}
                        style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', marginTop: 8 }}
                      >
                        Hapus Titik Ini
                      </button>
                    ) : (
                      <>
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr><th style={{ width: 80, padding: 2 }}>Wilayah</th><td>: {area ? `${area} - ` : ''}{kab} - {kec}</td></tr>
                            <tr><th style={{ padding: 2 }}>Status</th><td>: {clean(s.existing) || '-'}</td></tr>
                            <tr><th style={{ padding: 2 }}>Kelas Toko</th><td>: {clean(s.kelas_toko) || '-'}</td></tr>
                            <tr><th style={{ padding: 2 }}>Kelas Byr</th><td>: {clean(s.kelas_byr) || '-'}</td></tr>
                            <tr><th style={{ padding: 2 }}>Admin</th><td>: {clean(s.adm) || '-'}</td></tr>
                          </tbody>
                        </table>
                        {alamat && (
                          <div style={{ marginTop: 8, background: '#f9f9f9', padding: 6, borderRadius: 4 }}>
                            <strong>Alamat:</strong> <br/>{alamat}
                          </div>
                        )}
                        {isLink && (
                          <div style={{ marginTop: 10, textAlign: 'center' }}>
                            <a href={linkMaps} target="_blank" rel="noreferrer" style={{ background: '#2563eb', color: '#fff', textDecoration: 'none', padding: '6px 12px', borderRadius: 4, display: 'inline-block', fontSize: 12 }}>
                              Buka di Google Maps
                            </a>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>

        {(nooStores || []).map(s => {
          const pos = parseLatLong(s.longlat);
          if (!pos) return null;
          return (
            <Marker key={`noo-${s.id}`} position={pos} icon={iconNoo}>
              <Popup minWidth={220}>
                <div style={{ fontFamily: 'sans-serif', fontSize: 13 }}>
                  <span className="badge noo">Toko NOO (Kunjungan Sales)</span>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: 15, borderBottom: '1px solid #eee', paddingBottom: 4 }}>
                    {s.nama || 'Tanpa Nama'}
                  </h3>
                  {s.area && <div>Area: {s.area}</div>}
                  {s.no_hp && <div>📞 {s.no_hp}</div>}
                  {s.alamat && (
                    <div style={{ marginTop: 8, background: '#f9f9f9', padding: 6, borderRadius: 4 }}>
                      <strong>Alamat:</strong> <br/>{s.alamat}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {osmStores.map(s => (
          <Marker key={`osm-${s.id}`} position={s.pos} icon={iconOsm}>
            <Popup>
              <div style={{ fontFamily: 'sans-serif', fontSize: 13 }}>
                <span className="badge osm">Ditemukan di OpenStreetMap</span>
                <h3 style={{ margin: 0, fontSize: 15 }}>{s.nama}</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#666' }}>
                  Ada di peta publik, tapi belum tentu masuk database Excel kamu.
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <Modal
        open={!!namaModal}
        title="🏪 Nama Petshop Baru"
        message="Ketik nama toko yang kamu temukan:"
        value={nama}
        onChange={setNama}
        placeholder="Nama toko..."
        confirmText="Simpan"
        onConfirm={simpanManual}
        onCancel={() => { setNamaModal(null); setNama(''); }}
      />

      <Modal
        open={!!confirmHapusId}
        title="🗑️ Hapus Titik Ini?"
        message="Titik manual ini akan dihapus."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        onConfirm={konfirmasiHapusManual}
        onCancel={() => setConfirmHapusId(null)}
      />

      <Toast toast={toast} />
    </div>
  );
}
