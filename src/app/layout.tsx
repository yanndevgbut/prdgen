import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { MaintenanceBanner } from "@/components/maintenance-banner";
import { BRAND_NAME, BRAND_SITE_URL, BRAND_TAGLINE } from "@/lib/brand";

const inter = Inter({ subsets: ["latin"] });

const siteUrl = BRAND_SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: `${BRAND_NAME} | ${BRAND_TAGLINE}`,
  description:
    "Tulis ide produk dalam beberapa kalimat. PRDGen menyusun PRD 14 bab lengkap berisi user flow, skema database, dan daftar tugas sprint, siap diunduh sebagai Markdown atau PDF.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: `${BRAND_NAME} | ${BRAND_TAGLINE}`,
    description:
      "Tulis ide produk dalam beberapa kalimat. PRDGen menyusun PRD 14 bab lengkap berisi user flow, skema database, dan daftar tugas sprint, siap diunduh sebagai Markdown atau PDF.",
    siteName: BRAND_NAME,
    locale: "id_ID",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: `${BRAND_NAME}, ${BRAND_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: `${BRAND_NAME} | ${BRAND_TAGLINE}`,
    description:
      "Tulis ide produk dalam beberapa kalimat. PRDGen menyusun PRD 14 bab lengkap berisi user flow, skema database, dan daftar tugas sprint, siap diunduh sebagai Markdown atau PDF.",
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
  name: BRAND_NAME,
  url: siteUrl,
  logo: `${siteUrl}/icon.png`,
  slogan: BRAND_TAGLINE,
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: BRAND_NAME,
  url: siteUrl,
  description: `${BRAND_NAME} membantu tim produk menyusun PRD 14 bab terstruktur dalam bahasa Indonesia.`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body className={`${inter.className} bg-[#0E0E0F] text-[#F2F0EB] min-h-screen flex flex-col`}>
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
