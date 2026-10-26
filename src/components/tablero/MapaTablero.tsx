'use client';
import { useEffect, useRef } from 'react';
import type * as Leaflet from 'leaflet';
import { ESTATUS_INFO, NIVELES, NIVEL_INFO, nombreCarrera, type EstatusLaboral } from '@/lib/catalogos';
import { ATRIBUCION, cargarLeaflet, urlTeselas } from '@/lib/leaflet-cliente';
import type { Calculado } from '@/lib/tablero-calculo';
import type { DatasetTablero } from '@/lib/tipos';
import { useTema } from '@/hooks/useTema';

export type ModoMapa = 'calor' | 'cluster' | 'puntos' | 'burbujas';
export type EscalaMapa = 'municipal' | 'estatal' | 'nacional';
export type ColorMapa = 'nivel' | 'estatus' | 'origen';

export const ESCALAS: Record<EscalaMapa, [[number, number], [number, number]]> = {
  municipal: [[25.47, -103.6], [25.63, -103.2]],
  estatal: [[23.6, -106.3], [29.2, -99.8]],
  nacional: [[14.8, -117.5], [32.8, -86.7]],
};

export const ORIGEN_COLOR = { campo: '#22c55e', domicilio: '#f59e0b' };
const GRADIENTE = { 0.15: '#1d4ed8', 0.35: '#0891b2', 0.55: '#22d3ee', 0.75: '#f59e0b', 1: '#f43f5e' };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function MapaTablero({
  d, calc, idx, modo, escala, color, onMunicipio,
}: {
  d: DatasetTablero; calc: Calculado; idx: number[]; modo: ModoMapa; escala: EscalaMapa; color: ColorMapa; onMunicipio: (m: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const st = useRef<{ L: typeof Leaflet; map: Leaflet.Map; teselas: Leaflet.TileLayer; capa: Leaflet.Layer | null; rend: Leaflet.Canvas } | null>(null);
  const tema = useTema();
  const onMun = useRef(onMunicipio);
  onMun.current = onMunicipio;

  const colorDe = (i: number) =>
    color === 'nivel'
      ? NIVEL_INFO[NIVELES[calc.niv[i]]].color
      : color === 'estatus'
        ? ESTATUS_INFO[d.dict.estatus[d.col.lab[i]] as EstatusLaboral].color
        : d.col.geo[i] === 1 ? ORIGEN_COLOR.campo : ORIGEN_COLOR.domicilio;

  const popup = (i: number) => {
    const nv = NIVELES[calc.niv[i]];
    return `<div style="min-width:220px">
      <div style="font-size:10.5px;font-weight:700;letter-spacing:.08em;color:var(--muted);text-transform:uppercase">${esc(d.col.matricula[i])} · Gen ${d.col.gen[i]}</div>
      <div style="font-weight:800;font-size:14px;margin:2px 0 6px">${esc(d.col.nombre[i])}</div>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
        <span class="badge" style="--c:${NIVEL_INFO[nv].color}">${NIVEL_INFO[nv].etiqueta}</span>
        <b class="num">IVE ${calc.ive[i].toFixed(1)}</b>
      </div>
      <div style="color:var(--fg-2)">${esc(nombreCarrera(d.dict.carrera[d.col.car[i]]))}<br>${esc(ESTATUS_INFO[d.dict.estatus[d.col.lab[i]] as EstatusLaboral].etiqueta)} · ${esc(d.dict.sector[d.col.sec[i]])}</div>
      <div style="margin-top:6px;font-size:11px;color:${d.col.geo[i] === 1 ? 'var(--ok)' : 'var(--warn)'}">${d.col.geo[i] === 1 ? '● Coordenada GPS capturada en campo' : '● Ubicación estimada por domicilio'}</div>
      <a href="/callcenter?q=${d.col.matricula[i]}" class="btn sm primary" style="margin-top:10px;width:100%;color:#fff">Abrir en Call Center</a>
    </div>`;
  };

  // Inicialización
  useEffect(() => {
    let vivo = true;
    cargarLeaflet().then((L) => {
      if (!vivo || !ref.current || st.current) return;
      const map = L.map(ref.current, { preferCanvas: true, zoomSnap: 0.5, minZoom: 4, maxZoom: 18 });
      map.attributionControl.setPrefix(false);
      L.control.scale({ imperial: false }).addTo(map);
      const teselas = L.tileLayer(urlTeselas(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'), { attribution: ATRIBUCION, maxZoom: 19, detectRetina: true }).addTo(map);
      map.fitBounds(ESCALAS[escala]);
      st.current = { L, map, teselas, capa: null, rend: L.canvas({ padding: 0.3 }) };
      dibujar();
    });
    return () => {
      vivo = false;
      st.current?.map.remove();
      st.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    st.current?.teselas.setUrl(urlTeselas(tema));
  }, [tema]);

  useEffect(() => {
    st.current?.map.flyToBounds(ESCALAS[escala], { duration: 0.9 });
  }, [escala]);

  useEffect(() => {
    dibujar();
  }, [idx, modo, color, calc]); // eslint-disable-line react-hooks/exhaustive-deps

  function dibujar() {
    const s = st.current;
    if (!s) return;
    const { L, map } = s;
    if (s.capa) map.removeLayer(s.capa);
    s.capa = null;
    const { lat, lng } = d.col;

    if (modo === 'calor') {
      const pts: [number, number, number][] = [];
      for (const i of idx) if (lat[i] != null) pts.push([lat[i]!, lng[i]!, 1]);
      // @ts-expect-error — heatLayer lo agrega el plugin leaflet.heat
      s.capa = L.heatLayer(pts, { radius: 16, blur: 18, minOpacity: 0.35, maxZoom: 14, max: Math.max(2, pts.length / 2500), gradient: GRADIENTE });
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
        const prom = x.ive / x.n;
        const c = prom >= 76 ? NIVEL_INFO.embajador.color : prom >= 58 ? NIVEL_INFO.activo.color : prom >= 30 ? NIVEL_INFO.ocasional.color : NIVEL_INFO.desconectado.color;
        const m = L.circleMarker([x.la / x.n, x.ln / x.n], { renderer: s.rend, radius: 8 + Math.sqrt(x.n / max) * 34, color: c, weight: 2, fillColor: c, fillOpacity: 0.32 });
        m.bindTooltip(`<b>${esc(d.dict.municipio[k])}</b><br>${x.n.toLocaleString('es-MX')} egresados<br>IVE promedio <b>${prom.toFixed(1)}</b><br>Cobertura ${((x.con / x.n) * 100).toFixed(0)}%`, { direction: 'top', sticky: true });
        m.on('click', () => onMun.current(k));
        grupo.addLayer(m);
      }
      s.capa = grupo;
    } else if (modo === 'cluster') {
      const iconos = new Map<string, Leaflet.DivIcon>();
      const icono = (c: string) => {
        let ic = iconos.get(c);
        if (!ic) iconos.set(c, (ic = L.divIcon({ className: '', html: `<div class="pin" style="width:12px;height:12px;background:${c}"></div>`, iconSize: [12, 12], iconAnchor: [6, 6] })));
        return ic;
      };
      const cg = L.markerClusterGroup({
        chunkedLoading: true, maxClusterRadius: 50, showCoverageOnHover: false, disableClusteringAtZoom: 17,
        iconCreateFunction: (c) => {
          const k = c.getChildCount();
          const t = k < 20 ? 32 : k < 200 ? 40 : k < 1000 ? 48 : 56;
          return L.divIcon({ html: `<span>${k < 1000 ? k : (k / 1000).toFixed(1) + 'k'}</span>`, className: 'clu', iconSize: [t, t] });
        },
      });
      const ms: Leaflet.Marker[] = [];
      for (const i of idx) {
        if (lat[i] == null) continue;
        const m = L.marker([lat[i]!, lng[i]!], { icon: icono(colorDe(i)), keyboard: false });
        m.bindPopup(() => popup(i), { maxWidth: 300 });
        ms.push(m);
      }
      cg.addLayers(ms);
      s.capa = cg;
    } else {
      const grupo = L.featureGroup();
      for (const i of idx) {
        if (lat[i] == null) continue;
        const m = L.circleMarker([lat[i]!, lng[i]!], { renderer: s.rend, radius: 4.2, weight: 1, color: 'rgba(0,0,0,.35)', fillColor: colorDe(i), fillOpacity: 0.9 });
        m.bindPopup(() => popup(i), { maxWidth: 300 });
        grupo.addLayer(m);
      }
      s.capa = grupo;
    }
    s.capa?.addTo(map);
  }

  return <div ref={ref} style={{ position: 'absolute', inset: 0 }} />;
}
