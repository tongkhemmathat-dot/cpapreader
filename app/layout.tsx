import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CPAP Analyzer',
  description: 'วิเคราะห์ผลจากหน้าจอเครื่อง CPAP (Aeonmed AS100A) ด้วยรูปถ่าย',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'CPAP', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0b1220',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-[100dvh] bg-black">{children}</body>
    </html>
  );
}
