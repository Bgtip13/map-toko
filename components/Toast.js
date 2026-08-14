'use client';

export default function Toast({ toast }) {
  if (!toast) return null;
  const warna = toast.jenis === 'error' ? '#dc2626' : toast.jenis === 'warn' ? '#d97706' : '#16a34a';
  return (
    <div className="toast" style={{ borderLeft: `4px solid ${warna}` }}>
      {toast.teks}
    </div>
  );
}
