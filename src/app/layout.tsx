import type { Metadata } from "next";
import "./globals.css";

const site = "https://howmanybeers.app";
const title = "How Many Beers? | From First Beer to First Bite.";
const description = "Plan every dish. Time your dinner. Enjoy the cook. Set your serving time, adjust one shared schedule, and follow a guided cooking checklist. Cooks save on this device.";
const asset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title,
  description,
  applicationName: "How Many Beers?",
  manifest: asset('/manifest.webmanifest'),
  alternates: { canonical: `${site}/` },
  openGraph: {
    type: "website", url: `${site}/`, siteName: "How Many Beers?", title, description,
    images: [{ url: `${site}/brand/social-card.png`, width: 1200, height: 630, alt: "How Many Beers? From First Beer to First Bite." }],
  },
  twitter: { card: "summary_large_image", title, description, images: [`${site}/brand/social-card.png`] },
  icons: {
    icon: [
      { url: asset("/brand/favicon.svg"), type: "image/svg+xml" },
      { url: asset("/brand/favicon-32.png"), type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: asset("/brand/apple-touch-icon.png"), sizes: "180x180", type: "image/png" }],
    shortcut: asset("/favicon.ico"),
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
