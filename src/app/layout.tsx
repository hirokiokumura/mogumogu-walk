import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SwRegister } from "./sw-register";

export const metadata: Metadata = {
  title: "もぐもぐウォーク",
  description: "矯正トレーニング用歩数カウンター",
  manifest: "/mogumogu-walk/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "もぐもぐウォーク",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#D8A4F0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/mogumogu-walk/icons/icon.svg" />
      </head>
      <body className="min-h-full">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
