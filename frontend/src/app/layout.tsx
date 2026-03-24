import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dominion Realms',
  description: 'Браузерная MMO-стратегия в реальном времени',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
