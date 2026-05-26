import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AIFR — AI Flight Recorder',
  description: 'Record, replay, and analyze AI-assisted software development workflows',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
