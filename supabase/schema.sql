-- ==============================================================================
-- PRDGen.ai - Supabase (PostgreSQL) Database Migration & Schema Setup (Idempotent)
-- ==============================================================================
-- PETUNJUK:
-- 1. Buka dashboard Supabase -> SQL Editor.
-- 2. Salin seluruh isi skrip ini dan klik "Run".
-- 3. Seluruh tabel, index, trigger autentikasi, RLS policy, dan data seed akan
--    dibuat/diperbarui secara aman (aman dijalankan berulang kali).
-- ==============================================================================

-- 1. EXTENSIONS & PERMISSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Berikan permission schema public ke auth service & roles
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. ENUMS & CUSTOM TYPES
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_plan AS ENUM ('trial', 'basic', 'vip', 'enterprise');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'banned');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE prd_status AS ENUM ('draft', 'final');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 3. TABLES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'user',
    plan subscription_plan NOT NULL DEFAULT 'trial',
    status user_status NOT NULL DEFAULT 'active',
    prd_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON public.profiles(plan);

CREATE TABLE IF NOT EXISTS public.prds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled PRD',
    description TEXT NOT NULL DEFAULT '',
    mode TEXT NOT NULL DEFAULT 'ai', -- 'ai' or 'manual'
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    content_markdown TEXT NOT NULL DEFAULT '',
    task_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
    status prd_status NOT NULL DEFAULT 'draft',
    version NUMERIC(4,1) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prds_user_id ON public.prds(user_id);
CREATE INDEX IF NOT EXISTS idx_prds_status ON public.prds(status);
CREATE INDEX IF NOT EXISTS idx_prds_created_at ON public.prds(created_at DESC);

CREATE TABLE IF NOT EXISTS public.prd_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prd_id UUID NOT NULL REFERENCES public.prds(id) ON DELETE CASCADE,
    instruction TEXT NOT NULL,
    version NUMERIC(4,1) NOT NULL,
    content_markdown TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prd_revisions_prd_id ON public.prd_revisions(prd_id);

CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    model_id TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL DEFAULT '9router',
    min_tier subscription_plan NOT NULL DEFAULT 'basic',
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.discount_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    percentage INTEGER NOT NULL CHECK (percentage > 0 AND percentage <= 100),
    max_uses INTEGER NOT NULL DEFAULT 100,
    current_uses INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    valid_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS public.email_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    plan subscription_plan NOT NULL DEFAULT 'trial',
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email ON public.email_otps(email);

-- ------------------------------------------------------------------------------
-- 4. FUNCTIONS & TRIGGERS
-- ------------------------------------------------------------------------------

-- Helper Function: Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'admin' AND status = 'active'
    );
END;
$$;

-- Trigger: Automatically create a Profile when auth.users is created (Safe version)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    user_count INT;
    chosen_plan public.subscription_plan;
    user_name TEXT;
BEGIN
    SELECT COUNT(*) INTO user_count FROM public.profiles;

    user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        split_part(COALESCE(NEW.email, 'user@example.com'), '@', 1)
    );

    BEGIN
        chosen_plan := (NEW.raw_user_meta_data->>'plan')::public.subscription_plan;
    EXCEPTION WHEN OTHERS THEN
        chosen_plan := 'trial'::public.subscription_plan;
    END;

    IF chosen_plan IS NULL THEN
        chosen_plan := 'trial'::public.subscription_plan;
    END IF;

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
        chosen_plan,
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

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Increment user's prd_count when a new PRD is created
CREATE OR REPLACE FUNCTION public.handle_new_prd()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    UPDATE public.profiles
    SET prd_count = prd_count + 1,
        updated_at = NOW()
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_prd_created ON public.prds;
CREATE TRIGGER on_prd_created
    AFTER INSERT ON public.prds
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_prd();

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prd_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS: PROFILES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own basic profile info" ON public.profiles;
CREATE POLICY "Users can update their own basic profile info"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND 
        (public.is_admin(auth.uid()) OR (role = (SELECT role FROM public.profiles WHERE id = auth.uid()) AND status = (SELECT status FROM public.profiles WHERE id = auth.uid())))
    );

DROP POLICY IF EXISTS "Admins have full access to all profiles" ON public.profiles;
CREATE POLICY "Admins have full access to all profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- RLS: PRDS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own PRDs" ON public.prds;
CREATE POLICY "Users can view their own PRDs"
    ON public.prds FOR SELECT
    USING (
        auth.uid() = user_id OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Users can create their own PRDs if active" ON public.prds;
CREATE POLICY "Users can create their own PRDs if active"
    ON public.prds FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active')
    );

