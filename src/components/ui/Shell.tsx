'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icono } from './Icono';
import { useTema } from '@/hooks/useTema';

const NAV = [
  { href: '/', label: 'Inicio', icono: 'inicio' },
  { href: '/captura', label: 'Campo', icono: 'gps' },
  { href: '/callcenter', label: 'Call Center', icono: 'headset' },
  { href: '/tablero', label: 'Tablero', icono: 'tablero' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();
  const tema = useTema();
  const alternar = () => {
    const t = tema === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('mivse.tema', t); } catch {}
  };
  // Mapas abiertos en pantalla completa (otra pestaña): sin barra de navegación
  if (ruta.startsWith('/mapa')) return <main style={{ height: '100dvh' }}>{children}</main>;
  return (
    <div className="shell">
      <nav className="rail" aria-label="Módulos">
        <Link href="/" className="logo" aria-label="MIVSE">M</Link>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={(n.href === '/' ? ruta === '/' : ruta.startsWith(n.href)) ? 'on' : ''}>
            <Icono n={n.icono} s={21} />
            {n.label}
          </Link>
        ))}
        <div className="spacer" />
        <button className="rail-btn" onClick={alternar} aria-label="Cambiar tema">
          <Icono n={tema === 'dark' ? 'sol' : 'luna'} s={19} />
          {tema === 'dark' ? 'Claro' : 'Oscuro'}
        </button>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
