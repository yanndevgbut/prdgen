-- ==============================================================================
-- PRDGen Security Hardening | 2026-10-21
-- ==============================================================================
-- Jalankan file ini di Supabase SQL Editor SEBELUM deploy kode yang memakai
-- plan_expires_at. Script ini idempotent dan aman dijalankan ulang.
--
-- Yang diperbaiki:
-- 1. User tidak bisa update profiles langsung (plan/credits/role/status).
-- 2. User tidak bisa insert transactions sendiri.
-- 3. User baru selalu trial; plan dari metadata signup tidak dipercaya.
-- 4. Plan berbayar punya masa aktif (plan_expires_at).
-- 5. Activity log tidak bisa ditulis client.
-- 6. Kupon tidak bisa dienumerasi langsung dari tabel oleh client.
-- 7. txn_id gateway unik (jika data lama tidak duplikat).
--
-- Catatan operasional:
-- - Setelah migration, nonaktifkan public signup di Supabase Dashboard
--   (Authentication -> Providers -> Email -> Disable signup) agar tidak ada
--   pendaftaran di luar alur OTP + Turnstile.
-- - User pertama pada instalasi baru tetap menjadi admin. Buat akun owner
--   terlebih dahulu, lalu nonaktifkan signup.
-- - Backfill di bawah memberi user berbayar lama masa aktif 30 hari. Sesuaikan
--   manual jika ada pelanggan yang harus mendapat masa aktif lebih panjang.
-- ==============================================================================

BEGIN;

-- 1. Masa aktif plan
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE;

UPDATE public.profiles
SET plan_expires_at = NOW() + INTERVAL '30 days',
    updated_at = NOW()
WHERE plan <> 'trial'
  AND plan_expires_at IS NULL;

-- 2. Txn ID gateway unik (hindari duplikasi transaksi)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.transactions
        WHERE txn_id IS NOT NULL
        GROUP BY txn_id
        HAVING COUNT(*) > 1
    ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_txn_id_unique
            ON public.transactions(txn_id)
            WHERE txn_id IS NOT NULL;
    ELSE
        RAISE WARNING 'idx_transactions_txn_id_unique tidak dibuat: ada txn_id duplikat.';
    END IF;
END $$;

-- 3. Trigger user baru: selalu trial, jangan percaya metadata plan
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    user_count INT;
    user_name TEXT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('prdgen_first_admin'));

    SELECT COUNT(*) INTO user_count FROM public.profiles;

    user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        split_part(COALESCE(NEW.email, 'user@example.com'), '@', 1)
    );

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        plan,
        status,
        prd_count
    ) VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        user_name,
        CASE WHEN user_count = 0 THEN 'admin'::public.user_role ELSE 'user'::public.user_role END,
        'trial'::public.subscription_plan,
        'active'::public.user_status,
        0
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        updated_at = NOW();

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user error: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. RPC aman untuk ganti nama sendiri
CREATE OR REPLACE FUNCTION public.update_my_profile(new_full_name TEXT)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    updated_profile public.profiles;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.profiles
    SET
        full_name = LEFT(TRIM(COALESCE(new_full_name, '')), 100),
        updated_at = NOW()
    WHERE id = auth.uid()
    RETURNING * INTO updated_profile;

    RETURN updated_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_my_profile(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_my_profile(TEXT) TO authenticated;

-- 5. Profiles: cabut update langsung dari client
DROP POLICY IF EXISTS "Users can update their own basic profile info" ON public.profiles;
REVOKE UPDATE ON public.profiles FROM anon, authenticated;

-- 6. Transactions: cabut insert langsung dari client
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
REVOKE INSERT ON public.transactions FROM anon, authenticated;

-- 7. Activity logs: cabut insert langsung dari client
DROP POLICY IF EXISTS "Authenticated users and system can insert activity logs" ON public.activity_logs;
REVOKE INSERT ON public.activity_logs FROM anon, authenticated;

-- 8. Kupon: jangan biarkan client membaca/enumerasi tabel langsung
DROP POLICY IF EXISTS "Authenticated users can check active discount coupons" ON public.discount_coupons;

COMMIT;
