import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Toaster } from '@/components/ui/Toaster';

// Utendo ships as Regular + Bold only (no Light/Medium cut yet): Regular carries the 300–500 weights the
// design uses for body and headings, Bold carries 600+. Add the Light/Medium files here if they turn up.
const utendo = localFont({
  src: [
    { path: '../public/fonts/Utendo-Regular.woff2', weight: '300 500', style: 'normal' },
    { path: '../public/fonts/Utendo-Bold.woff2', weight: '600 700', style: 'normal' },
  ],
  variable: '--font-brand',
  display: 'swap',
  fallback: ['Poppins', 'Nunito Sans', 'system-ui', 'sans-serif'],
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
    <html lang="en" className={utendo.variable}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
