'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ESTATUS_INFO, NIVELES, NIVEL_INFO, nombreCarrera, type EstatusLaboral } from '@/lib/catalogos';
import { COMPONENTES, METAS, PESOS_BASE, SEMAFORO_COLOR, UMBRALES_NIVEL, componentes, semaforo, type MetaId, type Pesos } from '@/lib/ive';
import { DIMS, FILTROS_VACIOS, agrupar, calcularTodo, filtrar, indicadores, type Dim, type Filtros } from '@/lib/tablero-calculo';
import { fmtN, haceCuanto } from '@/lib/formato';
import type { DatasetTablero } from '@/lib/tipos';
import { Icono } from '../ui/Icono';
import { MedidorIVE } from '../ui/Nivel';
import { Desplegable, type OpcionFiltro } from './Desplegable';
import { Grafica } from './Grafica';
import { ORIGEN_COLOR, type ColorMapa, type EscalaMapa, type ModoMapa } from './MapaTablero';

const MapaTablero = dynamic(() => import('./MapaTablero').then((m) => m.MapaTablero), { ssr: false });

const NOMBRE_DIM: Record<Dim, string> = { gen: 'Generación', car: 'Carrera', sec: 'Sector', ing: 'Ingreso', lab: 'Estatus laboral', niv: 'Nivel', edo: 'Estado', mun: 'Municipio' };
const colorNivel = (ive: number) =>
  ive >= UMBRALES_NIVEL.embajador ? NIVEL_INFO.embajador.color : ive >= UMBRALES_NIVEL.activo ? NIVEL_INFO.activo.color : ive >= UMBRALES_NIVEL.ocasional ? NIVEL_INFO.ocasional.color : NIVEL_INFO.desconectado.color;

