/** @type {import('next').NextConfig} */
const nextConfig = {
  // Origin tambahan yang boleh memuat asset dev (dipisah koma).
  // Diisi lewat env saat dev server diakses dari hostname preview, mis.
  //   ALLOWED_DEV_ORIGINS=xxxx.style.dev npm run dev
  // Dikosongkan secara default supaya tidak ada origin longgar yang tertanam.
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
};

export default nextConfig;
