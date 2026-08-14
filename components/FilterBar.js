'use client';

export default function FilterBar({ areas, kabupatens, kecamatans, area, kabupaten, kecamatan, cari, setArea, setKabupaten, setKecamatan, setCari, onApply, loading }) {
  return (
    <div className="card flex-row">
      <div className="input-group">
        <label>Area</label>
        <select className="input" value={area} onChange={e => { setArea(e.target.value); setKabupaten(''); setKecamatan(''); }}>
          <option value="">Semua Area</option>
          {areas.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="input-group">
        <label>Kabupaten</label>
        <select className="input" value={kabupaten} onChange={e => { setKabupaten(e.target.value); setKecamatan(''); }}>
          <option value="">Semua Kabupaten</option>
          {kabupatens.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div className="input-group">
        <label>Kecamatan</label>
        <select className="input" value={kecamatan} onChange={e => setKecamatan(e.target.value)}>
          <option value="">Semua Kecamatan</option>
          {kecamatans.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div className="input-group">
        <label>Nama Toko</label>
        <input className="input" placeholder="Cari nama..." value={cari} onChange={e => setCari(e.target.value)} />
      </div>
      <button className="btn" onClick={onApply}>
        {loading ? 'Memuat...' : 'Terapkan Filter'}
      </button>
    </div>
  );
}
