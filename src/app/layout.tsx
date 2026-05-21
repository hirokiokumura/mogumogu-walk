import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "もぐもぐウォーク",
  description: "矯正トレーニング用歩数カウンター",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
