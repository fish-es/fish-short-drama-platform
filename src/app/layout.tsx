import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "短剧开发平台",
  description: "AI 驱动的短剧生成工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}