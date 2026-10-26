'use client';
// Carga perezosa de Leaflet y sus plugins (clúster y mapa de calor) sólo en el navegador.
import type * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';

let promesa: Promise<typeof Leaflet> | null = null;

export function cargarLeaflet(): Promise<typeof Leaflet> {
  if (!promesa) {
    promesa = (async () => {
      const L = (await import('leaflet')).default;
      (window as unknown as { L: typeof Leaflet }).L = L;
      await import('leaflet.markercluster');
      // @ts-expect-error — el plugin no publica tipos
      await import('leaflet.heat');
      return L;
    })();
  }
  return promesa;
}

/** Mapa base minimalista (CARTO) que sigue el tema claro/oscuro, como en el tablero de vialidad. */
export function urlTeselas(tema: 'dark' | 'light') {
  return tema === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
}
export const ATRIBUCION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/">CARTO</a>';
