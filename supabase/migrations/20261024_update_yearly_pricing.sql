-- Harga tahunan adalah total yang dibayar sekali untuk 12 bulan.
-- Harga bulanan yang sudah ada tidak diubah.
BEGIN;

INSERT INTO public.system_settings (key, value, description, is_public)
VALUES (
  'pricing_plans',
  '{"basic_monthly": 10000, "basic_yearly": 96000, "vip_monthly": 20000, "vip_yearly": 192000, "enterprise_monthly": 50000, "enterprise_yearly": 480000, "yearly_discount_pct": 20}'::jsonb,
  'Konfigurasi Harga Paket Berlangganan',
  true
)
ON CONFLICT (key) DO NOTHING;

UPDATE public.system_settings
SET
  value = value || jsonb_build_object(
    'basic_yearly', 96000,
    'vip_yearly', 192000,
    'enterprise_yearly', 480000,
    'yearly_discount_pct', 20
  ),
  updated_at = NOW()
WHERE key = 'pricing_plans';

COMMIT;
