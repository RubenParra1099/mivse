'use client';
import { useEffect, useRef } from 'react';
import type * as Leaflet from 'leaflet';
import { ATRIBUCION, cargarLeaflet, urlTeselas } from '@/lib/leaflet-cliente';
import { useTema } from '@/hooks/useTema';

export function MiniMapa({ lat, lng, color }: { lat: number; lng: number; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapa = useRef<{ map: Leaflet.Map; capa: Leaflet.TileLayer; pin: Leaflet.CircleMarker; halo: Leaflet.Circle } | null>(null);
  const tema = useTema();

  useEffect(() => {
    let vivo = true;
    cargarLeaflet().then((L) => {
      if (!vivo || !ref.current) return;
      if (!mapa.current) {
        const map = L.map(ref.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView([lat, lng], 14);
        map.attributionControl.setPrefix(false);
        const capa = L.tileLayer(urlTeselas(tema), { attribution: ATRIBUCION, maxZoom: 19 }).addTo(map);
        const halo = L.circle([lat, lng], { radius: 260, color, weight: 1, fillColor: color, fillOpacity: 0.12 }).addTo(map);
        const pin = L.circleMarker([lat, lng], { radius: 7, color: '#fff', weight: 2.5, fillColor: color, fillOpacity: 1 }).addTo(map);
        mapa.current = { map, capa, pin, halo };
      } else {
        const m = mapa.current;
        m.map.setView([lat, lng], 14);
        m.pin.setLatLng([lat, lng]).setStyle({ fillColor: color });
        m.halo.setLatLng([lat, lng]).setStyle({ color, fillColor: color });
      }
    });
    return () => {
      vivo = false;
    };
  }, [lat, lng, color, tema]);

  useEffect(() => {
    mapa.current?.capa.setUrl(urlTeselas(tema));
  }, [tema]);

  useEffect(
    () => () => {
      mapa.current?.map.remove();
      mapa.current = null;
    },
    [],
  );

  return <div ref={ref} style={{ height: 190, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }} />;
}
