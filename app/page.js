'use client';
import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../lib/supabase';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z]/g, '');
}

function hasCoord(d) {
  const ll = d.latlong || d.longlat;
  return !!(ll && typeof ll === 'string' && ll.includes(','));
}

export default function HomePage() {
  const [tokoData, setTokoData] = useState([]);
  const [manualData, setManualData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [region, setRegion] = useState({ area: '', kabupaten: '', kecamatan: '' });

  async function loadData(silent = false) {
    if (silent) setRefreshing(true); else setLoading(true);
    const errs = [];
    try {
      // Sumber utama: Google Sheet (lewat /api/sheet)
      const res = await fetch('/api/sheet', { cache: 'no-store' });
      if (!res.ok) throw new Error('Server error ' + res.status);
      const j = await res.json();
      const take = (key, label, setter) => {
        const r = j[key];
        if (r && r.ok) setter(r.data || []);
        else errs.push(label + ' (tab ' + (r ? r.tab : key) + '): ' + (r ? r.error : 'tidak ada respons'));
      };
      take('existing', 'Toko Existing', setTokoData);
      setLastSync(new Date());
    } catch (e) {
      errs.push('Gagal mengambil data Google Sheet: ' + e.message);
    }

    // Titik manual (opsional) — kalau gagal, peta tetap jalan
    try {
      const m = await supabase.from('manual_points').select('*');
      setManualData(m.error ? [] : (m.data || []));
    } catch (e) {
      setManualData([]);
    }

    setErrors(errs);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    loadData();
    const t = setInterval(() => loadData(true), 5 * 60 * 1000); // sinkron otomatis tiap 5 menit
    return () => clearInterval(t);
  }, []);

  /* ── Filtered data ── */
  const filteredToko = useMemo(() => {
    let d = tokoData;
    if (region.area) d = d.filter(r => norm(r.area) === norm(region.area));
    if (region.kabupaten) d = d.filter(r => norm(r.kabupaten) === norm(region.kabupaten));
    if (region.kecamatan) d = d.filter(r => norm(r.kecamatan) === norm(region.kecamatan));
    return d;
  }, [tokoData, region]);

  const filteredManual = manualData;

  /* ── Stats ── */
    const sheetRows = tokoData.length;
  const withCoord = tokoData.filter(hasCoord).length;
  const noCoord = sheetRows - withCoord;

  /* ── Unique values for filters ── */
  const allData = tokoData;
  const areas = [...new Set(allData.map(d => d.area).filter(Boolean))].sort();
  const kabupatens = [...new Set(
    allData
      .filter(d => !region.area || norm(d.area) === norm(region.area))
      .map(d => d.kabupaten)
      .filter(Boolean)
  )].sort();
  const kecamatans = [...new Set(
    allData
      .filter(d => !region.kabupaten || norm(d.kabupaten) === norm(region.kabupaten))
      .map(d => d.kecamatan)
      .filter(Boolean)
  )].sort();

  /* ── Summary per kabupaten ── */
  const kabSummary = useMemo(() => {
    const map = {};
    tokoData.forEach(d => {
      const k = d.kabupaten || 'Tidak diketahui';
      if (!map[k]) map[k] = { kab: k, total: 0, adaKoord: 0 };
      map[k].total++;
      if (hasCoord(d)) map[k].adaKoord++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [tokoData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#334155' }}>Memuat data...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f1f5f9', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
        color: '#fff', padding: '16px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>🗺️ Peta Sebaran Toko</h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.8 }}>
            Dashboard monitoring lokasi toko & pelanggan
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {lastSync && (
            <span style={{ fontSize: 11, opacity: 0.85 }}>
              Sinkron Google Sheet: {lastSync.toLocaleTimeString('id-ID')}
            </span>
          )}
          <button onClick={() => loadData(true)} disabled={refreshing}
            style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.15)',
              color: '#fff', border: '1px solid rgba(255,255,255,0.3)', cursor: refreshing ? 'wait' : 'pointer',
              fontWeight: 600, fontSize: 12 }}>
            {refreshing ? '⏳ Memuat...' : '🔄 Refresh dari Sheet'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 20px' }}>
        {errors.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
            borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            <strong>⚠️ Data belum lengkap dimuat:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12, marginBottom: 16 }}>
          <StatCard value={tokoData.length} label="🏠 Toko Existing" color="#2563eb" />
          <StatCard value={manualData.length} label="🟣 Manual" color="#8b5cf6" />
          <StatCard value={withCoord} label="✅ Ada Koordinat" color="#16a34a" />
          <StatCard value={noCoord} label="❌ Belum Ada Koord." color="#dc2626" />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={region.area} onChange={e => setRegion({ area: e.target.value, kabupaten: '', kecamatan: '' })}
            style={selectStyle}>
            <option value="">📍 Semua Area</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={region.kabupaten} onChange={e => setRegion({ ...region, kabupaten: e.target.value, kecamatan: '' })}
            style={selectStyle}>
            <option value="">🏙️ Semua Kabupaten/Kota</option>
            {kabupatens.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={region.kecamatan} onChange={e => setRegion({ ...region, kecamatan: e.target.value })}
            style={selectStyle}>
            <option value="">🏘️ Semua Kecamatan</option>
            {kecamatans.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          {(region.area || region.kabupaten || region.kecamatan) && (
            <button onClick={() => setRegion({ area: '', kabupaten: '', kecamatan: '' })}
              style={{ padding: '8px 14px', borderRadius: 10, background: '#f1f5f9',
                border: '1px solid #d1d5db', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              ✕ Reset Filter
            </button>
          )}
        </div>

        {/* Map */}
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <MapView
            tokoData={filteredToko}
            nooData={[]}
            potensiData={[]}
            manualData={filteredManual}
            region={region}
            onRegionChange={setRegion}
          />
        </div>

        {/* Kabupaten Summary */}
        {kabSummary.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, padding: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
              📊 Ringkasan per Kabupaten/Kota ({kabSummary.length} wilayah)
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Kabupaten/Kota</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Total</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Ada Koordinat</th>
                  </tr>
                </thead>
                <tbody>
                  {kabSummary.map((s, i) => (
                    <tr key={s.kab} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                      onClick={() => setRegion({ ...region, kabupaten: s.kab, kecamatan: '' })}
                      onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseOut={e => e.currentTarget.style.background = ''}>
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{s.kab}</td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{s.total}</td>
                      <td style={{ ...tdStyle, textAlign: 'center', color: '#16a34a' }}>{s.adaKoord}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ value, label, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  );
}

const selectStyle = {
  padding: '8px 12px', borderRadius: 10, border: '1px solid #d1d5db',
  fontSize: 13, background: '#fff', cursor: 'pointer', minWidth: 180,
};
const thStyle = {
  textAlign: 'left', padding: '8px 10px', fontWeight: 700, color: '#475569', fontSize: 12,
};
const tdStyle = {
  padding: '8px 10px', color: '#334155',
};
