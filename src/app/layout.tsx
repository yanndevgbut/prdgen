import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { MaintenanceBanner } from "@/components/maintenance-banner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PRDGen - Platform Pembuatan PRD Otomatis Berbasis AI",
  description: "Susun dokumen Product Requirements Document (PRD) berstandar profesional dalam hitungan menit dengan AI.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body className={`${inter.className} bg-[#090a0f] text-[#f1f5f9] min-h-screen flex flex-col`}>
        <MaintenanceBanner />
        <Navbar />
        <div className="flex-1 flex flex-col pt-14">
          {children}
        </div>
      </body>
    </html>
  );
}
