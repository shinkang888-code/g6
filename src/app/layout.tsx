import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
import { KeyboardHints } from "@/components/ui/keyboard-hints";
import { ThemeInit } from "@/components/ThemeInit";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { PwaRegister } from "@/components/pwa/PwaRegister";

export const metadata: Metadata = {
  title: "LawyGo - 법무 관리 시스템",
  description: "법무법인을 위한 스마트 사건 관리 플랫폼",
  applicationName: "LawyGo",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LawyGo",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-background text-text-primary">
        <PwaRegister />
        <ThemeInit />
        <AuthLayout>{children}</AuthLayout>
        <Toaster />
        <KeyboardHints />
      </body>
    </html>
  );
}
