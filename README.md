# Peta Sebaran Toko

Dashboard peta untuk memantau lokasi toko existing (sumber: Google Sheet) di
Jawa Tengah & DIY, lengkap dengan filter area/kabupaten/kecamatan dan batas
wilayah.

## Konfigurasi

Semua konfigurasi lewat environment variable (buat file `.env.local`):

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `GOOGLE_SHEET_ID` | tidak | ID spreadsheet sumber data. Default sudah menunjuk ke sheet proyek ini. Sheet harus dibagikan **Anyone with the link → Viewer**. |
| `NEXT_PUBLIC_SUPABASE_URL` | tidak | Hanya untuk fitur **titik manual**. Tanpa ini aplikasi tetap jalan normal, titik manual saja yang nonaktif. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tidak | Pasangan dari URL Supabase di atas. |
| `ALLOWED_DEV_ORIGINS` | tidak | Hanya untuk `next dev`: origin tambahan (dipisah koma) yang boleh memuat asset dev, mis. hostname preview. Kosong secara default. |

Tab yang dibaca dari spreadsheet: `EXISTING` (kolom AREA, KABUPATEN,
KECAMATAN, STATUS, PELANGGAN, Longlat, Link Maps, Alamat). Kalau ada tab
`NOO` / `POTENSI`, tambahkan namanya di `TABS` pada
[app/api/sheet/route.js](app/api/sheet/route.js).

## Menjalankan

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

## Sumber data peta

- Data toko: `/api/sheet` (dibaca ulang otomatis tiap 5 menit)
- Batas kabupaten/kota: `public/batas_kabupaten.geojson`
- Titik manual: tabel `manual_points` di Supabase (opsional)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
