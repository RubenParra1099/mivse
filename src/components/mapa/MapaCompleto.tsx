'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { PESOS_BASE, type Pesos } from '@/lib/ive';
import { DIMS, FILTROS_VACIOS, calcularTodo, filtrar, indicadores, type Dim, type Filtros } from '@/lib/tablero-calculo';
import { fmtN } from '@/lib/formato';
import type { DatasetTablero } from '@/lib/tipos';
import { Icono } from '../ui/Icono';
import { Leyenda } from '../tablero/Tablero';
import type { ColorMapa, EscalaMapa, ModoMapa } from '../tablero/MapaTablero';

const MapaTablero = dynamic(() => import('../tablero/MapaTablero').then((m) => m.MapaTablero), { ssr: false });
const MiniMapa = dynamic(() => import('../callcenter/MiniMapa').then((m) => m.MiniMapa), { ssr: false });

const leerJSON = <T,>(s: string | null, def: T): T => {
  try { return s ? { ...def, ...JSON.parse(s) } : def; } catch { return def; }
};

/** Mapa en pantalla completa, abierto en otra pestaña desde el tablero, el call center o la captura de campo. */
export function MapaCompleto() {
  const q = useSearchParams();
  if (q.get('tipo') === 'tablero') return <MapaTableroCompleto q={q} />;

  const lat = Number(q.get('lat'));
  const lng = Number(q.get('lng'));
  if (!q.get('lat') || !Number.isFinite(lat) || !Number.isFinite(lng)) return <div className="vacio" style={{ padding: 60 }}>Ubicación no válida.</div>;
  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <MiniMapa lat={lat} lng={lng} color={q.get('color') || '#6366f1'} completo />
      <div className="cap-coord" style={{ left: 56 }}>
        {q.get('titulo') && <b>{q.get('titulo')}</b>}
        <span className="num">{lat.toFixed(6)}, {lng.toFixed(6)}</span>
      </div>
    </div>
  );
}

function MapaTableroCompleto({ q }: { q: URLSearchParams }) {
  const [d, setD] = useState<DatasetTablero | null>(null);
  const [f, setF] = useState<Filtros>(() => leerJSON(q.get('f'), FILTROS_VACIOS));
  const [modo, setModo] = useState<ModoMapa>((q.get('modo') as ModoMapa) || 'cluster');
  const [escala, setEscala] = useState<EscalaMapa>((q.get('escala') as EscalaMapa) || 'municipal');
  const [colorMapa, setColorMapa] = useState<ColorMapa>((q.get('color') as ColorMapa) || 'nivel');
  const pesos = useMemo<Pesos>(() => leerJSON(q.get('p'), PESOS_BASE), [q]);

  useEffect(() => {
    fetch('/api/tablero').then((r) => r.json()).then(setD);
  }, []);

  const calc = useMemo(() => (d ? calcularTodo(d, pesos) : null), [d, pesos]);
  const idx = useMemo(() => (d && calc ? filtrar(d, calc, f) : []), [d, calc, f]);
  const kpi = useMemo(() => (d && calc ? indicadores(d, calc, idx) : null), [d, calc, idx]);
  const toggle = (dim: Dim, v: number) => setF((x) => ({ ...x, [dim]: x[dim].includes(v) ? x[dim].filter((y) => y !== v) : [...x[dim], v] }));
  const hayFiltros = DIMS.some((k) => f[k].length);

  if (!d || !calc || !kpi) return <div className="vacio" style={{ padding: 60 }}>Cargando mapa…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-h" style={{ flexWrap: 'wrap', padding: '10px 16px' }}>
        <div>
          <h3><Icono n="mapa" s={16} /> Mapa de egresados</h3>
          <div className="sub" style={{ marginTop: 2 }}>{fmtN(kpi.conGeo)} ubicados de {fmtN(idx.length)} egresados{hayFiltros ? ' (con filtros)' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="seg">
            {(['cluster', 'puntos', 'calor', 'burbujas'] as ModoMapa[]).map((m) => (
              <button key={m} className={modo === m ? 'on' : ''} onClick={() => setModo(m)}>{{ cluster: 'Agrupado', puntos: 'Puntos', calor: 'Calor', burbujas: 'Municipios' }[m]}</button>
            ))}
          </div>
          <div className="seg">
            {(['municipal', 'estatal', 'nacional'] as EscalaMapa[]).map((e) => (
              <button key={e} className={escala === e ? 'on' : ''} onClick={() => setEscala(e)}>{{ municipal: 'Municipal', estatal: 'Regional', nacional: 'Nacional' }[e]}</button>
            ))}
          </div>
          {hayFiltros && <button className="btn ghost sm" onClick={() => setF(FILTROS_VACIOS)}>Limpiar filtros</button>}
        </div>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', background: 'var(--mapbg)' }}>
        <MapaTablero d={d} calc={calc} idx={idx} filtros={f} modo={modo} escala={escala} color={colorMapa} selMun={f.mun} selEdo={f.edo} onMunicipio={(m) => toggle('mun', m)} onEstado={(e) => toggle('edo', e)} />
      </div>
      <div style={{ padding: '8px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {(modo === 'cluster' || modo === 'puntos') && (
          <select className="select" style={{ width: 'auto', height: 28, fontSize: 12, padding: '0 8px' }} value={colorMapa} onChange={(e) => setColorMapa(e.target.value as ColorMapa)} aria-label="Colorear por">
            <option value="nivel">Color por nivel</option>
            <option value="estatus">Color por estatus laboral</option>
            <option value="origen">Color por origen de la coordenada</option>
          </select>
        )}
        <Leyenda d={d} kpi={kpi} modo={modo} color={colorMapa} f={f} toggle={toggle} />
      </div>
    </div>
  );
}
