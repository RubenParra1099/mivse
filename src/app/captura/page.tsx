import type { Metadata, Viewport } from 'next';
import { Captura } from '@/components/captura/Captura';

export const metadata: Metadata = {
  title: 'Captura de campo · MIVSE',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'MIVSE Campo', statusBarStyle: 'black-translucent' },
};
export const viewport: Viewport = { themeColor: '#080b12', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function Page() {
  return <Captura />;
}
