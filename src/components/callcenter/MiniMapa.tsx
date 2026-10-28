'use client';
import { useEffect, useRef } from 'react';
import type * as Leaflet from 'leaflet';
import { cargarLeaflet } from '@/lib/leaflet-cliente';
import { crearMapaBase, type MapaBase } from '@/lib/mapa-base';
import { useTema } from '@/hooks/useTema';
import { BotonPantallaCompleta } from '../ui/BotonPantallaCompleta';

/** Ubicación del egresado sobre la red vial (mismo estilo que el tablero y la plataforma de vialidad). */
export function MiniMapa({ lat, lng, color, titulo, completo }: { lat: number; lng: number; color: string; titulo?: string; completo?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const st = useRef<{ base: MapaBase; pin: Leaflet.Marker; L: typeof Leaflet } | null>(null);
  const tema = useTema();

  const icono = (L: typeof Leaflet, c: string) =>
    L.divIcon({ className: 'dot-mk', html: `<i style="background:${c};width:16px;height:16px;box-shadow:0 0 0 6px color-mix(in srgb, ${c} 30%, transparent)"></i>`, iconSize: [16, 16], iconAnchor: [8, 8] });

  useEffect(() => {
    let vivo = true;
    (async () => {
      const L = await cargarLeaflet();
      if (!vivo || !ref.current || st.current) return;
      const base = await crearMapaBase(L, ref.current, { zoomControl: !!completo });
      if (!vivo) return base.map.remove();
      if (completo) L.control.scale({ imperial: false }).addTo(base.map);
      else base.map.scrollWheelZoom.disable();
      base.map.setView([lat, lng], completo ? 17 : 15);
      const pin = L.marker([lat, lng], { icon: icono(L, color), keyboard: false, interactive: false }).addTo(base.map);
      st.current = { base, pin, L };
    })();
    return () => {
      vivo = false;
      st.current?.base.map.remove();
      st.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const s = st.current;
    if (!s) return;
    s.base.map.setView([lat, lng], completo ? 17 : 15);
    s.pin.setLatLng([lat, lng]).setIcon(icono(s.L, color));
  }, [lat, lng, color]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    st.current?.base.repintar();
  }, [tema]);

  if (completo) return <div ref={ref} style={{ position: 'absolute', inset: 0, background: 'var(--mapbg)' }} />;

  const q = new URLSearchParams({ tipo: 'punto', lat: String(lat), lng: String(lng), color });
  if (titulo) q.set('titulo', titulo);
  return (
    <div style={{ position: 'relative', height: 200, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--mapbg)' }}>
      <div ref={ref} style={{ position: 'absolute', inset: 0 }} />
      <BotonPantallaCompleta href={`/mapa?${q}`} compacto />
    </div>
  );
}
