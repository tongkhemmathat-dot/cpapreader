import type { Metadata, Viewport } from 'next';
import { Kanit } from 'next/font/google';
import './globals.css';

const kanit = Kanit({
  subsets: ['latin', 'thai'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SleepFlow - CPAP Analyzer',
  description: 'วิเคราะห์ผลจากหน้าจอเครื่อง CPAP (Aeonmed AS100A) ง่ายๆ',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'SleepFlow', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${kanit.className} min-h-[100dvh] bg-black`}>{children}</body>
    </html>
  );
}
