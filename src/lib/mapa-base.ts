'use client';
// Mapa base estilo plataforma de vialidad: sin teselas, la red vial de la Comarca Lagunera (OpenStreetMap)
// se dibuja en canvas por jerarquía sobre un fondo sólido, más los contornos estatales para la vista nacional.
import type * as Leaflet from 'leaflet';

interface Red {
  porClase: [number, number][][][];
  nombradas: [number, string, [number, number][]][];
}
interface Estado {
  n: string;
  p: [number, number][][];
}

let red: Promise<Red> | null = null;
let estados: Promise<Estado[]> | null = null;

/** Formato de red-vial.txt: 1a línea = nombres; luego clase|nombre|x0,y0,dx,dy… (×1e5, deltas). */
function cargarRed(): Promise<Red> {
  if (!red) {
    red = fetch('/data/red-vial.txt').then(async (r) => {
      const raw = (await r.text()).trim();
      const nl = raw.indexOf('\n');
      const nombres: string[] = JSON.parse(raw.slice(0, nl));
      const porClase: [number, number][][][] = [[], [], [], [], []];
      const nombradas: Red['nombradas'] = [];
      for (const ln of raw.slice(nl + 1).split('\n')) {
        const p = ln.split('|');
        if (p.length < 3) continue;
        const c = +p[0], ni = +p[1], a = p[2].split(',');
        let x = 0, y = 0;
        const pts: [number, number][] = [];
        for (let j = 0; j + 1 < a.length; j += 2) {
          x += +a[j];
          y += +a[j + 1];
          pts.push([y / 1e5, x / 1e5]);
        }
        if (pts.length < 2) continue;
        porClase[c].push(pts);
        if (ni) nombradas.push([c, nombres[ni - 1], pts]);
      }
      return { porClase, nombradas };
    });
  }
  return red;
}

export function cargarEstados(): Promise<Estado[]> {
  if (!estados) estados = fetch('/data/estados.json').then((r) => r.json());
  return estados;
}

const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const ANCHO = [3.6, 2.8, 2.1, 1.5, 0.8];

export interface MapaBase {
  map: Leaflet.Map;
  /** Vuelve a leer los colores del tema (claro/oscuro). */
  repintar: () => void;
  estadosCapa: Leaflet.GeoJSON | null;
}

export async function crearMapaBase(L: typeof Leaflet, el: HTMLElement, opts: { calles?: boolean; estados?: boolean; zoomControl?: boolean } = {}): Promise<MapaBase> {
  const map = L.map(el, { preferCanvas: true, zoomSnap: 0.5, minZoom: 4, maxZoom: 19, zoomControl: opts.zoomControl ?? true });
  map.attributionControl.setPrefix(false);
  map.attributionControl.addAttribution('Red vial © colaboradores de OpenStreetMap');

  // Contornos estatales (debajo de la red vial)
  let estadosCapa: Leaflet.GeoJSON | null = null;
  if (opts.estados !== false) {
    map.createPane('estados').style.zIndex = '250';
    const est = await cargarEstados();
    estadosCapa = L.geoJSON(
      { type: 'FeatureCollection', features: est.map((e) => ({ type: 'Feature', properties: { n: e.n }, geometry: { type: 'MultiPolygon', coordinates: e.p.map((r) => [r]) } })) } as GeoJSON.FeatureCollection,
      { pane: 'estados', interactive: true, style: () => ({ color: css('--road1'), weight: 1.2, fillColor: css('--road3'), fillOpacity: 0.55 }) },
    ).addTo(map);
  }

  // Red vial por jerarquía, en canvas
  const lineas: [number, Leaflet.Polyline][] = [];
  if (opts.calles !== false) {
    const R = await cargarRed();
    map.createPane('calles').style.zIndex = '300';
    const rr = L.canvas({ pane: 'calles', padding: 0.4 });
    for (let c = 4; c >= 0; c--) {
      lineas.push([c, L.polyline(R.porClase[c], { renderer: rr, pane: 'calles', color: css(`--road${c}`), weight: ANCHO[c], interactive: false, lineCap: 'round', lineJoin: 'round', smoothFactor: 1 }).addTo(map)]);
    }
    const escalar = () => {
      const z = map.getZoom();
      const f = z >= 17 ? 2.6 : z >= 16 ? 2 : z >= 15 ? 1.6 : z >= 14 ? 1.25 : 1;
      for (const [c, pl] of lineas) pl.setStyle({ weight: ANCHO[c] * f, opacity: c === 4 && z < 12.5 ? 0.45 : z < 9 && c > 1 ? 0 : 1 });
    };
    map.on('zoomend', escalar);
    escalar();
    nombreDeCalle(L, map, el, R);
  }

  const repintar = () => {
    for (const [c, pl] of lineas) pl.setStyle({ color: css(`--road${c}`) });
    estadosCapa?.setStyle({ color: css('--road1'), fillColor: css('--road3') });
  };
  return { map, repintar, estadosCapa };
}

