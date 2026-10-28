import { Icono } from './Icono';

/** Botón flotante (esquina superior derecha del mapa) que abre el mapa en pantalla completa en otra pestaña. */
export function BotonPantallaCompleta({ href, compacto }: { href: string; compacto?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="btn sm no-print"
      title="Ver en pantalla completa (se abre en otra pestaña)"
      aria-label="Ver en pantalla completa"
      onClick={(e) => e.stopPropagation()}
      style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, gap: 6, background: 'color-mix(in oklab, var(--panel) 90%, transparent)', backdropFilter: 'blur(6px)', boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}
    >
      <Icono n="expandir" s={14} />
      {!compacto && 'Pantalla completa'}
    </a>
  );
}
