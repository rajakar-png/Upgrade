import type { Metadata } from 'next';
import type { Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/context/auth-context';
import { SeoRuntimeInjector } from '@/components/seo/SeoRuntimeInjector';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'AstraNodes — Game Server Hosting',
  description: 'Deploy powerful Minecraft servers instantly with enterprise infrastructure and gamer-friendly pricing.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className={`${inter.className} bg-[#0f0f0f] text-gray-100 antialiased`}>
        <AuthProvider>
          <SeoRuntimeInjector />
          {children}
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
