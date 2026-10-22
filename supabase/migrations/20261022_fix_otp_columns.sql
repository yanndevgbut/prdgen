-- ==============================================================================
-- PRDGen OTP Schema Fix | 2026-10-22
-- ==============================================================================
-- Perbaikan darurat untuk database live yang tertinggal dari schema aplikasi.
-- Jalankan script ini di Supabase SQL Editor SEBELUM mencoba registrasi.
--
-- Gejala yang diperbaiki:
-- - Registrasi gagal dengan pesan "Gagal memproses kode verifikasi."
-- - Insert ke email_otps gagal karena kolom user_id tidak ada.
--
-- Script ini idempotent dan aman dijalankan berulang.
-- ==============================================================================

BEGIN;

ALTER TABLE public.email_otps
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.password_reset_otps
    ADD COLUMN IF NOT EXISTS encrypted_new_password TEXT;

COMMIT;