/** Al pasar el cursor se resalta la vialidad con nombre más cercana (≤ 7 px) y se muestra su nombre. */
function nombreDeCalle(L: typeof Leaflet, map: Leaflet.Map, el: HTMLElement, R: Red) {
  const G = 0.002;
  const malla = new Map<string, [string, [number, number], [number, number]][]>();
  const porNombre = new Map<string, [number, number][][]>();
  for (const [, nm, pts] of R.nombradas) {
    if (!porNombre.has(nm)) porNombre.set(nm, []);
    porNombre.get(nm)!.push(pts);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      for (let x = Math.floor(Math.min(a[1], b[1]) / G); x <= Math.floor(Math.max(a[1], b[1]) / G); x++)
        for (let y = Math.floor(Math.min(a[0], b[0]) / G); y <= Math.floor(Math.max(a[0], b[0]) / G); y++) {
          const k = x + ',' + y;
          let cl = malla.get(k);
          if (!cl) malla.set(k, (cl = []));
          cl.push([nm, a, b]);
        }
    }
  }
  const dSeg = (la: number, ln: number, a: [number, number], b: [number, number]) => {
    const k = Math.cos((la * Math.PI) / 180) * 111320, m = 110540;
    const px = (ln - a[1]) * k, py = (la - a[0]) * m, bx = (b[1] - a[1]) * k, by = (b[0] - a[0]) * m;
    const t = Math.max(0, Math.min(1, (px * bx + py * by) / (bx * bx + by * by || 1)));
    return Math.hypot(px - t * bx, py - t * by);
  };

  const tip = L.DomUtil.create('div', 'rtip', el);
  tip.hidden = true;
  map.createPane('rhov').style.zIndex = '399';
  const hr = L.canvas({ pane: 'rhov', padding: 0.3 });
  const hl = L.layerGroup().addTo(map);
  let actual: string | null = null, raf = 0, ultimo: MouseEvent | null = null;
  const ocultar = () => {
    if (actual !== null) { actual = null; hl.clearLayers(); }
    tip.hidden = true;
  };
  const revisar = () => {
    raf = 0;
    const e = ultimo;
    if (!e) return;
    if ((e.target as HTMLElement).closest('.leaflet-marker-icon,.leaflet-popup,.leaflet-control,.leaflet-tooltip') || map.getZoom() < 13) return ocultar();
    const ll = map.mouseEventToLatLng(e), cp = map.mouseEventToContainerPoint(e);
    const mpp = (156543.03392 * Math.cos((ll.lat * Math.PI) / 180)) / Math.pow(2, map.getZoom());
    const tol = 7 * mpp, r = Math.ceil(tol / 200);
    const cx = Math.floor(ll.lng / G), cy = Math.floor(ll.lat / G);
    let mejor: string | null = null, bd = tol;
    for (let x = cx - r; x <= cx + r; x++)
      for (let y = cy - r; y <= cy + r; y++) {
        for (const [nm, a, b] of malla.get(x + ',' + y) ?? []) {
          const d = dSeg(ll.lat, ll.lng, a, b);
          if (d < bd) { bd = d; mejor = nm; }
        }
      }
    if (!mejor) return ocultar();
    if (mejor !== actual) {
      actual = mejor;
      hl.clearLayers();
      L.polyline(porNombre.get(mejor)!, { renderer: hr, color: css('--accent'), weight: 10, opacity: 0.4, interactive: false, lineCap: 'round', lineJoin: 'round' }).addTo(hl);
      tip.textContent = mejor;
    }
    tip.style.left = cp.x + 'px';
    tip.style.top = cp.y + 'px';
    tip.hidden = false;
  };
  el.addEventListener('mousemove', (e) => { ultimo = e; if (!raf) raf = requestAnimationFrame(revisar); });
  el.addEventListener('mouseleave', () => { ultimo = null; ocultar(); });
  map.on('movestart zoomstart popupopen', ocultar);
}
