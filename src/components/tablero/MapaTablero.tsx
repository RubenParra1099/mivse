'use client';
import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { ESTATUS_INFO, NIVELES, NIVEL_INFO, nombreCarrera, type EstatusLaboral } from '@/lib/catalogos';
import { cargarLeaflet } from '@/lib/leaflet-cliente';
import { crearMapaBase, type MapaBase } from '@/lib/mapa-base';
import { DIMS, type Calculado, type Filtros } from '@/lib/tablero-calculo';
import type { DatasetTablero } from '@/lib/tipos';
import { useTema } from '@/hooks/useTema';
import { FichaTecnica } from './FichaTecnica';

export type ModoMapa = 'cluster' | 'puntos' | 'calor' | 'burbujas';
export type EscalaMapa = 'municipal' | 'estatal' | 'nacional';
export type ColorMapa = 'nivel' | 'estatus' | 'origen';

export const ESCALAS: Record<EscalaMapa, [[number, number], [number, number]]> = {
  municipal: [[25.47, -103.56], [25.62, -103.2]],
  estatal: [[23.6, -106.3], [29.2, -99.8]],
  nacional: [[14.8, -117.5], [32.8, -86.7]],
};

export const ORIGEN_COLOR = { campo: '#22c55e', domicilio: '#f59e0b' };
const GRADIENTE = { 0.15: '#1d4ed8', 0.35: '#0891b2', 0.55: '#22d3ee', 0.75: '#f59e0b', 1: '#f43f5e' };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const colorIVE = (v: number) =>
  v >= 76 ? NIVEL_INFO.embajador.color : v >= 58 ? NIVEL_INFO.activo.color : v >= 30 ? NIVEL_INFO.ocasional.color : NIVEL_INFO.desconectado.color;

