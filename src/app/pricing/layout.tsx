import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Harga Paket ${BRAND_NAME} | Generator PRD Bahasa Indonesia`,
  description: `Pilih paket langganan ${BRAND_NAME}: BASIC, VIP, atau ENTERPRISE untuk menyusun PRD 14 bab lengkap dengan kuota harian dan akses model AI.`,
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
