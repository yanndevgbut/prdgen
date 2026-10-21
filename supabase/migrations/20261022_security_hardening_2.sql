-- ==============================================================================
-- PRDGen Security Hardening 2 | 2026-10-22
-- ==============================================================================
-- Jalankan file ini di Supabase SQL Editor setelah kode baru (yang mengirim
-- app_metadata.prdgen_verified=true) selesai di-deploy. Jika migration ini
-- dijalankan lebih dulu, registrasi lewat alur OTP akan gagal sampai kode baru
-- aktif.
--
-- Isi:
-- 1. Pastikan hanya ada satu model AI default.
-- 2. Rate limit lintas-instance berbasis database (fallback tanpa Redis).
-- 3. Blokir signup publik langsung ke Supabase Auth; hanya alur OTP server
--    yang boleh membuat user.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Satu model AI default
-- ------------------------------------------------------------------------------
UPDATE public.ai_models
SET is_default = false
WHERE is_default = true;

UPDATE public.ai_models
SET is_default = true
WHERE id = (
    SELECT id
    FROM public.ai_models
    WHERE is_active = true
    ORDER BY
        CASE WHEN min_tier = 'trial' THEN 0 ELSE 1 END,
        created_at ASC
    LIMIT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_models_single_default
    ON public.ai_models (is_default)
    WHERE is_default = true;

-- ------------------------------------------------------------------------------
-- 2. Rate limit lintas-instance
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    reset_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rate_limits FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at
    ON public.rate_limits (reset_at);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_key TEXT,
    p_limit INTEGER,
    p_window_seconds INTEGER
)
RETURNS TABLE (allowed BOOLEAN, remaining INTEGER, reset_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER;
    v_reset TIMESTAMPTZ;
BEGIN
    INSERT INTO public.rate_limits AS rl (key, count, reset_at)
    VALUES (p_key, 1, NOW() + make_interval(secs => p_window_seconds))
    ON CONFLICT (key) DO UPDATE
        SET count = CASE
                WHEN rl.reset_at <= NOW() THEN 1
                ELSE rl.count + 1
            END,
            reset_at = CASE
                WHEN rl.reset_at <= NOW()
                    THEN NOW() + make_interval(secs => p_window_seconds)
                ELSE rl.reset_at
            END
    RETURNING rl.count, rl.reset_at INTO v_count, v_reset;

    allowed := v_count <= p_limit;
    remaining := GREATEST(p_limit - v_count, 0);
    reset_seconds := GREATEST(
        CEIL(EXTRACT(EPOCH FROM (v_reset - NOW())))::INTEGER,
        1
    );

    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- ------------------------------------------------------------------------------
-- 3. Blokir signup publik di luar alur OTP server
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_verified_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF COALESCE(NEW.raw_app_meta_data->>'prdgen_verified', 'false') <> 'true' THEN
        RAISE EXCEPTION 'Pendaftaran publik dinonaktifkan. Gunakan alur verifikasi OTP PRDGen.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_verified_signup ON auth.users;

CREATE TRIGGER enforce_verified_signup
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_verified_signup();

-- Catatan: user pertama pada instalasi baru tetap menjadi admin lewat
-- handle_new_user(). Setelah migration ini, hanya user yang dibuat server
-- dengan app_metadata.prdgen_verified=true yang bisa masuk ke trigger tersebut.
-- Pastikan akun owner dibuat/di-promote lebih dulu sebelum membuka akses publik.

COMMIT;
