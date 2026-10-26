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
