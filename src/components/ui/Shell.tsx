'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icono } from './Icono';
import { useTema } from '@/hooks/useTema';

const NAV = [
  { href: '/', label: 'Inicio', icono: 'inicio' },
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
