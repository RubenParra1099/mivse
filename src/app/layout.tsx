import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Shell } from '@/components/ui/Shell';
import './globals.css';

const sans = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'MIVSE · Vinculación de Egresados',
  description: 'Call Center y Tablero de Control del Modelo Integral de Vinculación y Seguimiento de Egresados',
};

const temaInicial = `try{document.documentElement.dataset.theme=localStorage.getItem('mivse.tema')||'dark'}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark" className={sans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: temaInicial }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