export function MapaTablero({
  d, calc, idx, filtros, modo, escala, color, selMun, selEdo, onMunicipio, onEstado,
}: {
  d: DatasetTablero; calc: Calculado; idx: number[]; filtros: Filtros; modo: ModoMapa; escala: EscalaMapa; color: ColorMapa;
  selMun: number[]; selEdo: number[]; onMunicipio: (m: number) => void; onEstado: (e: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const st = useRef<{ L: typeof Leaflet; base: MapaBase; capa: Leaflet.Layer | null; rend: Leaflet.Canvas } | null>(null);
  const tema = useTema();
  const [ficha, setFicha] = useState<string | null>(null);
  const onMun = useRef(onMunicipio);
  onMun.current = onMunicipio;
  const onEdo = useRef(onEstado);
  onEdo.current = onEstado;
  const props = useRef({ d, calc, idx, modo, color, selMun, selEdo });
  props.current = { d, calc, idx, modo, color, selMun, selEdo };

  useEffect(() => {
    let vivo = true;
    (async () => {
      const L = await cargarLeaflet();
      if (!vivo || !ref.current) return;
      const base = await crearMapaBase(L, ref.current);
      if (!vivo) return base.map.remove();
      L.control.scale({ imperial: false }).addTo(base.map);
      base.map.fitBounds(ESCALAS[escala]);
      st.current = { L, base, capa: null, rend: L.canvas({ padding: 0.3, tolerance: 4 }) };
      dibujar();
    })();
    return () => {
      vivo = false;
      st.current?.base.map.remove();
      st.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    st.current?.base.repintar();
    dibujar();
  }, [tema]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    st.current?.base.map.flyToBounds(ESCALAS[escala], { duration: 0.9 });
  }, [escala]);

  useEffect(() => {
    dibujar();
  }, [idx, modo, color, calc, selMun, selEdo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al cambiar los filtros, acercar el mapa a los egresados filtrados; sin filtros, volver a la escala elegida
  const filtrosPrevios = useRef(filtros);
  useEffect(() => {
    if (filtrosPrevios.current === filtros) return;
    filtrosPrevios.current = filtros;
    const s = st.current;
    if (!s) return;
    if (!DIMS.some((k) => filtros[k].length)) {
      s.base.map.flyToBounds(ESCALAS[escala], { duration: 0.9 });
      return;
    }
    const { lat, lng } = d.col;
    let sur = 90, norte = -90, oeste = 180, este = -180;
    for (const i of idx) {
      if (lat[i] == null) continue;
      sur = Math.min(sur, lat[i]!); norte = Math.max(norte, lat[i]!);
      oeste = Math.min(oeste, lng[i]!); este = Math.max(este, lng[i]!);
    }
    if (sur > norte) return;
    s.base.map.flyToBounds([[sur, oeste], [norte, este]], { padding: [40, 40], maxZoom: 15, duration: 0.9 });
  }, [filtros]); // eslint-disable-line react-hooks/exhaustive-deps

  function dibujar() {
    const s = st.current;
    if (!s) return;
    const { d, calc, idx, modo, color, selMun, selEdo } = props.current;
    const { L } = s;
    const map = s.base.map;
    if (s.capa) map.removeLayer(s.capa);
    s.capa = null;
    const { lat, lng } = d.col;

    const colorDe = (i: number) =>
      color === 'nivel'
        ? NIVEL_INFO[NIVELES[calc.niv[i]]].color
        : color === 'estatus'
          ? ESTATUS_INFO[d.dict.estatus[d.col.lab[i]] as EstatusLaboral].color
          : d.col.geo[i] === 1 ? ORIGEN_COLOR.campo : ORIGEN_COLOR.domicilio;

    const popup = (i: number) => {
      const nv = NIVELES[calc.niv[i]];
      const lab = ESTATUS_INFO[d.dict.estatus[d.col.lab[i]] as EstatusLaboral].etiqueta;
      const fila = (k: string, v: string | number) => `<dt>${k}</dt><dd>${esc(String(v))}</dd>`;
      return `<div class="pp">
        <div class="pk"><i style="background:${NIVEL_INFO[nv].color}"></i>${NIVEL_INFO[nv].etiqueta} · IVE ${calc.ive[i].toFixed(1)}</div>
        <h4>${esc(d.col.nombre[i])}</h4>
        <div class="pm">Matrícula ${esc(d.col.matricula[i])} · Generación ${d.col.gen[i]}</div>
        ${d.col.geo[i] === 1 ? '<div class="gq ok">Coordenada GPS capturada en campo</div>' : '<div class="gq">Ubicación estimada a partir del domicilio</div>'}
        <dl>${fila('Carrera', nombreCarrera(d.dict.carrera[d.col.car[i]]))}${fila('Municipio', `${d.dict.municipio[d.col.mun[i]]}, ${d.dict.estado[d.col.edo[i]]}`)}${fila('Estatus', lab)}${d.dict.sector[d.col.sec[i]] !== 'Sin dato' ? fila('Sector', d.dict.sector[d.col.sec[i]]) : ''}${d.col.nps[i] >= 0 ? fila('Recomendación', `${d.col.nps[i]}/10`) : ''}</dl>
        <div style="display:grid;gap:6px">
          <button type="button" class="btn sm" data-filtra-mun="${d.col.mun[i]}" style="width:100%">${selMun.includes(d.col.mun[i]) ? 'Quitar filtro de' : 'Filtrar tabla por'} ${esc(d.dict.municipio[d.col.mun[i]])}</button>
          <button type="button" class="btn sm" data-ficha="${esc(d.col.matricula[i])}" style="width:100%">Ver ficha técnica</button>
          <a href="/callcenter?q=${d.col.matricula[i]}" class="btn sm primary" style="width:100%;color:#fff">Abrir expediente en Call Center</a>
        </div>
      </div>`;
    };

    // Estados sombreados según el número de egresados filtrados (lectura nacional)
    if (s.base.estadosCapa) {
      const porEdo = new Map<string, { n: number; ive: number }>();
      for (const i of idx) {
        const k = d.dict.estado[d.col.edo[i]];
        const x = porEdo.get(k) ?? { n: 0, ive: 0 };
        x.n++; x.ive += calc.ive[i];
        porEdo.set(k, x);
      }
      const max = Math.max(1, ...[...porEdo.values()].map((x) => x.n));
      const cs = getComputedStyle(document.documentElement);
      const acento = cs.getPropertyValue('--accent').trim(), r1 = cs.getPropertyValue('--road1').trim(), r3 = cs.getPropertyValue('--road3').trim();
      s.base.estadosCapa.eachLayer((ly) => {
        const pl = ly as Leaflet.Polygon & { feature: { properties: { n: string } } };
        const nombre = pl.feature.properties.n;
        const x = porEdo.get(nombre);
        const k = d.dict.estado.indexOf(nombre);
        const elegido = k >= 0 && selEdo.includes(k);
        pl.setStyle(
          elegido
            ? { fillColor: acento, fillOpacity: 0.45, color: acento, weight: 3 }
            : x ? { fillColor: acento, fillOpacity: 0.12 + 0.5 * Math.sqrt(x.n / max), color: r1, weight: 1.2 } : { fillColor: r3, fillOpacity: 0.55, color: r1, weight: 1.2 },
        );
        pl.off('click');
        if (k >= 0) pl.on('click', () => onEdo.current(k));
        pl.unbindTooltip();
        pl.bindTooltip(
          `<b>${esc(nombre)}</b><br>${x ? `${x.n.toLocaleString('es-MX')} egresados · IVE ${(x.ive / x.n).toFixed(1)}` : 'Sin egresados'}${k >= 0 ? `<br><span style="color:var(--muted)">Clic para ${elegido ? 'quitar el filtro' : 'filtrar la tabla'}</span>` : ''}`,
          { sticky: true, className: 'edo', direction: 'top' },
        );
      });
    }

    if (modo === 'calor') {
      const pts: [number, number, number][] = [];
      for (const i of idx) if (lat[i] != null) pts.push([lat[i]!, lng[i]!, 1]);
      // @ts-expect-error — heatLayer lo agrega el plugin leaflet.heat
      s.capa = L.heatLayer(pts, { radius: 15, blur: 17, minOpacity: 0.35, maxZoom: 15, max: Math.max(2, pts.length / 2500), gradient: GRADIENTE });
    } else if (modo === 'burbujas') {
      const g = new Map<number, { n: number; ive: number; la: number; ln: number; con: number }>();
      for (const i of idx) {
        if (lat[i] == null) continue;
        const k = d.col.mun[i];
        const x = g.get(k) ?? { n: 0, ive: 0, la: 0, ln: 0, con: 0 };
        x.n++; x.ive += calc.ive[i]; x.la += lat[i]!; x.ln += lng[i]!; x.con += d.col.con[i];
        g.set(k, x);
      }
      const max = Math.max(1, ...[...g.values()].map((x) => x.n));
      const grupo = L.featureGroup();
      for (const [k, x] of [...g.entries()].sort((a, b) => b[1].n - a[1].n)) {
        const prom = x.ive / x.n, c = colorIVE(prom);
        const on = selMun.includes(k);
        const m = L.circleMarker([x.la / x.n, x.ln / x.n], { renderer: s.rend, radius: 8 + Math.sqrt(x.n / max) * 34, color: on ? '#fff' : c, weight: on ? 3.5 : 2, fillColor: c, fillOpacity: on ? 0.6 : 0.3 });
        m.bindTooltip(`<b>${esc(d.dict.municipio[k])}</b><br>${x.n.toLocaleString('es-MX')} egresados<br>IVE promedio <b>${prom.toFixed(1)}</b> · Cobertura ${((x.con / x.n) * 100).toFixed(0)}%`, { direction: 'top', sticky: true, className: 'edo' });
        m.on('click', () => onMun.current(k));
        grupo.addLayer(m);
      }
      s.capa = grupo;
    } else if (modo === 'cluster') {
      const iconos = new Map<string, Leaflet.DivIcon>();
      const icono = (c: string) => {
        let ic = iconos.get(c);
        if (!ic) iconos.set(c, (ic = L.divIcon({ className: 'dot-mk', html: `<i style="background:${c}"></i>`, iconSize: [14, 14], iconAnchor: [7, 7] })));
        return ic;
      };
      const cg = L.markerClusterGroup({
        chunkedLoading: true, maxClusterRadius: 48, showCoverageOnHover: false, spiderfyOnMaxZoom: true, disableClusteringAtZoom: 18,
        iconCreateFunction: (c) => {
          const k = c.getChildCount();
          const t = k < 20 ? 30 : k < 200 ? 36 : k < 1000 ? 42 : 48;
          return L.divIcon({ html: `<span>${k < 1000 ? k : (k / 1000).toFixed(1) + 'k'}</span>`, className: 'clu', iconSize: [t, t] });
        },
      });
      const ms: Leaflet.Marker[] = [];
      for (const i of idx) {
        if (lat[i] == null) continue;
        const m = L.marker([lat[i]!, lng[i]!], { icon: icono(colorDe(i)), keyboard: false });
        m.bindPopup(() => popup(i), { maxWidth: 340, minWidth: 240, autoPanPadding: [30, 30] });
        ms.push(m);
      }
      cg.addLayers(ms);
      s.capa = cg;
    } else {
      const panel = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim();
      const grupo = L.featureGroup();
      for (const i of idx) {
        if (lat[i] == null) continue;
        const m = L.circleMarker([lat[i]!, lng[i]!], { renderer: s.rend, radius: 4.5, weight: 1.2, color: panel, fillColor: colorDe(i), fillOpacity: 0.9 });
        m.bindPopup(() => popup(i), { maxWidth: 340, minWidth: 240, autoPanPadding: [30, 30] });
        grupo.addLayer(m);
      }
      s.capa = grupo;
    }
    s.capa?.addTo(map);
  }

  // Botones dentro de las fichas del mapa: "Ver ficha técnica" y "Filtrar tabla por municipio"
  const clicFicha = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const f = t.closest<HTMLElement>('[data-ficha]');
    if (f) {
      setFicha(f.dataset.ficha!);
      st.current?.base.map.closePopup();
      return;
    }
    const b = t.closest<HTMLElement>('[data-filtra-mun]');
    if (!b) return;
    onMun.current(Number(b.dataset.filtraMun));
    st.current?.base.map.closePopup();
  };

  return (
    <>
      <div ref={ref} onClick={clicFicha} style={{ position: 'absolute', inset: 0 }} />
      {ficha && <FichaTecnica matricula={ficha} onCerrar={() => setFicha(null)} />}
    </>
  );
}
