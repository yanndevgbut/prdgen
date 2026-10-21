-- ==============================================================================
-- PRDGen | Public PRD Share Opt-In | 2026-10-23
-- ==============================================================================
-- Sebelum migration ini, siapa pun yang mengetahui UUID PRD bisa membuka
-- /share/<uuid> dan /api/share/<uuid>. Setelah migration ini, akses publik
-- hanya terbuka jika pemilik PRD mengaktifkan is_public lewat aplikasi.
--
-- Jalankan setelah kode baru (yang memeriksa is_public) selesai di-deploy.
-- ==============================================================================

BEGIN;

ALTER TABLE public.prds
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_prds_public
    ON public.prds (id)
    WHERE is_public = true;

-- Share viewer dan raw endpoint membaca data lewat service role dengan filter
-- is_public = true. Tidak ada policy anon baru agar tabel prds tidak bisa
-- di-query langsung dari Supabase REST.

COMMIT;
