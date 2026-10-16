import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "How Many Beers? | Your cooking game plan",
  description: "Start with serving time. Plan the cook, check off every milestone, and keep dinner on track.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