export function Tablero() {
  const [d, setD] = useState<DatasetTablero | null>(null);
  const [cargando, setCargando] = useState(false);
  const [f, setF] = useState<Filtros>(FILTROS_VACIOS);
  const [pesos, setPesos] = useState<Pesos>(PESOS_BASE);
  const [modo, setModo] = useState<ModoMapa>('cluster');
  const [escala, setEscala] = useState<EscalaMapa>('municipal');
  const [colorMapa, setColorMapa] = useState<ColorMapa>('nivel');
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState<'desc' | 'asc'>('desc');

  const cargar = useCallback(() => {
    setCargando(true);
    fetch('/api/tablero').then((r) => r.json()).then(setD).finally(() => setCargando(false));
  }, []);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 60_000);
    return () => clearInterval(t);
  }, [cargar]);

  const calc = useMemo(() => (d ? calcularTodo(d, pesos) : null), [d, pesos]);
  const idx = useMemo(() => (d && calc ? filtrar(d, calc, f) : []), [d, calc, f]);
  const sin = useCallback((dim: Dim | Dim[]) => (d && calc ? filtrar(d, calc, f, dim) : []), [d, calc, f]);
  const kpi = useMemo(() => (d && calc ? indicadores(d, calc, idx) : null), [d, calc, idx]);
  useEffect(() => setPagina(1), [f, orden]);

  // Estado al que pertenece cada municipio, para acotar el filtro de municipios a los estados elegidos
  const edoDeMun = useMemo(() => {
    const m = new Map<number, number>();
    if (d) for (let i = 0; i < d.total; i++) m.set(d.col.mun[i], d.col.edo[i]);
    return m;
  }, [d]);
  const podar = (x: Filtros): Filtros => (x.edo.length ? { ...x, mun: x.mun.filter((m) => x.edo.includes(edoDeMun.get(m)!)) } : x);
  const toggle = (dim: Dim, v: number) => setF((x) => podar({ ...x, [dim]: x[dim].includes(v) ? x[dim].filter((y) => y !== v) : [...x[dim], v] }));
  const hayFiltros = DIMS.some((k) => f[k].length);
  const pesosModificados = COMPONENTES.some((c) => pesos[c.id] !== PESOS_BASE[c.id]);

  const etiquetaDe = useCallback(
    (dim: Dim, v: number) => {
      if (!d) return '';
      switch (dim) {
        case 'gen': return String(v);
        case 'car': return nombreCarrera(d.dict.carrera[v]);
        case 'sec': return d.dict.sector[v];
        case 'ing': return d.dict.ingreso[v];
        case 'lab': return ESTATUS_INFO[d.dict.estatus[v] as EstatusLaboral].etiqueta;
        case 'niv': return NIVEL_INFO[NIVELES[v]].etiqueta;
        case 'edo': return d.dict.estado[v];
        case 'mun': return d.dict.municipio[v];
      }
    },
    [d],
  );

  const opciones = useMemo(() => {
    if (!d || !calc) return null;
    const op = (dim: Dim, orden?: (a: OpcionFiltro, b: OpcionFiltro) => number, color?: (v: number) => string): OpcionFiltro[] => {
      const g = agrupar(d, calc, sin(dim), dim);
      const vals = dim === 'gen' ? [...new Set(d.col.gen)].sort((a, b) => b - a) : dim === 'niv' ? [0, 1, 2, 3] : dim === 'lab' ? d.dict.estatus.map((_, i) => i) : (d.dict[({ car: 'carrera', sec: 'sector', ing: 'ingreso', edo: 'estado', mun: 'municipio' } as const)[dim as 'car']] ?? []).map((_, i) => i);
      const xs = vals.map((v) => ({ v, etiqueta: etiquetaDe(dim, v), n: g.get(v)?.n ?? 0, color: color?.(v) }));
      return orden ? xs.sort(orden) : xs;
    };
    return {
      gen: op('gen'),
      car: op('car', (a, b) => a.etiqueta.localeCompare(b.etiqueta)),
      sec: op('sec'),
      ing: op('ing'),
      lab: op('lab', undefined, (v) => ESTATUS_INFO[d.dict.estatus[v] as EstatusLaboral].color),
      niv: op('niv', undefined, (v) => NIVEL_INFO[NIVELES[v]].color),
      edo: op('edo', (a, b) => (b.n ?? 0) - (a.n ?? 0)),
      mun: op('mun', (a, b) => (b.n ?? 0) - (a.n ?? 0)).filter((o) => !f.edo.length || f.edo.includes(edoDeMun.get(o.v)!)),
    };
  }, [d, calc, sin, etiquetaDe, f.edo, edoDeMun]);

  if (!d || !calc || !kpi || !opciones) {
    return (
      <div style={{ padding: 24 }}>
        <div className="panel vacio" style={{ padding: 60 }}>Cargando tablero de control…</div>
      </div>
    );
  }

  // ── Datos de las gráficas ──────────────────────────────────────────────
  const porCarrera = [...agrupar(d, calc, sin('car'), 'car').entries()].sort((a, b) => a[1].ive - b[1].ive);
  const porGen = [...agrupar(d, calc, sin('gen'), 'gen').entries()].sort((a, b) => a[0] - b[0]);
  const porSector = [...agrupar(d, calc, sin('sec'), 'sec').entries()].filter(([k]) => d.dict.sector[k] !== 'Sin dato').sort((a, b) => a[1].n - b[1].n);
  const porIngreso = [...agrupar(d, calc, sin('ing'), 'ing').entries()].filter(([k]) => d.dict.ingreso[k] !== 'Sin dato').sort((a, b) => a[0] - b[0]);
  const porEstatus = [...agrupar(d, calc, sin('lab'), 'lab').entries()];
  const porMun = [...agrupar(d, calc, sin('mun'), 'mun').entries()].sort((a, b) => b[1].n - a[1].n);
  const idxMatriz = sin(['car', 'gen']);
  const gens = [...new Set(d.col.gen)].sort((a, b) => a - b);
  const matriz = new Map<string, { s: number; n: number }>();
  for (const i of idxMatriz) {
    const k = `${d.col.car[i]}|${d.col.gen[i]}`;
    const m = matriz.get(k) ?? { s: 0, n: 0 };
    m.s += calc.ive[i]; m.n++;
    matriz.set(k, m);
  }
  const npsDist = Array(11).fill(0) as number[];
  for (const i of idx) if (d.col.nps[i] >= 0) npsDist[d.col.nps[i]]++;
  const resp = npsDist.reduce((a, b) => a + b, 0);
  const pPro = resp ? ((npsDist[9] + npsDist[10]) / resp) * 100 : 0;
  const pDet = resp ? (npsDist.slice(0, 7).reduce((a, b) => a + b, 0) / resp) * 100 : 0;

  // Promedio de cada componente del IVE (para el motor)
  const promComp = Object.fromEntries(COMPONENTES.map((c) => [c.id, 0])) as Record<string, number>;
  for (const i of idx) {
    const cc = componentes({
      estatus: d.dict.estatus[d.col.lab[i]] as EstatusLaboral,
      diasActualizacion: d.col.act[i] < 0 ? null : d.col.act[i],
      participaciones: d.col.par[i], interesPosgrado: d.col.pos[i] === 1, aportaciones: d.col.apo[i], nps: d.col.nps[i] < 0 ? null : d.col.nps[i],
    });
    for (const c of COMPONENTES) promComp[c.id] += cc[c.id];
  }
  for (const c of COMPONENTES) promComp[c.id] = idx.length ? promComp[c.id] / idx.length : 0;
  const sumaPesos = COMPONENTES.reduce((s, c) => s + pesos[c.id], 0) || 1;

  const atenuar = (dim: Dim, v: number) => (f[dim].length && !f[dim].includes(v) ? 0.28 : 1);
  const ejes = (t: { muted: string; line: string }) => ({
    axisLabel: { color: t.muted, fontSize: 11 },
    axisLine: { lineStyle: { color: t.line } },
    splitLine: { lineStyle: { color: t.line, type: 'dashed' as const } },
    axisTick: { show: false },
  });

  const filas = [...idx].sort((a, b) => (orden === 'desc' ? calc.ive[b] - calc.ive[a] : calc.ive[a] - calc.ive[b])).slice(0, pagina * 25);

  const exportarCSV = () => {
    const enc = ['Matrícula', 'Nombre', 'Carrera', 'Generación', 'Municipio', 'Estado', 'Estatus laboral', 'Sector', 'Ingreso', 'Participaciones', 'NPS', 'IVE', 'Nivel', 'Latitud', 'Longitud', 'Origen coordenada'];
    const lin = idx.map((i) => [
      d.col.matricula[i], d.col.nombre[i], nombreCarrera(d.dict.carrera[d.col.car[i]]), d.col.gen[i], d.dict.municipio[d.col.mun[i]], d.dict.estado[d.col.edo[i]],
      ESTATUS_INFO[d.dict.estatus[d.col.lab[i]] as EstatusLaboral].etiqueta, d.dict.sector[d.col.sec[i]], d.dict.ingreso[d.col.ing[i]], d.col.par[i],
      d.col.nps[i] < 0 ? '' : d.col.nps[i], calc.ive[i].toFixed(1), NIVEL_INFO[NIVELES[calc.niv[i]]].etiqueta, d.col.lat[i] ?? '', d.col.lng[i] ?? '',
      d.col.geo[i] === 1 ? 'GPS campo' : d.col.geo[i] === 2 ? 'Domicilio' : '',
    ].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob(['﻿' + [enc.join(','), ...lin].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mivse-egresados-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const resumenFiltros = DIMS.filter((k) => f[k].length).map((k) => `${NOMBRE_DIM[k]}: ${f[k].map((v) => etiquetaDe(k, v)).join(', ')}`).join(' · ') || 'Todo el censo';

  return (
    <div style={{ padding: '18px 20px 40px', display: 'grid', gap: 16 }}>
      {/* Encabezado */}
      <header style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div className="eyebrow">Módulo 3 · Dashboard de seguimiento</div>
          <h1 className="titulo">Tablero de Control <span className="grad-text">IVE</span></h1>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
            <b className="num" style={{ color: 'var(--fg)' }}>{fmtN(kpi.n)}</b> de <span className="num">{fmtN(d.total)}</span> egresados ·{' '}
            {d.modo === 'neon' ? <span style={{ color: 'var(--ok)', fontWeight: 600 }}>● Postgres · Neon</span> : <span style={{ color: 'var(--warn)', fontWeight: 600 }}>● Modo demo</span>} · actualizado {haceCuanto(d.generado)}
          </div>
          <div className="solo-print" style={{ marginTop: 4, fontSize: 12 }}>Filtros: {resumenFiltros} {pesosModificados && '· Pesos IVE simulados'}</div>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={cargar} disabled={cargando}><Icono n="reset" s={15} /> {cargando ? 'Actualizando…' : 'Actualizar'}</button>
          <button className="btn" onClick={exportarCSV}><Icono n="descarga" s={15} /> CSV</button>
          <button className="btn primary" onClick={() => window.print()}><Icono n="pdf" s={15} /> Exportar PDF</button>
        </div>
      </header>

      {/* Filtros de segmentación cruzada */}
      <div className="panel no-print" style={{ padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', position: 'sticky', top: 8, zIndex: 900 }}>
        <span className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, marginRight: 4 }}><Icono n="filtro" s={15} /> Filtros</span>
        <Desplegable titulo="Generación" opciones={opciones.gen} sel={f.gen} onCambio={(v) => setF({ ...f, gen: v })} />
        <Desplegable titulo="Carrera" opciones={opciones.car} sel={f.car} onCambio={(v) => setF({ ...f, car: v })} />
        <Desplegable titulo="Sector" opciones={opciones.sec} sel={f.sec} onCambio={(v) => setF({ ...f, sec: v })} />
        <Desplegable titulo="Ingreso" opciones={opciones.ing} sel={f.ing} onCambio={(v) => setF({ ...f, ing: v })} />
        <Desplegable titulo="Estatus laboral" opciones={opciones.lab} sel={f.lab} onCambio={(v) => setF({ ...f, lab: v })} />
        <Desplegable titulo="Nivel" opciones={opciones.niv} sel={f.niv} onCambio={(v) => setF({ ...f, niv: v })} />
        <Desplegable titulo="Estado" opciones={opciones.edo} sel={f.edo} onCambio={(v) => setF(podar({ ...f, edo: v }))} />
        <Desplegable titulo="Municipio" opciones={opciones.mun} sel={f.mun} onCambio={(v) => setF({ ...f, mun: v })} />
        {hayFiltros && <span style={{ width: 1, height: 22, background: 'var(--line-2)', margin: '0 4px' }} />}
        {DIMS.flatMap((k) => f[k].map((v) => (
          <button key={k + v} className="chip on" onClick={() => toggle(k, v)} title={`Quitar ${NOMBRE_DIM[k]}`}>
            <i>{NOMBRE_DIM[k]}</i> {etiquetaDe(k, v)} <span className="x"><Icono n="x" s={12} /></span>
          </button>
        )))}
        {hayFiltros && <button className="btn ghost sm" onClick={() => setF(FILTROS_VACIOS)}>Limpiar todo</button>}
      </div>

      {/* IVE + semáforos de metas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.5fr) repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <section className="panel" style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(400px 180px at 0% 100%, color-mix(in srgb, ${colorNivel(kpi.ive)} 18%, transparent), transparent)` }} />
          <div style={{ position: 'relative' }}><MedidorIVE valor={kpi.ive} tam={128} etiqueta="IVE PROM." /></div>
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <div className="eyebrow">Índice de Vinculación del Egresado</div>
            <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', margin: '10px 0 10px', background: 'var(--panel-3)' }}>
              {kpi.niveles.map((n, k) => (
                <div key={k} title={`${NIVEL_INFO[NIVELES[k]].etiqueta}: ${fmtN(n)}`} style={{ width: `${kpi.n ? (n / kpi.n) * 100 : 0}%`, background: NIVEL_INFO[NIVELES[k]].color, transition: 'width .5s' }} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
              {kpi.niveles.map((n, k) => (
                <button key={k} onClick={() => toggle('niv', k)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 0, padding: '2px 0', cursor: 'pointer', textAlign: 'left', opacity: atenuar('niv', k) }}>
                  <span className="dot" style={{ '--c': NIVEL_INFO[NIVELES[k]].color } as React.CSSProperties} />
                  <span style={{ fontSize: 12, flex: 1 }}>{NIVEL_INFO[NIVELES[k]].etiqueta}</span>
                  <b className="num" style={{ fontSize: 12.5 }}>{kpi.n ? ((n / kpi.n) * 100).toFixed(0) : 0}%</b>
                </button>
              ))}
            </div>
          </div>
        </section>
        {METAS.map((m) => <TarjetaMeta key={m.id} id={m.id} valor={kpi.valores[m.id]} faltan={kpi.faltan[m.id]} />)}
      </div>

      {/* Mapa geoespacial (mismo estilo que la plataforma de vialidad) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 12 }}>
        <section className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-h no-print" style={{ flexWrap: 'wrap', paddingBottom: 12 }}>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icono n="mapa" s={16} /> Mapa de egresados</h3>
              <div className="sub" style={{ marginTop: 2 }}>{fmtN(kpi.conGeo)} ubicados · pasa el cursor sobre una calle para ver su nombre</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
            </div>
          </div>
          <div style={{ position: 'relative', height: 520, margin: '0 16px', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--mapbg)' }}>
            <MapaTablero d={d} calc={calc} idx={idx} filtros={f} modo={modo} escala={escala} color={colorMapa} selMun={f.mun} selEdo={f.edo} onMunicipio={(m) => toggle('mun', m)} onEstado={(e) => toggle('edo', e)} />
          </div>
          <div style={{ padding: '10px 16px 14px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {(modo === 'cluster' || modo === 'puntos') && (
              <select className="select no-print" style={{ width: 'auto', height: 28, fontSize: 12, padding: '0 8px' }} value={colorMapa} onChange={(e) => setColorMapa(e.target.value as ColorMapa)} aria-label="Colorear por">
                <option value="nivel">Color por nivel</option>
                <option value="estatus">Color por estatus laboral</option>
                <option value="origen">Color por origen de la coordenada</option>
              </select>
            )}
            <Leyenda d={d} kpi={kpi} modo={modo} color={colorMapa} f={f} toggle={toggle} />
            {(f.edo.length > 0 || f.mun.length > 0) && (
              <a href="#reporte" className="btn sm primary no-print" style={{ marginLeft: 'auto' }}>
                Ver {fmtN(idx.length)} registros de {[...f.edo.map((v) => d.dict.estado[v]), ...f.mun.map((v) => d.dict.municipio[v])].join(', ')} en la tabla ↓
              </a>
            )}
          </div>
        </section>

        <section className="panel" style={{ display: 'flex', flexDirection: 'column', height: 642 }}>
          <div className="panel-h"><h3>Distribución territorial</h3><span className="sub">clic para filtrar</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '12px 16px 4px' }}>
            <MiniDato etiqueta="Con coordenada" valor={kpi.n ? `${((kpi.conGeo / kpi.n) * 100).toFixed(0)}%` : '—'} />
            <MiniDato etiqueta="GPS de campo" valor={kpi.conGeo ? `${((kpi.gpsCampo / kpi.conGeo) * 100).toFixed(0)}%` : '—'} color={ORIGEN_COLOR.campo} />
          </div>
          <div className="scroll" style={{ flex: 1, padding: '8px 10px 12px' }}>
            {porMun.map(([k, g]) => {
              const max = porMun[0][1].n;
              const on = f.mun.includes(k);
              return (
                <button key={k} onClick={() => toggle('mun', k)} style={{ width: '100%', display: 'block', padding: '7px 8px', border: 0, borderRadius: 9, background: on ? 'var(--accent-soft)' : 'none', cursor: 'pointer', textAlign: 'left', opacity: atenuar('mun', k) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span style={{ fontWeight: 600 }}>{d.dict.municipio[k]}</span>
                    <span className="num"><b>{fmtN(g.n)}</b> <span style={{ color: colorNivel(g.ive), fontWeight: 700, marginLeft: 6 }}>{g.ive.toFixed(0)}</span></span>
                  </div>
                  <div style={{ height: 5, borderRadius: 9, background: 'var(--panel-3)', marginTop: 5, display: 'flex', overflow: 'hidden', width: `${Math.max(6, (g.n / max) * 100)}%` }}>
                    {g.niveles.map((n, l) => <div key={l} style={{ width: `${(n / g.n) * 100}%`, background: NIVEL_INFO[NIVELES[l]].color }} />)}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Gráficas analíticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 12 }}>
        <Panel titulo="IVE promedio por carrera" sub="clic para filtrar">
          <Grafica
            alto={Math.max(300, porCarrera.length * 24)}
            deps={[idx, calc, f]}
            onClick={(p) => toggle('car', porCarrera[p.dataIndex][0])}
            construir={(t) => ({
              grid: { left: 8, right: 44, top: 6, bottom: 6, containLabel: true },
              tooltip: { trigger: 'item', formatter: (p: { dataIndex: number }) => { const g = porCarrera[p.dataIndex][1]; return `<b>${nombreCarrera(d.dict.carrera[porCarrera[p.dataIndex][0]])}</b><br>IVE promedio <b>${g.ive.toFixed(1)}</b><br>${fmtN(g.n)} egresados`; } },
              xAxis: { type: 'value', max: 100, ...ejes(t) },
              yAxis: { type: 'category', data: porCarrera.map(([k]) => nombreCarrera(d.dict.carrera[k])), ...ejes(t), splitLine: { show: false } },
              series: [{
                type: 'bar', barMaxWidth: 16, cursor: 'pointer',
                data: porCarrera.map(([k, g]) => ({ value: +g.ive.toFixed(1), itemStyle: { color: colorNivel(g.ive), opacity: atenuar('car', k), borderRadius: [0, 6, 6, 0] } })),
                label: { show: true, position: 'right', color: t.fg, fontSize: 11, fontWeight: 700 },
              }],
            })}
          />
        </Panel>

        <Panel titulo="Nivel de vinculación por generación" sub="% de egresados por año de egreso">
          <Grafica
            alto={Math.max(300, porCarrera.length * 24)}
            deps={[idx, calc, f]}
            onClick={(p) => toggle('gen', Number(p.name))}
            construir={(t) => ({
              grid: { left: 8, right: 8, top: 34, bottom: 6, containLabel: true },
              legend: { top: 0, textStyle: { color: t.muted, fontSize: 11 }, itemWidth: 10, itemHeight: 10, icon: 'circle' },
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => `${v.toFixed(1)}%` },
              xAxis: { type: 'category', data: porGen.map(([g]) => String(g)), ...ejes(t), splitLine: { show: false } },
              yAxis: { type: 'value', max: 100, ...ejes(t), axisLabel: { color: t.muted, fontSize: 11, formatter: '{value}%' } },
              series: NIVELES.map((nv, l) => ({
                name: NIVEL_INFO[nv].etiqueta, type: 'bar', stack: 'n', barMaxWidth: 26, cursor: 'pointer',
                itemStyle: { color: NIVEL_INFO[nv].color },
                data: porGen.map(([gen, g]) => ({ value: +((g.niveles[l] / g.n) * 100).toFixed(1), itemStyle: { opacity: atenuar('gen', gen), borderRadius: l === 3 ? [4, 4, 0, 0] : 0 } })),
              })),
            })}
          />
        </Panel>

        <Panel titulo="Matriz de vinculación · carrera × generación" sub="IVE promedio por celda" ancho>
          <Grafica
            alto={Math.max(320, porCarrera.length * 26)}
            deps={[idx, calc, f]}
            onClick={(p) => {
              const [x, y] = (p.data as { value: number[] }).value;
              setF((s) => ({ ...s, gen: [gens[x]], car: [y] }));
            }}
            construir={(t) => ({
              grid: { left: 8, right: 70, top: 6, bottom: 6, containLabel: true },
              tooltip: { trigger: 'item', formatter: (p: { data: { value: number[]; n: number } }) => `<b>${nombreCarrera(d.dict.carrera[p.data.value[1]])}</b> · Gen ${gens[p.data.value[0]]}<br>IVE promedio <b>${p.data.value[2]}</b><br>${p.data.n} egresados` },
              xAxis: { type: 'category', data: gens.map(String), ...ejes(t), splitLine: { show: false } },
              yAxis: { type: 'category', data: d.dict.carrera.map((c) => nombreCarrera(c)), ...ejes(t), splitLine: { show: false } },
              visualMap: { min: 20, max: 70, calculable: false, orient: 'vertical', right: 0, top: 'middle', itemHeight: 140, itemWidth: 10, textStyle: { color: t.muted, fontSize: 10 }, inRange: { color: ['#1e293b', '#0e7490', '#6366f1', '#d946ef'] } },
              series: [{
                type: 'heatmap', cursor: 'pointer',
                data: [...matriz.entries()].map(([k, m]) => { const [c, g] = k.split('|').map(Number); return { value: [gens.indexOf(g), c, +(m.s / m.n).toFixed(1)], n: m.n }; }),
                itemStyle: { borderColor: t.panel, borderWidth: 2, borderRadius: 4 },
                emphasis: { itemStyle: { borderColor: t.fg, borderWidth: 1 } },
              }],
            })}
          />
        </Panel>

        <Panel titulo="Sector laboral" sub="egresados con empleo o emprendimiento">
          <Grafica
            alto={320}
            deps={[idx, calc, f]}
            onClick={(p) => toggle('sec', porSector[p.dataIndex][0])}
            construir={(t) => ({
              grid: { left: 8, right: 44, top: 6, bottom: 6, containLabel: true },
              tooltip: { trigger: 'item', formatter: (p: { dataIndex: number }) => { const [k, g] = porSector[p.dataIndex]; return `<b>${d.dict.sector[k]}</b><br>${fmtN(g.n)} egresados<br>IVE promedio <b>${g.ive.toFixed(1)}</b>`; } },
              xAxis: { type: 'value', ...ejes(t) },
              yAxis: { type: 'category', data: porSector.map(([k]) => d.dict.sector[k]), ...ejes(t), splitLine: { show: false } },
              series: [{ type: 'bar', barMaxWidth: 14, cursor: 'pointer', label: { show: true, position: 'right', color: t.muted, fontSize: 11 },
                data: porSector.map(([k, g]) => ({ value: g.n, itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#0891b2' }, { offset: 1, color: '#6366f1' }] }, opacity: atenuar('sec', k), borderRadius: [0, 6, 6, 0] } })) }],
            })}
          />
        </Panel>

        <Panel titulo="Rango de ingreso mensual" sub="MXN · clic para filtrar">
          <Grafica
            alto={320}
            deps={[idx, calc, f]}
            onClick={(p) => toggle('ing', porIngreso[p.dataIndex][0])}
            construir={(t) => ({
              grid: { left: 8, right: 8, top: 20, bottom: 6, containLabel: true },
              tooltip: { trigger: 'item', formatter: (p: { dataIndex: number }) => { const [k, g] = porIngreso[p.dataIndex]; return `<b>${d.dict.ingreso[k]}</b><br>${fmtN(g.n)} egresados<br>IVE promedio <b>${g.ive.toFixed(1)}</b>`; } },
              xAxis: { type: 'category', data: porIngreso.map(([k]) => d.dict.ingreso[k]), ...ejes(t), splitLine: { show: false } },
              yAxis: { type: 'value', ...ejes(t) },
              series: [{ type: 'bar', barMaxWidth: 46, cursor: 'pointer', label: { show: true, position: 'top', color: t.muted, fontSize: 11 },
                data: porIngreso.map(([k, g], j) => ({ value: g.n, itemStyle: { color: ['#0e7490', '#0891b2', '#6366f1', '#8b5cf6', '#d946ef'][j % 5], opacity: atenuar('ing', k), borderRadius: [6, 6, 0, 0] } })) }],
            })}
          />
        </Panel>

        <Panel titulo="Estatus laboral" sub="clic para filtrar">
          <Grafica
            alto={320}
            deps={[idx, calc, f]}
            onClick={(p) => toggle('lab', porEstatus[p.dataIndex][0])}
            construir={(t) => ({
              tooltip: { trigger: 'item', formatter: '{b}<br><b>{c}</b> egresados ({d}%)' },
              legend: { orient: 'vertical', right: 10, top: 'middle', textStyle: { color: t.fg, fontSize: 12 }, icon: 'circle', itemWidth: 10 },
              series: [{
                type: 'pie', radius: ['52%', '78%'], center: ['34%', '50%'], cursor: 'pointer', padAngle: 2, itemStyle: { borderRadius: 6 },
                label: { show: true, position: 'center', formatter: () => `${fmtN(kpi.n)}\negresados`, color: t.fg, fontSize: 15, fontWeight: 800, lineHeight: 20 },
                data: porEstatus.map(([k, g]) => { const e = d.dict.estatus[k] as EstatusLaboral; return { name: ESTATUS_INFO[e].etiqueta, value: g.n, itemStyle: { color: ESTATUS_INFO[e].color, opacity: atenuar('lab', k) } }; }),
              }],
            })}
          />
        </Panel>

        <Panel titulo="Recomendación (NPS)" sub={`${fmtN(resp)} respuestas`}>
          <div style={{ display: 'flex', gap: 10, padding: '0 16px' }}>
            <MiniDato etiqueta="NPS" valor={kpi.valores.nps.toFixed(0)} color={SEMAFORO_COLOR[semaforo('nps', kpi.valores.nps)]} />
            <MiniDato etiqueta="Promotores" valor={`${pPro.toFixed(0)}%`} color="var(--ok)" />
            <MiniDato etiqueta="Pasivos" valor={`${(100 - pPro - pDet).toFixed(0)}%`} color="var(--warn)" />
            <MiniDato etiqueta="Detractores" valor={`${pDet.toFixed(0)}%`} color="var(--bad)" />
          </div>
          <Grafica
            alto={250}
            deps={[idx, calc, f]}
            construir={(t) => ({
              grid: { left: 8, right: 8, top: 16, bottom: 6, containLabel: true },
              tooltip: { trigger: 'item', formatter: 'Calificación {b}<br><b>{c}</b> egresados' },
              xAxis: { type: 'category', data: npsDist.map((_, i) => String(i)), ...ejes(t), splitLine: { show: false } },
              yAxis: { type: 'value', ...ejes(t) },
              series: [{ type: 'bar', barMaxWidth: 28, data: npsDist.map((v, i) => ({ value: v, itemStyle: { color: i <= 6 ? SEMAFORO_COLOR.rojo : i <= 8 ? SEMAFORO_COLOR.amarillo : SEMAFORO_COLOR.verde, borderRadius: [5, 5, 0, 0] } })) }],
            })}
          />
        </Panel>
      </div>

      {/* Motor de inteligencia del IVE */}
      <section className="panel">
        <div className="panel-h">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icono n="sliders" s={16} /> Motor de inteligencia del IVE</h3>
            <div className="sub" style={{ marginTop: 2 }}>Ajusta la ponderación y todo el tablero se recalcula en tiempo real sobre los {fmtN(d.total)} egresados.</div>
          </div>
          {pesosModificados ? (
            <button className="btn sm no-print" onClick={() => setPesos(PESOS_BASE)}><Icono n="reset" s={14} /> Restablecer ponderación oficial</button>
          ) : (
            <span className="badge" style={{ '--c': 'var(--ok)' } as React.CSSProperties}>Ponderación oficial</span>
          )}
        </div>
        <div className="panel-b" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px 24px' }}>
            {COMPONENTES.map((c) => (
              <div key={c.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12.5 }}>
                  <span style={{ fontWeight: 650 }}>{c.etiqueta}</span>
                  <span className="num"><b>{((pesos[c.id] / sumaPesos) * 100).toFixed(0)}%</b> <span className="muted">del índice</span></span>
                </div>
                <input type="range" min={0} max={50} value={pesos[c.id]} onChange={(e) => setPesos({ ...pesos, [c.id]: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--accent)' }} aria-label={`Peso de ${c.etiqueta}`} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 5, borderRadius: 9, background: 'var(--panel-3)', overflow: 'hidden' }}>
                    <div style={{ width: `${promComp[c.id] * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
                  </div>
                  <span className="muted num" style={{ fontSize: 11 }}>cumplimiento {(promComp[c.id] * 100).toFixed(0)}%</span>
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{c.ayuda}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--panel-2)', borderRadius: 14, padding: 16, border: '1px solid var(--line)' }}>
            <div className="eyebrow">Fórmula ponderada</div>
            <div className="num" style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13, margin: '8px 0 14px', lineHeight: 1.7 }}>
              IVE = 100 × Σ (w<sub>i</sub> · c<sub>i</sub>) / Σ w<sub>i</sub>
              <div className="muted" style={{ fontSize: 11.5 }}>
                {COMPONENTES.map((c, i) => <span key={c.id}>{i ? ' + ' : ''}{pesos[c.id]}·{c.id}</span>)}
              </div>
            </div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Umbrales de nivel</div>
            {NIVELES.map((nv, k) => {
              const lim = [0, UMBRALES_NIVEL.ocasional, UMBRALES_NIVEL.activo, UMBRALES_NIVEL.embajador, 100];
              return (
                <div key={nv} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '4px 0' }}>
                  <span className="dot" style={{ '--c': NIVEL_INFO[nv].color } as React.CSSProperties} />
                  <b style={{ width: 110 }}>{NIVEL_INFO[nv].etiqueta}</b>
                  <span className="num muted" style={{ width: 70 }}>{lim[k]}–{lim[k + 1]}</span>
                  <span className="muted" style={{ fontSize: 11.5 }}>{NIVEL_INFO[nv].desc}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Reporte detallado */}
      <section className="panel" id="reporte">
        <div className="panel-h">
          <div>
            <h3>Reporte de egresados</h3>
            <div className="sub" style={{ marginTop: 2 }}>{fmtN(idx.length)} registros con los filtros actuales</div>
            {(f.edo.length > 0 || f.mun.length > 0) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {(['edo', 'mun'] as Dim[]).flatMap((k) => f[k].map((v) => (
                  <button key={k + v} className="chip on" onClick={() => toggle(k, v)} title="Quitar">
                    <Icono n="pin" s={13} /> <i>{NOMBRE_DIM[k]}</i> {etiquetaDe(k, v)} <span className="x"><Icono n="x" s={12} /></span>
                  </button>
                )))}
              </div>
            )}
          </div>
          <div className="no-print" style={{ display: 'flex', gap: 8 }}>
            <div className="seg">
              <button className={orden === 'desc' ? 'on' : ''} onClick={() => setOrden('desc')}>Mayor IVE</button>
              <button className={orden === 'asc' ? 'on' : ''} onClick={() => setOrden('asc')}>Menor IVE</button>
            </div>
            <button className="btn sm" onClick={exportarCSV}><Icono n="descarga" s={14} /> Descargar CSV</button>
          </div>
        </div>
        <div className="panel-b" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left' }} className="muted">
                {['Matrícula', 'Egresado', 'Carrera', 'Gen.', 'Municipio', 'Estatus laboral', 'Sector', 'Nivel', 'IVE', ''].map((h) => (
                  <th key={h} style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((i) => {
                const nv = NIVELES[calc.niv[i]];
                const e = d.dict.estatus[d.col.lab[i]] as EstatusLaboral;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td className="num muted" style={{ padding: '8px 10px' }}>{d.col.matricula[i]}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{d.col.nombre[i]}</td>
                    <td style={{ padding: '8px 10px' }}>{nombreCarrera(d.dict.carrera[d.col.car[i]])}</td>
                    <td className="num" style={{ padding: '8px 10px' }}>{d.col.gen[i]}</td>
                    <td style={{ padding: '8px 10px' }}>{d.dict.municipio[d.col.mun[i]]}</td>
                    <td style={{ padding: '8px 10px' }}><span className="dot" style={{ '--c': ESTATUS_INFO[e].color, marginRight: 6 } as React.CSSProperties} />{ESTATUS_INFO[e].etiqueta}</td>
                    <td className="muted" style={{ padding: '8px 10px' }}>{d.dict.sector[d.col.sec[i]]}</td>
                    <td style={{ padding: '8px 10px' }}><span className="badge" style={{ '--c': NIVEL_INFO[nv].color } as React.CSSProperties}>{NIVEL_INFO[nv].etiqueta}</span></td>
                    <td className="num" style={{ padding: '8px 10px', fontWeight: 800, color: NIVEL_INFO[nv].color }}>{calc.ive[i].toFixed(1)}</td>
                    <td className="no-print" style={{ padding: '8px 10px' }}><a className="btn sm ghost" href={`/callcenter?q=${d.col.matricula[i]}`} title="Abrir en Call Center"><Icono n="headset" s={15} /></a></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filas.length < idx.length && (
            <div className="no-print" style={{ textAlign: 'center', marginTop: 12 }}>
              <button className="btn" onClick={() => setPagina((p) => p + 1)}>Mostrar 25 más <span className="muted num">({fmtN(idx.length - filas.length)} restantes)</span></button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function TarjetaMeta({ id, valor, faltan }: { id: MetaId; valor: number; faltan?: number }) {
  const m = METAS.find((x) => x.id === id)!;
  const s = semaforo(id, valor);
  const c = SEMAFORO_COLOR[s];
  const esNps = id === 'nps';
  // Escala de la barra: 0–100 (NPS: −100 a 100)
  const pos = (v: number) => (esNps ? (v + 100) / 2 : Math.max(0, Math.min(100, v)));
  const amarillo = esNps ? m.meta - 15 : m.meta * 0.85;
  return (
    <section className="panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, borderTop: `3px solid ${c}` }} title={m.def}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{m.etiqueta}</span>
        <span style={{ display: 'flex', gap: 3 }} aria-label={`Semáforo ${s}`}>
          {(['rojo', 'amarillo', 'verde'] as const).map((k) => (
            <span key={k} style={{ width: 9, height: 9, borderRadius: '50%', background: k === s ? SEMAFORO_COLOR[k] : 'var(--panel-3)', boxShadow: k === s ? `0 0 8px ${SEMAFORO_COLOR[k]}` : 'none' }} />
          ))}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span className="num" style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', color: c, lineHeight: 1 }}>{esNps ? valor.toFixed(0) : valor.toFixed(1)}</span>
        <span className="muted" style={{ fontWeight: 700 }}>{esNps ? '' : '%'}</span>
        <span className="muted num" style={{ marginLeft: 'auto', fontSize: 11.5 }}>Meta {esNps ? '>' : ''}{m.meta}{esNps ? '' : '%'}</span>
      </div>
      {/* Gráfico de viñeta: bandas rojo/amarillo/verde + valor + marca de meta */}
      <div style={{ position: 'relative', height: 14, marginTop: 2 }}>
        <div style={{ position: 'absolute', inset: '3px 0', borderRadius: 4, overflow: 'hidden', display: 'flex', opacity: .22 }}>
          <div style={{ width: `${pos(amarillo)}%`, background: SEMAFORO_COLOR.rojo }} />
          <div style={{ width: `${pos(m.meta) - pos(amarillo)}%`, background: SEMAFORO_COLOR.amarillo }} />
          <div style={{ flex: 1, background: SEMAFORO_COLOR.verde }} />
        </div>
        <div style={{ position: 'absolute', left: esNps ? '50%' : 0, top: 5, height: 4, borderRadius: 3, background: c, width: `${Math.abs(pos(valor) - (esNps ? 50 : 0))}%`, transform: esNps && valor < 0 ? 'translateX(-100%)' : undefined, transition: 'width .5s' }} />
        <div style={{ position: 'absolute', left: `${pos(m.meta)}%`, top: 0, bottom: 0, width: 2, background: 'var(--fg)', borderRadius: 2 }} />
      </div>
      <div className="muted" style={{ fontSize: 11, lineHeight: 1.35 }}>
        {s === 'verde' ? '✓ Meta cumplida' : faltan != null ? <>Faltan <b className="num" style={{ color: 'var(--fg)' }}>{fmtN(faltan)}</b> egresados</> : <>A <b className="num" style={{ color: 'var(--fg)' }}>{(m.meta - valor + 1).toFixed(0)}</b> pts de la meta</>}
      </div>
    </section>
  );
}

function Panel({ titulo, sub, children, ancho }: { titulo: string; sub?: string; children: React.ReactNode; ancho?: boolean }) {
  return (
    <section className="panel" style={ancho ? { gridColumn: '1 / -1' } : undefined}>
      <div className="panel-h"><h3>{titulo}</h3>{sub && <span className="sub">{sub}</span>}</div>
      <div style={{ padding: '8px 8px 10px' }}>{children}</div>
    </section>
  );
}

function MiniDato({ etiqueta, valor, color }: { etiqueta: string; valor: string; color?: string }) {
  return (
    <div style={{ flex: 1, padding: '8px 10px', borderRadius: 10, background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
      <div className="num" style={{ fontWeight: 800, fontSize: 17, color: color ?? 'var(--fg)' }}>{valor}</div>
      <div className="muted" style={{ fontSize: 10.5, fontWeight: 600 }}>{etiqueta}</div>
    </div>
  );
}

function Leyenda({ d, kpi, modo, color, f, toggle }: { d: DatasetTablero; kpi: { niveles: number[] }; modo: ModoMapa; color: ColorMapa; f: Filtros; toggle: (dim: Dim, v: number) => void }) {
  if (modo === 'calor') {
    return (
      <div className="mlegend">
        <span className="lgi">Densidad de egresados <span style={{ width: 120, height: 8, borderRadius: 9, background: 'linear-gradient(90deg,#1d4ed8,#0891b2,#22d3ee,#f59e0b,#f43f5e)' }} /></span>
      </div>
    );
  }
  if (modo === 'burbujas') {
    return (
      <div className="mlegend">
        <span className="muted" style={{ fontSize: 11.5 }}>Color = IVE promedio · tamaño = egresados · clic para filtrar el municipio</span>
        {NIVELES.map((n) => <span key={n} className="lgi"><i style={{ background: NIVEL_INFO[n].color }} />{NIVEL_INFO[n].etiqueta}</span>)}
      </div>
    );
  }
  if (color === 'origen') {
    return (
      <div className="mlegend">
        <span className="lgi"><i style={{ background: ORIGEN_COLOR.campo }} />GPS capturado en campo</span>
        <span className="lgi"><i style={{ background: ORIGEN_COLOR.domicilio }} />Estimada por domicilio</span>
      </div>
    );
  }
  if (color === 'estatus') {
    return (
      <div className="mlegend">
        {d.dict.estatus.map((e, k) => (
          <button key={e} className={`lgi ${f.lab.length && !f.lab.includes(k) ? 'off' : ''}`} onClick={() => toggle('lab', k)}>
            <i style={{ background: ESTATUS_INFO[e as EstatusLaboral].color }} />{ESTATUS_INFO[e as EstatusLaboral].etiqueta}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="mlegend">
      {NIVELES.map((n, k) => (
        <button key={n} className={`lgi ${f.niv.length && !f.niv.includes(k) ? 'off' : ''}`} onClick={() => toggle('niv', k)}>
          <i style={{ background: NIVEL_INFO[n].color }} />{NIVEL_INFO[n].etiqueta} <b className="num">{fmtN(kpi.niveles[k])}</b>
        </button>
      ))}
    </div>
  );
}
