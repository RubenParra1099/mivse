'use client';
import { useEffect, useRef } from 'react';
import type * as Leaflet from 'leaflet';
import { cargarLeaflet } from '@/lib/leaflet-cliente';
import { crearMapaBase, type MapaBase } from '@/lib/mapa-base';
import { useTema } from '@/hooks/useTema';

export interface PuntoCaptura {
  lat: number;
  lng: number;
  color: string;
  etiqueta: string;
}

const acento = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * Selector de ubicación sobre la red vial (estilo vialidad): pin arrastrable, clic para colocarlo,
 * círculo de precisión del GPS y las capturas del día como referencia.
 */
export function MapaCaptura({
  punto, precision, puntos, enfoque, onPunto,
}: {
  punto: { lat: number; lng: number } | null;
  precision: number | null;
  puntos: PuntoCaptura[];
  /** Cambia para volver a centrar el mapa en el punto. */
  enfoque: number;
  onPunto: (lat: number, lng: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const st = useRef<{ L: typeof Leaflet; base: MapaBase; pin: Leaflet.Marker; circulo: Leaflet.Circle; capas: Leaflet.LayerGroup } | null>(null);
  const onP = useRef(onPunto);
  onP.current = onPunto;
  const props = useRef({ punto, precision, puntos });
  props.current = { punto, precision, puntos };
  const tema = useTema();

  const pinta = () => {
    const s = st.current;
    if (!s) return;
    const { punto, precision, puntos } = props.current;
    if (punto) {
      s.pin.setLatLng([punto.lat, punto.lng]);
      if (!s.base.map.hasLayer(s.pin)) s.pin.addTo(s.base.map);
      s.circulo.setLatLng([punto.lat, punto.lng]).setRadius(precision ?? 0);
      if (precision && !s.base.map.hasLayer(s.circulo)) s.circulo.addTo(s.base.map);
      if (!precision) s.circulo.remove();
    } else {
      s.pin.remove();
      s.circulo.remove();
    }
    s.capas.clearLayers();
    for (const p of puntos) {
      s.L.marker([p.lat, p.lng], {
        icon: s.L.divIcon({ className: 'dot-mk', html: `<i style="background:${p.color}"></i>`, iconSize: [12, 12], iconAnchor: [6, 6] }),
        keyboard: false,
      })
        .bindTooltip(esc(p.etiqueta), { className: 'edo', direction: 'top', offset: [0, -6] })
        .addTo(s.capas);
    }
  };

  useEffect(() => {
    let vivo = true;
    (async () => {
      const L = await cargarLeaflet();
      if (!vivo || !ref.current || st.current) return;
      const base = await crearMapaBase(L, ref.current);
      if (!vivo) return base.map.remove();
      const p = props.current.punto;
      base.map.setView(p ? [p.lat, p.lng] : [25.5428, -103.4068], p ? 17 : 13);
      L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(base.map);
      const pin = L.marker([0, 0], {
        draggable: true,
        autoPan: true,
        zIndexOffset: 1000,
        icon: L.divIcon({ className: 'pin-campo', html: '<span></span>', iconSize: [34, 44], iconAnchor: [17, 40] }),
      });
      pin.on('dragend', () => {
        const ll = pin.getLatLng();
        onP.current(ll.lat, ll.lng);
      });
      const circulo = L.circle([0, 0], { radius: 0, color: acento(), weight: 1.5, fillColor: acento(), fillOpacity: 0.12, interactive: false });
      base.map.on('click', (e: Leaflet.LeafletMouseEvent) => onP.current(e.latlng.lat, e.latlng.lng));
      st.current = { L, base, pin, circulo, capas: L.layerGroup().addTo(base.map) };
      pinta();
    })();
    return () => {
      vivo = false;
      st.current?.base.map.remove();
      st.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(pinta, [punto?.lat, punto?.lng, precision, puntos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Centrar en el punto cuando lo pide el formulario (GPS, búsqueda, egresado cargado)
  useEffect(() => {
    const s = st.current;
    const p = props.current.punto;
    if (s && p && enfoque) s.base.map.flyTo([p.lat, p.lng], Math.max(s.base.map.getZoom(), 17), { duration: 0.6 });
  }, [enfoque]);

  useEffect(() => {
    st.current?.base.repintar();
    st.current?.circulo.setStyle({ color: acento(), fillColor: acento() });
  }, [tema]);

  return <div ref={ref} style={{ position: 'absolute', inset: 0, background: 'var(--mapbg)' }} />;
}
