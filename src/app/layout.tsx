import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { MaintenanceBanner } from "@/components/maintenance-banner";

const inter = Inter({ subsets: ["latin"] });

const siteUrl = "https://prdgen.my.id";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "PrdGen — Buat PRD Tanpa Ribet dengan AI",
  description:
    "Create PRD / buat dokumen Product Requirements Document (PRD) otomatis dan terstruktur dengan AI. Web bikin PRD tanpa ribet, siap dibagikan ke tim developer.",
  keywords: [
    "create PRD",
    "buat PRD tanpa ribet",
    "web bikin PRD",
    "PRD generator",
    "product requirements document",
    "dokumen PRD AI",
    "aplikasi buat PRD",
    "contoh PRD",
    "bikin PRD otomatis",
    "template PRD",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "PrdGen — Buat PRD Tanpa Ribet dengan AI",
    description:
      "Create PRD / buat dokumen Product Requirements Document (PRD) otomatis dan terstruktur dengan AI. Web bikin PRD tanpa ribet.",
    siteName: "PrdGen",
    locale: "id_ID",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "PrdGen — Buat PRD Tanpa Ribet",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "PrdGen — Buat PRD Tanpa Ribet dengan AI",
    description:
      "Create PRD / buat dokumen PRD otomatis dengan AI. Web bikin PRD tanpa ribet.",
    images: ["/icon.png"],
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PrdGen",
  url: siteUrl,
  logo: `${siteUrl}/icon.png`,
  slogan: "Buat PRD Tanpa Ribet",
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "PrdGen",
  url: siteUrl,
  description: "Buat PRD Tanpa Ribet dengan AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body className={`${inter.className} bg-[#090a0f] text-[#f1f5f9] min-h-screen flex flex-col`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <MaintenanceBanner />
        <Navbar />
        <div className="flex-1 flex flex-col pt-14">
          {children}
        </div>
      </body>
    </html>
  );
}
