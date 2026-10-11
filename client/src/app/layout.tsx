import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/toast';
import { PWAProvider } from '@/components/pwa';
import { SettingsProvider } from '@/lib/settings-context';
import { TopLoader } from '@/components/loader';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'SaloonEase';

export const metadata: Metadata = {
  title: { default: `${APP_NAME} - Salon Queue & Slot Booking`, template: `%s | ${APP_NAME}` },
  description: 'Instant salon slot booking and live queue tracking. Book your barber, get a token, track your turn.',
  manifest: '/manifest.json',
  applicationName: APP_NAME,
  appleWebApp: { capable: true, statusBarStyle: 'default', title: APP_NAME },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-64.png', sizes: '64x64', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      {/* suppressHydrationWarning: browser extensions (Grammarly, translators, wallets) inject attributes into html/body */}
      <body className="font-sans" suppressHydrationWarning>
        <ToastProvider>
          <SettingsProvider>
            <AuthProvider>
              <PWAProvider>
                <TopLoader />
                {children}
              </PWAProvider>
            </AuthProvider>
          </SettingsProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
