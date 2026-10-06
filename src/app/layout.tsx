import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "SEQUENCE · 序列日志",
  description: "一个以现实行动消化魔药的个人成长 RPG",
  manifest: "/manifest.webmanifest",
  applicationName: "序列日志",
  appleWebApp: { capable: true, title: "序列日志", statusBarStyle: "black-translucent" },
  icons: { icon: ["/icons/icon-192.png", "/icons/icon-512.png"], apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0b0f12",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full"><AppShell>{children}</AppShell><PwaRegister /></body>
    </html>
  );
}
