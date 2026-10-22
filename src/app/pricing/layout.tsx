import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Harga Paket ${BRAND_NAME} | Buat PRD Tanpa Ribet`,
  description:
    `Pilih paket ${BRAND_NAME} untuk create PRD otomatis berbasis AI: basic, VIP, hingga enterprise. Web bikin PRD cepat dan rapi.`,
  keywords: [
    "harga prdgen",
    "create PRD",
    "buat PRD tanpa ribet",
    "web bikin PRD",
    "paket PRD generator",
  ],
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