DROP POLICY IF EXISTS "Users can update their own PRDs if active" ON public.prds;
CREATE POLICY "Users can update their own PRDs if active"
    ON public.prds FOR UPDATE
    USING (
        auth.uid() = user_id OR public.is_admin(auth.uid())
    )
    WITH CHECK (
        auth.uid() = user_id OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Users can delete their own PRDs" ON public.prds;
CREATE POLICY "Users can delete their own PRDs"
    ON public.prds FOR DELETE
    USING (
        auth.uid() = user_id OR public.is_admin(auth.uid())
    );

-- ------------------------------------------------------------------------------
-- RLS: PRD REVISIONS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view revisions of their own PRDs" ON public.prd_revisions;
CREATE POLICY "Users can view revisions of their own PRDs"
    ON public.prd_revisions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.prds 
            WHERE prds.id = prd_revisions.prd_id AND (prds.user_id = auth.uid() OR public.is_admin(auth.uid()))
        )
    );

DROP POLICY IF EXISTS "Users can insert revisions for their own PRDs" ON public.prd_revisions;
CREATE POLICY "Users can insert revisions for their own PRDs"
    ON public.prd_revisions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.prds 
            WHERE prds.id = prd_revisions.prd_id AND prds.user_id = auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- RLS: SYSTEM SETTINGS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view public settings" ON public.system_settings;
CREATE POLICY "Public can view public settings"
    ON public.system_settings FOR SELECT
    USING (is_public = true OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all system settings" ON public.system_settings;
CREATE POLICY "Admins can manage all system settings"
    ON public.system_settings FOR ALL
    USING (public.is_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- RLS: AI MODELS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view active AI models" ON public.ai_models;
CREATE POLICY "Authenticated users can view active AI models"
    ON public.ai_models FOR SELECT
    USING (is_active = true OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage AI models" ON public.ai_models;
CREATE POLICY "Admins can manage AI models"
    ON public.ai_models FOR ALL
    USING (public.is_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- RLS: DISCOUNT COUPONS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can check active discount coupons" ON public.discount_coupons;
CREATE POLICY "Authenticated users can check active discount coupons"
    ON public.discount_coupons FOR SELECT
    USING (is_active = true OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage discount coupons" ON public.discount_coupons;
CREATE POLICY "Admins can manage discount coupons"
    ON public.discount_coupons FOR ALL
    USING (public.is_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- RLS: ACTIVITY LOGS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view activity logs" ON public.activity_logs;
CREATE POLICY "Admins can view activity logs"
    ON public.activity_logs FOR SELECT
    USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users and system can insert activity logs" ON public.activity_logs;
CREATE POLICY "Authenticated users and system can insert activity logs"
    ON public.activity_logs FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------------------------
-- RLS: EMAIL OTPS (Server-Only Access)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view email otps" ON public.email_otps;
CREATE POLICY "Admins can view email otps"
    ON public.email_otps FOR ALL
    USING (public.is_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- 6. INITIAL SEED DATA
-- ------------------------------------------------------------------------------

-- 6.1 System Settings Initial Seeds
INSERT INTO public.system_settings (key, value, description, is_public)
VALUES
    ('ai_config', '{"provider": "9router", "base_url": "https://api.9router.com/v1", "api_key": "", "temperature": 0.7, "max_tokens": 4096}'::jsonb, 'Konfigurasi AI Gateway 9router (Server-Only)', false),
    ('maintenance_mode', '{"enabled": false, "message": "Kami sedang melakukan peningkatan performa dan update model AI. PRDGen akan kembali aktif dalam beberapa menit.", "eta": "24 Sep 2026, 18:00 WIB"}'::jsonb, 'Status Maintenance Platform', true),
    ('general_settings', '{"site_name": "PRDGen", "free_quota": 3, "default_lang": "id", "allow_registration": true}'::jsonb, 'Pengaturan Umum Platform', true),
    ('pricing_plans', '{"basic_monthly": 99000, "vip_monthly": 249000, "enterprise_monthly": 799000, "yearly_discount_pct": 20}'::jsonb, 'Konfigurasi Harga Paket Berlangganan', true)
ON CONFLICT (key) DO NOTHING;

-- 6.2 Default AI Models Seed
INSERT INTO public.ai_models (name, model_id, provider, min_tier, is_default, is_active)
VALUES
    ('Gemini 1.5 Pro', 'gemini-1.5-pro-latest', 'Google (via 9router)', 'vip', true, true),
    ('Gemini 1.5 Flash', 'gemini-1.5-flash', 'Google (via 9router)', 'basic', false, true),
    ('GPT-4o', 'gpt-4o', 'OpenAI (via 9router)', 'enterprise', false, true),
    ('Claude 3.5 Sonnet', 'claude-3-5-sonnet-20240620', 'Anthropic (via 9router)', 'vip', false, true),
    ('DeepSeek V3', 'deepseek-chat', 'DeepSeek (via 9router)', 'basic', false, true)
ON CONFLICT (model_id) DO NOTHING;

-- 6.3 Default Coupons Seed
INSERT INTO public.discount_coupons (code, percentage, max_uses, current_uses, is_active, valid_until)
VALUES
    ('HEMAT20', 20, 100, 0, true, NOW() + INTERVAL '30 days'),
    ('LAUNCHVIP', 30, 50, 0, true, NOW() + INTERVAL '14 days')
ON CONFLICT (code) DO NOTHING;
