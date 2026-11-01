'use client';
// Mapa base igual al de Ciudades Inteligentes: teselas de OpenStreetMap con selector Calles/Satélite, más los
// contornos estatales para la vista nacional. La red vial local (red-vial.txt) se usa para nombrar calles sin conexión.
import type * as Leaflet from 'leaflet';

export interface Red {
  porClase: [number, number][][][];
  nombradas: [number, string, [number, number][]][];
}
interface Estado {
  n: string;
  p: [number, number][][];
}

const redes = new Map<string, Promise<Red>>();
let estados: Promise<Estado[]> | null = null;

/** Formato de red-vial.txt: 1a línea = nombres; luego clase|nombre|x0,y0,dx,dy… (×1e5, deltas). */
function cargarArchivoRed(url: string): Promise<Red> {
  let red = redes.get(url);
  if (!red) {
    red = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
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
    red.catch(() => redes.delete(url)); // permitir reintentar si falló la descarga
    redes.set(url, red);
  }
  return red;
}

export const cargarRed = () => cargarArchivoRed('/data/red-vial.txt');

export function cargarEstados(): Promise<Estado[]> {
  if (!estados) estados = fetch('/data/estados.json').then((r) => r.json());
  return estados;
}

const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/** Mismas capas base que Ciudades Inteligentes (las teselas no cambian con el tema). */
export const capasBase = (L: typeof Leaflet) => ({
  Calles: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }),
  Satélite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imágenes © Esri' }),
});

export interface MapaBase {
  map: Leaflet.Map;
  /** Vuelve a leer los colores del tema (claro/oscuro). */
  repintar: () => void;
  estadosCapa: Leaflet.GeoJSON | null;
}

export async function crearMapaBase(L: typeof Leaflet, el: HTMLElement, opts: { estados?: boolean; zoomControl?: boolean; selector?: boolean } = {}): Promise<MapaBase> {
  const map = L.map(el, { zoomSnap: 0.5, minZoom: 4, maxZoom: 19, zoomControl: opts.zoomControl ?? true });
  map.attributionControl.setPrefix(false);
  const capas = capasBase(L);
  capas.Calles.addTo(map);
  if (opts.selector !== false) L.control.layers(capas, undefined, { position: 'topright' }).addTo(map);

  // Contornos estatales (el tablero los sombrea con los egresados filtrados)
  let estadosCapa: Leaflet.GeoJSON | null = null;
  if (opts.estados !== false) {
    const pane = map.createPane('estados');
    pane.style.zIndex = '250';
    // Los estados sólo responden a clic y cursor en las vistas regional y nacional
    const interaccion = () => (pane.style.pointerEvents = map.getZoom() < 8 ? '' : 'none');
    map.on('zoomend', interaccion);
    interaccion();
    const est = await cargarEstados();
    estadosCapa = L.geoJSON(
      { type: 'FeatureCollection', features: est.map((e) => ({ type: 'Feature', properties: { n: e.n }, geometry: { type: 'MultiPolygon', coordinates: e.p.map((r) => [r]) } })) } as GeoJSON.FeatureCollection,
      { pane: 'estados', interactive: true, style: () => ({ color: css('--road1'), weight: 1.2, fillOpacity: 0 }) },
    ).addTo(map);
  }

  const repintar = () => estadosCapa?.setStyle({ color: css('--road1') });
  return { map, repintar, estadosCapa };
}
