import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Harga Paket PrdGen — Buat PRD Tanpa Ribet",
  description:
    "Pilih paket PrdGen untuk create PRD otomatis berbasis AI — basic, VIP, hingga enterprise. Web bikin PRD cepat dan rapi.",
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
