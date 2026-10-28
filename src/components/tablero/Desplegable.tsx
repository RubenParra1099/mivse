'use client';
import { useEffect, useRef, useState } from 'react';
import { Icono } from '../ui/Icono';

export interface OpcionFiltro {
  v: number;
  etiqueta: string;
  n?: number;
  color?: string;
}

/** Menú desplegable de selección múltiple para los filtros de segmentación cruzada. */
export function Desplegable({ titulo, opciones, sel, onCambio }: { titulo: string; opciones: OpcionFiltro[]; sel: number[]; onCambio: (v: number[]) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    // pointerdown en captura: el mapa y las gráficas cancelan el evento y el navegador ya no emite mousedown
    const f = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', f, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', f, true);
      document.removeEventListener('keydown', esc);
    };
  }, [abierto]);

  const visibles = opciones.filter((o) => o.etiqueta.toLowerCase().includes(q.toLowerCase()));
  const s = new Set(sel);
  const toggle = (v: number) => onCambio(s.has(v) ? sel.filter((x) => x !== v) : [...sel, v]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={`chip ${sel.length ? 'on' : ''}`} onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
        {titulo}
        {sel.length > 0 && <b className="num" style={{ background: 'var(--accent)', color: '#fff', borderRadius: 999, padding: '0 6px', fontSize: 10.5 }}>{sel.length}</b>}
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: .6 }}><path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
      </button>
      {abierto && (
        <div className="panel" style={{ position: 'absolute', top: 36, left: 0, zIndex: 1100, width: 270, padding: 6, maxHeight: 380, display: 'flex', flexDirection: 'column' }}>
          {opciones.length > 8 && (
            <input className="input" autoFocus placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} style={{ height: 32, marginBottom: 6 }} />
          )}
          <div className="scroll" style={{ flex: 1 }}>
            {visibles.map((o) => (
              <label key={o.v} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel-3)')} onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                <input type="checkbox" checked={s.has(o.v)} onChange={() => toggle(o.v)} style={{ accentColor: 'var(--accent)' }} />
                {o.color && <span className="dot" style={{ '--c': o.color } as React.CSSProperties} />}
                <span style={{ flex: 1 }}>{o.etiqueta}</span>
                {o.n != null && <span className="muted num" style={{ fontSize: 11 }}>{o.n.toLocaleString('es-MX')}</span>}
              </label>
            ))}
          </div>
          {sel.length > 0 && (
            <button className="btn ghost sm" style={{ marginTop: 4 }} onClick={() => onCambio([])}><Icono n="x" s={13} /> Quitar filtro</button>
          )}
        </div>
      )}
    </div>
  );
}
