import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/* Supabase bersifat OPSIONAL.
   Data utama tetap diambil dari Google Sheet lewat /api/sheet, jadi aplikasi
   harus tetap jalan walau NEXT_PUBLIC_SUPABASE_URL belum diisi.
   Kalau env belum ada, `supabase` bernilai null — pemanggil wajib cek dulu. */
export const supabaseReady = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseReady
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
