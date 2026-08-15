'use client';
import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Modal from './Modal';
import Toast from './Toast';

const PIN = '1234'; // 🔑 GANTI dengan PIN kamu sendiri

export default function PasteImport({ onDone }) {
  const [text, setText] = useState('');       // toko utama
  const [nooText, setNooText] = useState(''); // toko NOO
  const [toast, setToast] = useState(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const pending = useRef(null); // { aksi, target, baris }

  function showToast(teks, jenis = 'info') {
    setToast({ teks, jenis });
    setTimeout(() => setToast(null), 3500);
  }

  function parseRows(teks) {
    return teks.trim().split('\n').map(r => r.split('\t')).filter(r => r.length > 1);
  }

  function mapRows(baris, petaKolom) {
    const header = baris[0].map(h => h.trim().toLowerCase());
    const mapping = [];
    let hitungKelas = 0;
    header.forEach(h => {
      let kol = petaKolom[h];
      if (!kol && h === 'kelas') {
        hitungKelas += 1;
        kol = hitungKelas === 1 ? 'kelas_toko' : 'kelas_byr';
      }
      mapping.push(kol);
    });
    return baris.slice(1).map(r => {
      const obj = {};
      mapping.forEach((kol, i) => { if (kol) obj[kol] = (r[i] || '').trim(); });
      return obj;
    });
  }

  const petaToko = {
    area: 'area', kabupaten: 'kabupaten', kecamatan: 'kecamatan', existing: 'existing',
    pelanggan: 'pelanggan', adm: 'adm',
    'ela toko': 'kelas_toko', 'kelas toko': 'kelas_toko',
    'kelas byr': 'kelas_byr', 'kelas bayar': 'kelas_byr',
    longlat: 'latlong', 'link maps': 'link_maps', alamat: 'alamat'
  };

  const petaNoo = {
    area: 'area', a: 'area',
    kabupaten: 'kabupaten', kecamatan: 'kecamatan',
    nama: 'nama',
    'no hp': 'no_hp', nohp: 'no_hp', no_hp: 'no_hp', telp: 'no_hp',
    longlat: 'longlat', alamat: 'alamat'
  };

  async function lakukanSimpan(target, baris) {
    // cegah paste format NOO ke kotak Toko Utama
    if (target === 'stores' && baris[0].some(h => h.trim().toLowerCase() === 'nama')) {
      showToast('❌ Ini format NOO — paste di kotak Toko NOO 🟡, bukan Toko Utama.', 'error');
      return;
    }
    // cegah paste tanpa kolom NAMA ke kotak NOO
    if (target === 'noo' && !baris[0].some(h => h.trim().toLowerCase() === 'nama')) {
      showToast('❌ Data NOO harus ada kolom NAMA.', 'error');
      return;
    }

    const peta = target === 'noo' ? petaNoo : petaToko;
    const rows = mapRows(baris, peta);
    const keyA = target === 'noo' ? 'nama' : 'pelanggan';
    const keyB = target === 'noo' ? 'longlat' : 'latlong';

    const { data: existing } = await supabase.from(target).select(`${keyA}, ${keyB}`);
    const ada = new Set((existing || []).map(x => `${x[keyA]}|${x[keyB]}`));
    const baru = rows.filter(r => !ada.has(`${r[keyA]}|${r[keyB]}`));

    if (baru.length === 0) { showToast('⚠️ Semua data sudah ada di database.', 'warn'); return; }

    const { error } = await supabase.from(target).insert(baru);
    if (error) { showToast('❌ ' + error.message, 'error'); return; }
    showToast(`✅ Tersimpan ${baru.length} baru (${rows.length - baru.length} dilewati karena sudah ada).`);
    if (target === 'noo') setNooText(''); else setText('');
    onDone();
  }

  async function lakukanHapus(target) {
    const { error } = await supabase.from(target).delete().gte('id', 0);
    if (error) { showToast('❌ Gagal hapus: ' + error.message, 'error'); return; }
    showToast('🗑️ Semua data ' + (target === 'noo' ? 'NOO' : 'toko') + ' dihapus.');
    setText(''); setNooText('');
    onDone();
  }

  function onPinConfirm() {
    if (pinValue.trim() !== PIN) {
      showToast('❌ PIN salah!', 'error');
      setPinValue('');
      return;
    }
    setPinOpen(false);
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    if (p.aksi === 'simpan') lakukanSimpan(p.target, p.baris);
    if (p.aksi === 'hapus') { setConfirmTarget(p.target); setConfirmOpen(true); }
  }

  function onConfirmHapus() {
    const t = confirmTarget;
    setConfirmOpen(false);
    setConfirmTarget(null);
    if (t) lakukanHapus(t);
  }

  function mintaSimpan(target, baris) {
    if (baris.length < 2) { showToast('⚠️ Paste dulu data dari Excel.', 'warn'); return; }
    pending.current = { aksi: 'simpan', target, baris };
    setPinOpen(true);
    setPinValue('');
  }

  function mintaHapus(target) {
    pending.current = { aksi: 'hapus', target };
    setPinOpen(true);
    setPinValue('');
  }

  return (
    <>
      <details>
        <summary>⚙️ Kelola Data (Paste dari Excel)</summary>
        <div className="content">

          <h4 style={{ margin: '0 0 6px' }}>Toko Utama</h4>
          <textarea
            className="input"
            value={text}
            onChange={e => setText(e.target.value)}
            rows={5}
            placeholder={'AREA\tKABUPATEN\tKECAMATAN\tEXISTING\tPELANGGAN\tADM\tELA TOKO\tKELAS BYR\tLONGLAT\tLINK MAPS\tALAMAT\nSOC\tSUKOHARJO\tKARTASURA\tEXISTING\t28 Petshop Solo\tADEL\tRT\tGold\t-7.55,110.7\t...'}
            style={{ fontFamily: 'monospace', marginBottom: 12 }}
          />
          <div className="flex-row" style={{ marginBottom: 18 }}>
            <button className="btn success" onClick={() => mintaSimpan('stores', parseRows(text))}>Simpan Data Toko</button>
            <button className="btn danger" onClick={() => mintaHapus('stores')}>Hapus Semua Toko</button>
          </div>

          <h4 style={{ margin: '0 0 6px' }}>Toko NOO (Kunjungan Sales) 🟡</h4>
          <textarea
            className="input"
            value={nooText}
            onChange={e => setNooText(e.target.value)}
            rows={5}
            placeholder={'AREA\tKABUPATEN\tKECAMATAN\tNAMA\tNO HP\tLONGLAT\tALAMAT\nSOC\tSUKOHARJO\tKARTASURA\t3 saudara ps\t0812-8846-2460\t-7.814190,110.9\tJl. Pemuda II...'}
            style={{ fontFamily: 'monospace', marginBottom: 12 }}
          />
          <div className="flex-row">
            <button className="btn success" onClick={() => mintaSimpan('noo', parseRows(nooText))}>Simpan Toko NOO</button>
            <button className="btn danger" onClick={() => mintaHapus('noo')}>Hapus Semua NOO</button>
          </div>

        </div>
      </details>

      <Modal
        open={pinOpen}
        title="🔑 Masukkan PIN"
        message="Ketik PIN untuk melanjutkan."
        value={pinValue}
        onChange={setPinValue}
        inputType="password"
        placeholder="PIN"
        confirmText="Lanjut"
        onConfirm={onPinConfirm}
        onCancel={() => setPinOpen(false)}
      />

      <Modal
        open={confirmOpen}
        title="⚠️ Konfirmasi Hapus"
        message="Semua data akan dihapus permanen. Lanjutkan?"
        confirmText="Ya, Hapus"
        cancelText="Batal"
        onConfirm={onConfirmHapus}
        onCancel={() => { setConfirmOpen(false); setConfirmTarget(null); }}
      />

      <Toast toast={toast} />
    </>
  );
}
