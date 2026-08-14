'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import FilterBar from '../components/FilterBar';
import PasteImport from '../components/PasteImport';
import { supabase } from '../lib/supabase';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

export default function Page() {
  const [areas, setAreas] = useState([]);
  const [kabupatens, setKabupatens] = useState([]);
  const [kecamatans, setKecamatans] = useState([]);
  const [area, setArea] = useState('');
  const [kabupaten, setKabupaten] = useState('');
  const [kecamatan, setKecamatan] = useState('');
  const [cari, setCari] = useState('');
  const [stores, setStores] = useState([]);
  const [nooStores, setNooStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('stores').select('area').not('area', 'is', null);
      if (data) setAreas([...new Set(data.map(d => d.area))].sort());
    }
    load();
  }, [refresh]);

  useEffect(() => {
    async function load() {
      let q = supabase.from('stores').select('kabupaten').not('kabupaten', 'is', null);
      if (area) q = q.eq('area', area);
      const { data } = await q;
      if (data) setKabupatens([...new Set(data.map(d => d.kabupaten))].sort());
    }
    load();
  }, [area, refresh]);

  useEffect(() => {
    async function load() {
      let q = supabase.from('stores').select('kecamatan').not('kecamatan', 'is', null);
      if (area) q = q.eq('area', area);
      if (kabupaten) q = q.eq('kabupaten', kabupaten);
      const { data } = await q;
      if (data) setKecamatans([...new Set(data.map(d => d.kecamatan))].sort());
    }
    load();
  }, [area, kabupaten, refresh]);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('stores').select('*');
    if (area) q = q.eq('area', area);
    if (kabupaten) q = q.eq('kabupaten', kabupaten);
    if (kecamatan) q = q.eq('kecamatan', kecamatan);
    if (cari) q = q.ilike('pelanggan', `%${cari}%`);
    const { data, error } = await q;
    setLoading(false);
    if (error) { console.error(error); return; }
    setStores(data);
  }, [area, kabupaten, kecamatan, cari]);

  useEffect(() => { fetchStores(); }, [fetchStores, refresh]);

  // ambil data toko NOO
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('noo').select('*');
      if (!error && data) setNooStores(data);
    }
    load();
  }, [refresh]);

  const tokoPunyaTitik = stores.filter(s => s.latlong).length;
  const tokoTanpaTitik = stores.length - tokoPunyaTitik;

  return (
    <>
      <div className="header">
        <h1>📍 Peta Sebaran Toko</h1>
      </div>
      <div className="container">

        <div className="stats-grid">
          <div className="stat-box">
            <h4>Total Data Toko</h4>
            <p>{stores.length}</p>
          </div>
          <div className="stat-box success">
            <h4>Tampil di Peta</h4>
            <p>{tokoPunyaTitik}</p>
          </div>
          <div className="stat-box danger">
            <h4>Belum Ada Koordinat</h4>
            <p>{tokoTanpaTitik}</p>
          </div>
          <div className="stat-box" style={{ borderLeftColor: '#eab308' }}>
            <h4>Toko NOO (Sales)</h4>
            <p>{nooStores.length}</p>
          </div>
        </div>

        <FilterBar
          areas={areas} kabupatens={kabupatens} kecamatans={kecamatans}
          area={area} kabupaten={kabupaten} kecamatan={kecamatan} cari={cari}
          setArea={setArea} setKabupaten={setKabupaten} setKecamatan={setKecamatan} setCari={setCari}
          onApply={fetchStores} loading={loading}
        />

        <PasteImport onDone={() => setRefresh(r => r + 1)} />

        <MapView
          stores={stores}
          nooStores={nooStores}
          region={`${area}|${kabupaten}|${kecamatan}`}
          onDataChanged={() => setRefresh(r => r + 1)}
        />
      </div>
    </>
  );
}
