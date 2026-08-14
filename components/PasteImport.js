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
  const pending = useRef(null);

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
    nama: 'nama',
    'no hp': 'no_hp', nohp: 'no_hp', no_hp: 'no_hp', telp: 'no_hp',
    longlat: 'longlat', alamat: 'alamat'
  };

  async function lakukanSimpan(target, baris) {
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
    showToast(`✅ Tersimpan ${baru.length} baru (${rows.length - baru.length} dilewati).`);
    if (target === 'noo') setNooText(''); else setText('');
    onDone();
  }

  function onSimpanClick() {
    const baris = parseRows(text);
    if (baris.length < 2) { showToast('⚠️ Paste dulu data Toko Utama (minimal 2 baris).', 'warn'); return; }
    pending.current = { aksi: 'simpan', target: 'stores', baris };
    setPinValue(''); setPinOpen(true);
  }

  function onSimpanNooClick() {
    const baris = parseRows(nooText);
    if (baris.length < 2) { showToast('⚠️ Paste dulu data Toko NOO (minimal 2 baris).', 'warn'); return; }
    pending.current = { aksi: 'simpan', target: 'noo', baris };
    setPinValue(''); setPinOpen(true);
  }

  function onHapusClick(target) {
    pending.current = { aksi: 'hapus', target };
    setConfirmOpen(true);
  }

  function onConfirmHapus() {
    setConfirmOpen(false);
    setPinValue('');
    setPinOpen(true);
  }

  async function onPinConfirm() {
    if (pinValue.trim() !== PIN) { showToast('❌ PIN salah!', 'error'); setPinValue(''); return; }
    setPinOpen(false);
    const p = pending.current;
    if (!p) return;
    if (p.aksi === 'hapus') {
      const { error } = await supabase.from(p.target).delete().gte('id', 0);
      showToast(error ? '❌ Gagal: ' + error.message : '🗑️ Data dihapus.', error ? 'error' : 'info');
      onDone();
    } else {
      await lakukanSimpan(p.target, p.baris);
    }
  }

  return (
    <>
      <details>
        <summary>⚙️ Kelola Data (Paste dari Excel)</summary>
        <div className="content">
          <strong>Toko Utama</strong>
          <textarea className="input" value={text} onChange={e => setText(e.target.value)} rows={5} placeholder={'AREA\tKABUPATEN\tKECAMATAN\t...\nSOC\tSUKOHARJO\tKARTASURA\t...'} style={{ fontFamily: 'monospace', marginBottom: 8 }} />
          <div className="flex-row" style={{ marginBottom: 16 }}>
            <button className="btn success" onClick={onSimpanClick}>Simpan Toko Utama</button>
            <button className="btn danger" onClick={() => onHapusClick('stores')}>Hapus Semua Toko</button>
          </div>

          <strong>Toko NOO (Kunjungan Sales) 🟡</strong>
          <textarea className="input" value={nooText} onChange={e => setNooText(e.target.value)} rows={5} placeholder={'AREA\tNAMA\tNO HP\tLONGLAT\tALAMAT\nSOC\t3 saudara ps\t0812-8846-2460\t-7.814190,110.9\tJl. Pemuda II...'} style={{ fontFamily: 'monospace', marginBottom: 8 }} />
          <div className="flex-row">
            <button className="btn success" onClick={onSimpanNooClick}>Simpan Toko NOO</button>
            <button className="btn danger" onClick={() => onHapusClick('noo')}>Hapus Semua NOO</button>
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
        message="Data akan dihapus permanen. Lanjutkan?"
        confirmText="Ya, Hapus"
        cancelText="Batal"
        onConfirm={onConfirmHapus}
        onCancel={() => setConfirmOpen(false)}
      />

      <Toast toast={toast} />
    </>
  );
}
