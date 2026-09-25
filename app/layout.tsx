import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/Toaster';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-brand',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Navaro CRM',
    template: '%s · Navaro CRM',
  },
  description: 'Navaro customer relationship management',
};

export const viewport: Viewport = {
  themeColor: '#054742',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
